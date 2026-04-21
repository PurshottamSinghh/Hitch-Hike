"""
Rides API views.

Ride request dispatch has been redesigned around an Uber-style "parallel
pickup-range" model:

  1. Rider submits a RideRequest via ``POST /rides/requests/``.
  2. ``perform_create`` fans out a Mapbox Matrix query to every
     notification-enabled driver to find the subset whose current location
     is within 5 minutes of the rider's pickup point.
  3. Those drivers are stored on the ``RideRequest`` itself in
     ``eligible_driver_ids`` and exposed individually via
     ``GET /rides/requests/my_dispatch/``.
  4. First driver to POST ``.../accept/`` wins (row lock + status check).
     Any driver can POST ``.../reject/``; once the last eligible driver
     rejects, status flips to ``no_drivers_available``.
"""

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    ClassSchedule,
    ProactiveRideMatch,
    RideOffer,
    RideRequest,
)
from .serializers import (
    ClassScheduleSerializer,
    ProactiveRideMatchSerializer,
    RideOfferSerializer,
    RideRequestSerializer,
)


# ---------------------------------------------------------------------------
# RideOffer: read-only for everyone. Driver-posted offers are no longer part
# of the new flow, but existing code still references this viewset. We keep
# list/retrieve available so history views do not break.
# ---------------------------------------------------------------------------
class RideOfferViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RideOfferSerializer

    def get_queryset(self):
        return RideOffer.objects.filter(is_active=True)


# ---------------------------------------------------------------------------
# RideRequest
# ---------------------------------------------------------------------------
class RideRequestViewSet(viewsets.ModelViewSet):
    """CRUD + dispatch-aware actions for RideRequests."""

    serializer_class = RideRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q
        user = self.request.user
        qs = RideRequest.objects.filter(
            Q(passenger=user) | Q(driver=user)
        ).distinct()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    # --- Rider: create a new request ----------------------------------
    def perform_create(self, serializer):
        from matching.services import find_eligible_drivers_for_pickup

        ride_request = serializer.save(passenger=self.request.user)

        try:
            eligible = find_eligible_drivers_for_pickup(ride_request)
        except Exception as exc:  # pragma: no cover — defensive
            eligible = []
            ride_request.notes = (
                ride_request.notes
                + f"\n[dispatch] matching engine error: {exc}"
            ).strip()

        ride_request.eligible_driver_ids = [d["driver_id"] for d in eligible]
        ride_request.pickup_eta_seconds = {
            str(d["driver_id"]): d["pickup_seconds"] for d in eligible
        }
        if not ride_request.eligible_driver_ids:
            ride_request.status = "no_drivers_available"
        ride_request.save(
            update_fields=["eligible_driver_ids", "pickup_eta_seconds", "status", "notes"]
        )

    # --- Driver: see current dispatch invitation ----------------------
    @action(detail=False, methods=["get"], url_path="my_dispatch")
    def my_dispatch(self, request):
        """
        Returns the single most-relevant pending RideRequest that this
        driver has been invited to (or an empty object when none).
        """
        user = request.user
        qs = (
            RideRequest.objects.filter(status="pending")
            .exclude(rejected_driver_ids__contains=user.id)
            .order_by("created_at")
        )
        picked = None
        for req in qs:
            if user.id in (req.eligible_driver_ids or []):
                picked = req
                break

        if picked is None:
            return Response({}, status=status.HTTP_200_OK)

        data = self.get_serializer(picked).data
        data["pickup_eta_seconds"] = (
            picked.pickup_eta_seconds.get(str(user.id))
            if isinstance(picked.pickup_eta_seconds, dict)
            else None
        )
        return Response(data)

    # --- Rider: poll the newest of my own ride requests ----------------
    @action(detail=False, methods=["get"], url_path="my_active_request")
    def my_active_request(self, request):
        """
        Returns the rider's most-recent RideRequest regardless of status,
        so the /create page can poll for acceptance / no-drivers / etc.
        """
        req = (
            RideRequest.objects.filter(passenger=request.user)
            .order_by("-created_at")
            .first()
        )
        if req is None:
            return Response({}, status=status.HTTP_200_OK)
        return Response(self.get_serializer(req).data)

    # --- Driver: accept (race-safe) -----------------------------------
    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        user = request.user
        with transaction.atomic():
            ride_request = (
                RideRequest.objects.select_for_update().filter(pk=pk).first()
            )
            if ride_request is None:
                return Response({"error": "Not found."}, status=404)

            # Proactive flow: driver already pre-assigned, rider confirms.
            if ride_request.status == "pending_rider_confirm":
                if ride_request.passenger_id != user.id:
                    return Response(
                        {"error": "Only the rider can confirm this offer."}, status=403
                    )
                ride_request.status = "accepted"
                ride_request.save(update_fields=["status", "updated_at"])
                return Response(self.get_serializer(ride_request).data)

            if ride_request.status != "pending":
                return Response(
                    {"error": f"Request is no longer open (status: {ride_request.status})."},
                    status=400,
                )

            if user.id not in (ride_request.eligible_driver_ids or []):
                return Response(
                    {"error": "You are not in the eligible driver list for this request."},
                    status=403,
                )

            ride_request.status = "accepted"
            ride_request.driver = user
            ride_request.eligible_driver_ids = [user.id]
            ride_request.save(
                update_fields=[
                    "status",
                    "driver",
                    "eligible_driver_ids",
                    "updated_at",
                ]
            )

        return Response(self.get_serializer(ride_request).data)

    # --- Driver: decline; removes self, waterfalls to empty ------------
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        user = request.user
        with transaction.atomic():
            ride_request = (
                RideRequest.objects.select_for_update().filter(pk=pk).first()
            )
            if ride_request is None:
                return Response({"error": "Not found."}, status=404)

            # Proactive flow: rider declines a proactive offer.
            if ride_request.status == "pending_rider_confirm":
                if ride_request.passenger_id != user.id:
                    return Response(
                        {"error": "Only the rider can decline this offer."}, status=403
                    )
                ride_request.status = "rejected"
                ride_request.save(update_fields=["status", "updated_at"])
                return Response(self.get_serializer(ride_request).data)

            if ride_request.status != "pending":
                return Response(
                    {"error": f"Request no longer open (status: {ride_request.status})."},
                    status=400,
                )

            eligible = list(ride_request.eligible_driver_ids or [])
            rejected = list(ride_request.rejected_driver_ids or [])

            if user.id in eligible:
                eligible.remove(user.id)
            if user.id not in rejected:
                rejected.append(user.id)

            ride_request.eligible_driver_ids = eligible
            ride_request.rejected_driver_ids = rejected
            if not eligible:
                ride_request.status = "no_drivers_available"

            ride_request.save(
                update_fields=[
                    "eligible_driver_ids",
                    "rejected_driver_ids",
                    "status",
                    "updated_at",
                ]
            )

        return Response(self.get_serializer(ride_request).data)

    # --- Driver/Rider: mark complete ----------------------------------
    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        ride_request = get_object_or_404(RideRequest, pk=pk)
        user = request.user
        if (
            ride_request.driver_id != user.id
            and ride_request.passenger_id != user.id
            and not user.is_staff
        ):
            return Response({"error": "Not authorized."}, status=403)
        if ride_request.status not in ("accepted", "matched"):
            return Response(
                {"error": "Only accepted/matched rides can be completed."}, status=400
            )
        ride_request.status = "completed"
        ride_request.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(ride_request).data)

    # --- Rider: cancel their own pending request ----------------------
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        ride_request = get_object_or_404(RideRequest, pk=pk)
        if ride_request.passenger_id != request.user.id and not request.user.is_staff:
            return Response({"error": "Only the passenger can cancel."}, status=403)
        if ride_request.status in ("completed", "rejected", "cancelled", "no_drivers_available"):
            return Response(
                {"error": "Request is already closed."}, status=400
            )
        ride_request.status = "cancelled"
        ride_request.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(ride_request).data)


