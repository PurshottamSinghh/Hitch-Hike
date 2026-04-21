"""
Matching Engine — Business logic for Functionality 3.

This module contains the ``MatchingEngine`` class which encapsulates:
  1. Mapbox Matrix API integration for travel-time computation.
  2. Ranking algorithm that scores RideOffers by detour cost.
  3. Thread-safe ride confirmation with ``select_for_update()`` locking.
"""

import json
import logging
import re
import math
from typing import Any

import requests
from django.conf import settings
from django.db import transaction

from matching.models import Ride
from rides.models import RideOffer, RideRequest


def _extract_coords(value):
    """
    Extract (longitude, latitude) from a GIS Point object.
    Returns (lng, lat) or (0.0, 0.0) as fallback.
    """
    if value is None:
        return (0.0, 0.0)
    if hasattr(value, "x") and hasattr(value, "y"):
        return (value.x, value.y)
    return (0.0, 0.0)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAPBOX_MATRIX_URL = (
    "https://api.mapbox.com/directions-matrix/v1/mapbox/driving"
)
# Maximum number of coordinates per Matrix API call (Mapbox limit = 25)
MAX_MATRIX_COORDS = 25
# Maximum detour (in seconds) before an offer is discarded from results
MAX_DETOUR_SECONDS = 30 * 60  # 30 minutes


class MapboxAPIError(Exception):
    """Raised when the Mapbox Matrix API returns an error."""


class MatchingError(Exception):
    """Raised for business-logic errors during matching / confirmation."""


