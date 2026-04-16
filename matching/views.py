"""
API Views for Ride Matching & Coordination.

Endpoints
---------
GET  /api/matching/rank/<ride_request_id>/
    Returns a ranked list of the best RideOffer matches for a given
    RideRequest, scored by detour time via the Mapbox Matrix API.

POST /api/matching/confirm/
    Confirms a match between a RideOffer and a RideRequest.  Uses
    database-level row locking to prevent double-booking.

GET  /api/matching/rides/<pk>/
    Retrieves full details for a specific Ride instance.

GET  /api/matching/rides/
    Lists all Ride instances (paginated).
"""

import logging

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from matching.models import Ride
from matching.serializers import (
    ConfirmMatchSerializer,
    MatchResultSerializer,
    RideSerializer,
)
from matching.services import MatchingEngine, MatchingError, MapboxAPIError

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# A) Rank Matches
# ═══════════════════════════════════════════════════════════════════════════
class RankMatchesView(APIView):
    """
    **GET /api/matching/rank/<ride_request_id>/**

    Query available RideOffers, compute detour via Mapbox, and return a
    ranked list ordered by shortest additional travel time.

    Path Parameters
    ----------------
    ride_request_id : int
        The PK of the RideRequest for which to find matches.

    Response (200)
    ---------------
    .. code-block:: json

        {
            "ride_request_id": 42,
            "matches": [
                {
                    "ride_offer_id": 7,
                    "driver_name": "Alice",
                    "departure_time": "2026-04-07T08:00:00-04:00",
                    "available_seats": 3,
                    "original_duration": 1200.0,
                    "detoured_duration": 1450.0,
                    "extra_seconds": 250.0
                }
            ]
        }
    """

    def get(self, request, ride_request_id):
        engine = MatchingEngine()

        try:
            ranked = engine.rank_best_matches(ride_request_id)
        except MatchingError as exc:
            logger.warning("Matching error: %s", exc)
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except MapboxAPIError as exc:
            logger.error("Mapbox API error during ranking: %s", exc)
            return Response(
                {"error": "Routing service temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        serializer = MatchResultSerializer(ranked, many=True)

        return Response(
            {
                "ride_request_id": ride_request_id,
                "matches": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


# ═══════════════════════════════════════════════════════════════════════════
# B) Confirm Match
# ═══════════════════════════════════════════════════════════════════════════
class ConfirmMatchView(APIView):
    """
    **POST /api/matching/confirm/**

    Atomically confirm a ride match.  The RideOffer's seat count is
    decremented and the RideRequest's status is set to ``matched`` —
    all within a single database transaction with row-level locking.

    Request Body
    -------------
    .. code-block:: json

        {
            "ride_offer_id": 7,
            "ride_request_id": 42
        }

    Response (201)
    ---------------
    The full ``Ride`` object, serialized via ``RideSerializer``.
    """

    def post(self, request):
        input_serializer = ConfirmMatchSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        ride_offer_id = input_serializer.validated_data["ride_offer_id"]
        ride_request_id = input_serializer.validated_data["ride_request_id"]

        engine = MatchingEngine()

        try:
            ride = engine.confirm_match(ride_offer_id, ride_request_id)
        except MatchingError as exc:
            logger.warning("Confirm error: %s", exc)
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except MapboxAPIError as exc:
            logger.error("Mapbox API error during confirm: %s", exc)
            return Response(
                {"error": "Routing service temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        output_serializer = RideSerializer(ride)

        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
        )


# ═══════════════════════════════════════════════════════════════════════════
# Ride CRUD (read-only list & detail)
# ═══════════════════════════════════════════════════════════════════════════
class RideListView(generics.ListAPIView):
    """
    **GET /api/matching/rides/**

    Paginated list of all Ride instances.
    """

    queryset = Ride.objects.all().select_related("ride_offer__driver")
    serializer_class = RideSerializer


class RideDetailView(generics.RetrieveAPIView):
    """
    **GET /api/matching/rides/<pk>/**

    Retrieve a single Ride by its primary key.
    """

    queryset = Ride.objects.all().select_related("ride_offer__driver")
    serializer_class = RideSerializer
    lookup_field = "pk"