# ---------------------------------------------------------------------------
# ClassSchedule
# ---------------------------------------------------------------------------
class ClassScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = ClassScheduleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ClassSchedule.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        schedule = serializer.save(user=self.request.user)
        _sync_proactive_matches_for_schedule(schedule)


# ---------------------------------------------------------------------------
# ProactiveRideMatch — driver-facing "suggested rides" built from class
# schedule overlaps (same day, same building, start-time within 15 min).
# ---------------------------------------------------------------------------
class ProactiveRideMatchViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ProactiveRideMatchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q
        user = self.request.user
        return (
            ProactiveRideMatch.objects.filter(Q(driver=user) | Q(rider=user))
            .exclude(status__in=["declined", "expired"])
            .select_related("driver", "rider", "driver_schedule", "rider_schedule")
        )

    @action(detail=True, methods=["post"], url_path="offer")
    def offer(self, request, pk=None):
        """
        Driver turns a proactive match into a concrete RideRequest that the
        rider can accept/reject. The request is created in status
        ``pending_rider_confirm`` with the driver already attached.
        """
        match = get_object_or_404(ProactiveRideMatch, pk=pk)
        if match.driver_id != request.user.id:
            return Response({"error": "Only the suggested driver can offer."}, status=403)
        if match.status != "open":
            return Response({"error": "This match is no longer open."}, status=400)

        from django.contrib.gis.geos import Point
        from django.utils import timezone
        from datetime import datetime, timedelta
        from .models import BUILDING_COORDS, BUILDING_LABELS
        from matching.services import estimate_driving_duration

        driver_profile = getattr(match.driver, "profile", None)
        rider_profile = getattr(match.rider, "profile", None)
        if driver_profile is None or rider_profile is None:
            return Response({"error": "Missing user profile."}, status=400)

        pickup = rider_profile.current_location or driver_profile.current_location
        if pickup is None or driver_profile.current_location is None:
            return Response(
                {"error": "Both users must have a recent location set."},
                status=400,
            )

        # Dropoff = the class building coordinates (NOT the driver's location).
        building_slug = (
            match.rider_schedule.building
            or match.driver_schedule.building
            or ""
        )
        dropoff_lnglat = BUILDING_COORDS.get(building_slug)
        if dropoff_lnglat is None:
            return Response(
                {"error": "Class building has no known coordinates."},
                status=400,
            )
        dropoff_point = Point(dropoff_lnglat[0], dropoff_lnglat[1], srid=4326)

        # Compute travel-time estimates for the ride.$rideId UI:
        #   - driver → pickup ("reroute" / "pickup ETA")
        #   - pickup → building (so we can work out when the driver must leave)
        driver_coords = (driver_profile.current_location.x, driver_profile.current_location.y)
        pickup_coords = (pickup.x, pickup.y)
        driver_to_pickup_s = estimate_driving_duration(driver_coords, pickup_coords)
        pickup_to_building_s = estimate_driving_duration(pickup_coords, dropoff_lnglat)

        # Target pickup time = class start − pickup→building − 5 min buffer.
        class_start_dt = datetime.combine(
            timezone.localdate(),
            match.rider_schedule.start_time,
        )
        if timezone.is_naive(class_start_dt):
            class_start_dt = timezone.make_aware(class_start_dt)
        desired = class_start_dt - timedelta(
            seconds=int(pickup_to_building_s) + 5 * 60
        )

        building_label = BUILDING_LABELS.get(building_slug, "Class building")
        pickup_address = rider_profile.home_address or "Rider pickup"

        ride_request = RideRequest.objects.create(
            passenger=match.rider,
            driver=match.driver,
            pickup_location=pickup,
            dropoff_location=dropoff_point,
            pickup_address=pickup_address,
            dropoff_address=building_label,
            desired_time=desired,
            seats_needed=1,
            status="pending_rider_confirm",
            dispatch_source="schedule",
            pickup_eta_seconds={str(match.driver_id): round(driver_to_pickup_s, 1)},
            notes=(
                f"Proactive offer for {match.rider_schedule.course_name} at "
                f"{building_label}. Class starts at "
                f"{match.rider_schedule.start_time.strftime('%I:%M %p').lstrip('0')}."
            ),
        )

        match.status = "offered"
        match.ride_request = ride_request
        match.save(update_fields=["status", "ride_request", "updated_at"])

        return Response(
            {
                "match": self.get_serializer(match).data,
                "ride_request": RideRequestSerializer(ride_request).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="decline")
    def decline(self, request, pk=None):
        match = get_object_or_404(ProactiveRideMatch, pk=pk)
        if match.driver_id != request.user.id:
            return Response({"error": "Only the driver can decline."}, status=403)
        match.status = "declined"
        match.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(match).data)