# ═══════════════════════════════════════════════════════════════════════════
# Matching Engine
# ═══════════════════════════════════════════════════════════════════════════
class MatchingEngine:
    """
    Orchestrates ride-request matching against available ride-offers.

    Usage::

        engine = MatchingEngine()
        ranked = engine.rank_best_matches(ride_request_id=42)
        confirmed_ride = engine.confirm_match(
            ride_offer_id=ranked[0]["ride_offer_id"],
            ride_request_id=42,
        )
    """

    def __init__(self):
        self.mapbox_token: str = settings.MAPBOX_SECRET_TOKEN

    # -------------------------------------------------------------------
    # Mapbox Matrix API
    # -------------------------------------------------------------------
    def fetch_mapbox_distance_matrix(
        self,
        coordinates: list[tuple[float, float]],
    ) -> dict[str, Any]:
        """
        Call the Mapbox Matrix API and return the durations matrix.

        Parameters
        ----------
        coordinates : list of (longitude, latitude) tuples
            Ordered list of waypoints.  The first coordinate is the origin
            and the last is the destination; intermediate entries are
            waypoints (e.g., rider pickup / dropoff).

        Returns
        -------
        dict
            The full JSON response from Mapbox, including ``"durations"``
            (a 2-D list of travel times in seconds between every pair of
            coordinates).

        Raises
        ------
        MapboxAPIError
            If the HTTP request fails or Mapbox returns a non-OK code.
        ValueError
            If the coordinate list exceeds the Mapbox limit.
        """
        if len(coordinates) > MAX_MATRIX_COORDS:
            raise ValueError(
                f"Mapbox Matrix API supports at most {MAX_MATRIX_COORDS} "
                f"coordinates; received {len(coordinates)}."
            )

        # Build semicolon-separated coordinate string: "lng,lat;lng,lat;…"
        coords_str = ";".join(
            f"{lng},{lat}" for lng, lat in coordinates
        )

        url = f"{MAPBOX_MATRIX_URL}/{coords_str}"
        params = {
            "access_token": self.mapbox_token,
            "annotations": "duration",
        }

        logger.info(
            "Mapbox Matrix request — %d coordinates", len(coordinates)
        )

        try:
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
        except requests.RequestException as exc:
            logger.error("Mapbox API request failed: %s", exc)
            raise MapboxAPIError(
                f"Failed to reach Mapbox Matrix API: {exc}"
            ) from exc

        data = response.json()

        if data.get("code") != "Ok":
            msg = data.get("message", "Unknown Mapbox error")
            logger.error("Mapbox API error: %s", msg)
            raise MapboxAPIError(f"Mapbox API error: {msg}")

        return data

    # -------------------------------------------------------------------
    # Ranking
    # -------------------------------------------------------------------
    def rank_best_matches(
        self,
        ride_request_id: int,
    ) -> list[dict[str, Any]]:
        """
        Rank all available RideOffers by how little detour the driver
        would incur if they picked up the rider.

        Algorithm
        ---------
        For each active offer with ``available_seats >= 1``:

        1. Compute the **original duration** (driver origin → driver
           destination) via the Mapbox Matrix API.
        2. Compute the **detoured duration** (driver origin → rider pickup
           → rider dropoff → driver destination).
        3. ``extra_seconds = detoured_duration − original_duration``.
        4. Discard offers where ``extra_seconds > MAX_DETOUR_SECONDS``.
        5. Sort ascending by ``extra_seconds``.

        Parameters
        ----------
        ride_request_id : int
            Primary key of the ``RideRequest`` to match.

        Returns
        -------
        list of dict
            Each dict contains:
            ``ride_offer_id``, ``driver_name``, ``departure_time``,
            ``available_seats``, ``original_duration``,
            ``detoured_duration``, ``extra_seconds``.

        Raises
        ------
        MatchingError
            If the ride request does not exist or has already been matched.
        """
        # --- Validate the ride request -----------------------------------
        try:
            ride_request = RideRequest.objects.get(pk=ride_request_id)
        except RideRequest.DoesNotExist:
            raise MatchingError(
                f"RideRequest with id {ride_request_id} does not exist."
            )

        if ride_request.status != "pending":
            raise MatchingError(
                f"RideRequest #{ride_request_id} is not pending (current: {ride_request.status})."
            )

        # --- Fetch active offers with at least 1 seat -------------------
        offers = RideOffer.objects.filter(
            is_active=True,
            available_seats__gte=ride_request.seats_needed,
        ).select_related("driver")

        if not offers.exists():
            logger.info("No active offers with available seats.")
            return []

        # --- Score each offer --------------------------------------------
        results: list[dict[str, Any]] = []

        for offer in offers:
            try:
                score = self._compute_detour(offer, ride_request)
            except MapboxAPIError:
                logger.warning(
                    "Mapbox unavailable for Offer #%d — using fallback heuristic.", offer.pk
                )
                score = self._compute_detour_fallback(offer, ride_request)

            if score["extra_seconds"] > MAX_DETOUR_SECONDS:
                continue

            compatibility_score = max(
                0, min(100, round(100 - (score["extra_seconds"] / MAX_DETOUR_SECONDS) * 100))
            )

            results.append(
                {
                    "ride_offer_id": offer.pk,
                    "driver_name": str(offer.driver),
                    "departure_time": offer.departure_time.isoformat(),
                    "available_seats": offer.available_seats,
                    "original_duration": score["original_duration"],
                    "detoured_duration": score["detoured_duration"],
                    "extra_seconds": score["extra_seconds"],
                    "compatibility_score": compatibility_score,
                }
            )

        # Sort by shortest additional detour
        results.sort(key=lambda r: r["extra_seconds"])
        logger.info(
            "Ranked %d matches for RideRequest #%d",
            len(results),
            ride_request_id,
        )
        return results

    def _compute_detour(
        self,
        offer: RideOffer,
        request: RideRequest,
    ) -> dict[str, float]:
        """
        Compute the detour cost for a single offer + request pair.

        Returns a dict with ``original_duration``, ``detoured_duration``,
        and ``extra_seconds``.
        """
        driver_origin = _extract_coords(offer.origin)
        driver_dest = _extract_coords(offer.destination)
        rider_pickup = _extract_coords(request.pickup_location)
        rider_dropoff = _extract_coords(request.dropoff_location)

        # --- Original trip (no detour) -----------------------------------
        original_data = self.fetch_mapbox_distance_matrix(
            [driver_origin, driver_dest]
        )
        original_duration = original_data["durations"][0][1]

        # --- Detoured trip: origin → pickup → dropoff → destination ------
        detour_data = self.fetch_mapbox_distance_matrix(
            [driver_origin, rider_pickup, rider_dropoff, driver_dest]
        )
        # Sum: origin→pickup + pickup→dropoff + dropoff→destination
        detoured_duration = (
            detour_data["durations"][0][1]   # origin → pickup
            + detour_data["durations"][1][2]  # pickup → dropoff
            + detour_data["durations"][2][3]  # dropoff → destination
        )

        extra = detoured_duration - original_duration

        return {
            "original_duration": round(original_duration, 1),
            "detoured_duration": round(detoured_duration, 1),
            "extra_seconds": round(max(extra, 0), 1),
        }

    def _compute_detour_fallback(
        self,
        offer: RideOffer,
        request: RideRequest,
    ) -> dict[str, float]:
        """
        Fallback when Mapbox is unavailable.
        Uses rough great-circle approximation and average city speed.
        """
        speed_m_s = 11.0  # ~25 mph average urban speed

        driver_origin = _extract_coords(offer.origin)
        driver_dest = _extract_coords(offer.destination)
        rider_pickup = _extract_coords(request.pickup_location)
        rider_dropoff = _extract_coords(request.dropoff_location)

        original_m = _haversine_m(driver_origin, driver_dest)
        detoured_m = (
            _haversine_m(driver_origin, rider_pickup)
            + _haversine_m(rider_pickup, rider_dropoff)
            + _haversine_m(rider_dropoff, driver_dest)
        )
        original_duration = original_m / speed_m_s
        detoured_duration = detoured_m / speed_m_s
        extra = detoured_duration - original_duration
        return {
            "original_duration": round(original_duration, 1),
            "detoured_duration": round(detoured_duration, 1),
            "extra_seconds": round(max(extra, 0), 1),
        }

    # -------------------------------------------------------------------
    # Confirm Match (ACID-compliant)
    # -------------------------------------------------------------------
    def confirm_match(
        self,
        ride_offer_id: int,
        ride_request_id: int,
    ) -> Ride:
        """
        Atomically confirm a match between a RideOffer and a RideRequest.

        This method uses ``select_for_update()`` within a database
        transaction to guarantee ACID compliance — no seat can be
        double-booked even under concurrent requests.

        Parameters
        ----------
        ride_offer_id : int
            PK of the ``RideOffer`` to lock and decrement.
        ride_request_id : int
            PK of the ``RideRequest`` to attach.

        Returns
        -------
        Ride
            The newly created (or updated) ``Ride`` instance.

        Raises
        ------
        MatchingError
            If the offer or request does not exist, no seats remain,
            or the request has already been matched.
        """
        with transaction.atomic():
            # --- Lock the RideOffer row for the duration of the txn ------
            try:
                offer = (
                    RideOffer.objects
                    .select_for_update()
                    .get(pk=ride_offer_id)
                )
            except RideOffer.DoesNotExist:
                raise MatchingError(
                    f"RideOffer with id {ride_offer_id} does not exist."
                )

            # --- Validate seat availability ------------------------------
            if offer.available_seats < 1:
                raise MatchingError(
                    f"RideOffer #{ride_offer_id} has no available seats."
                )

            # --- Lock and validate the RideRequest -----------------------
            try:
                ride_request = (
                    RideRequest.objects
                    .select_for_update()
                    .get(pk=ride_request_id)
                )
            except RideRequest.DoesNotExist:
                raise MatchingError(
                    f"RideRequest with id {ride_request_id} does not exist."
                )

            if ride_request.status != "pending":
                raise MatchingError(
                    f"RideRequest #{ride_request_id} is not pending (current: {ride_request.status})."
                )
            if offer.available_seats < ride_request.seats_needed:
                raise MatchingError(
                    f"RideOffer #{ride_offer_id} does not have enough seats."
                )

            # --- Compute final detour for the confirmation record --------
            try:
                score = self._compute_detour(offer, ride_request)
                detour = int(score["extra_seconds"])
            except MapboxAPIError:
                logger.warning(
                    "Mapbox unavailable during confirm — setting detour to 0."
                )
                detour = 0

            # --- Create or update the Ride object ------------------------
            ride, created = Ride.objects.get_or_create(
                ride_offer=offer,
                status="pending",
                defaults={"total_detour_time": detour},
            )
            ride.ride_requests.add(ride_request)
            ride.total_detour_time += detour if not created else 0
            ride.status = "confirmed"
            ride.save()

            # --- Decrement seats & update statuses -----------------------
            offer.available_seats -= ride_request.seats_needed
            if offer.available_seats == 0:
                offer.is_active = False
            offer.save()

            # Auto-matched requests are marked as matched to separate them from manual accepts.
            ride_request.status = "matched"
            ride_request.driver = offer.driver
            ride_request.ride_offer = offer
            ride_request.save()

            logger.info(
                "Confirmed Ride #%d — Offer #%d ↔ Request #%d "
                "(detour: %ds, seats left: %d)",
                ride.pk,
                offer.pk,
                ride_request.pk,
                detour,
                offer.available_seats,
            )

        return ride


def _haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance in meters between two (lng, lat) points."""
    lng1, lat1 = a
    lng2, lat2 = b
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)

    h = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * r * math.atan2(math.sqrt(h), math.sqrt(1 - h))