# ---------------------------------------------------------------------------
# Schedule-overlap helper
# ---------------------------------------------------------------------------
def _sync_proactive_matches_for_schedule(schedule):
    """
    Walk every schedule in the opposite role that matches this schedule
    (same day, same building, start-time within 15 minutes) and make sure
    a ProactiveRideMatch row exists for each pair.
    """
    from datetime import datetime, timedelta

    if not schedule.building:
        return

    owner_profile = getattr(schedule.user, "profile", None)
    if owner_profile is None:
        return
    opposite_role = "rider" if owner_profile.role == "driver" else "driver"

    anchor = datetime.combine(datetime.today(), schedule.start_time)
    window_low = (anchor - timedelta(minutes=15)).time()
    window_high = (anchor + timedelta(minutes=15)).time()

    peers = (
        ClassSchedule.objects.select_related("user", "user__profile")
        .filter(
            day_of_week=schedule.day_of_week,
            building=schedule.building,
            start_time__gte=window_low,
            start_time__lte=window_high,
            user__profile__role=opposite_role,
        )
        .exclude(user=schedule.user)
    )

    for peer in peers:
        if owner_profile.role == "driver":
            driver_sched, rider_sched = schedule, peer
            driver_user, rider_user = schedule.user, peer.user
        else:
            driver_sched, rider_sched = peer, schedule
            driver_user, rider_user = peer.user, schedule.user

        ProactiveRideMatch.objects.get_or_create(
            driver_schedule=driver_sched,
            rider_schedule=rider_sched,
            defaults={
                "driver": driver_user,
                "rider": rider_user,
                "building": schedule.building,
                "day_of_week": schedule.day_of_week,
                "status": "open",
            },
        )
