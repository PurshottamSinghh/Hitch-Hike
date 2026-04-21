"""
Rides API views — adapted from Antardip's code.

Key adaptation: ``perform_create`` uses a demo user when the request
is from an anonymous/unauthenticated user (local development).
"""

from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import RideOffer, RideRequest, ClassSchedule
from .serializers import RideOfferSerializer, RideRequestSerializer, ClassScheduleSerializer


def _get_demo_user():
    """Get or create a demo user for anonymous API requests."""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user, _ = User.objects.get_or_create(
        username="demo_user",
        defaults={
            "first_name": "Demo",
            "last_name": "User",
            "email": "demo@hitchhike.dev",
        },
    )
    return user


class RideOfferViewSet(viewsets.ModelViewSet):
    """CRUD for ride offers. Drivers create, everyone can browse."""

    serializer_class = RideOfferSerializer
    ordering_fields = ["departure_time", "price_per_seat", "available_seats"]

    def get_queryset(self):
        queryset = RideOffer.objects.filter(is_active=True)
        user = self.request.user
        if self.action in {"update", "partial_update", "destroy"} and user.is_authenticated:
            return queryset.filter(driver=user)
        return queryset

    def perform_create(self, serializer):
        from django.contrib.auth import get_user_model
        User = get_user_model()

        user = (
            self.request.user
            if self.request.user.is_authenticated
            else User.objects.get_or_create(username='demo_user')[0]
        )
        serializer.save(driver=user)

    @action(detail=True, methods=["get"])
    def requests(self, request, pk=None):
        """List all ride requests for a specific offer."""
        ride_offer = self.get_object()
        ride_requests = ride_offer.requests.all()
        serializer = RideRequestSerializer(ride_requests, many=True)
        return Response(serializer.data)


class RideRequestViewSet(viewsets.ModelViewSet):
    """CRUD for ride requests. Passengers create, drivers manage status."""
    serializer_class = RideRequestSerializer

    def get_queryset(self):
        """
        Global broadcast logic:
        1. Show ALL requests where the current user is the passenger.
        2. Show ONLY 'pending' requests from others (broadcast).
        """
        from django.db.models import Q
        user = self.request.user
        if not user.is_authenticated:
            return RideRequest.objects.filter(status="pending")
        queryset = RideRequest.objects.filter(
            Q(passenger=user) | 
            Q(driver=user) |
            Q(status="pending")
        ).distinct()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_authenticated:
            user = _get_demo_user()
        serializer.save(passenger=user)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        """Driver accepts a ride request."""
        if not request.user.is_authenticated:
            return Response({"error": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        # Use objects.get to bypass get_queryset's restrictions
        ride_request = get_object_or_404(RideRequest, id=pk)
        if ride_request.status != "pending":
            return Response({"error": "Only pending requests can be accepted."}, status=400)
        user = request.user if request.user.is_authenticated else _get_demo_user()
        linked_offer = ride_request.ride_offer

        # If this request is a broadcast request, attach it to an active offer by this driver.
        if linked_offer is None:
            linked_offer = (
                RideOffer.objects.filter(
                    driver=user,
                    is_active=True,
                    available_seats__gte=ride_request.seats_needed,
                )
                .order_by("departure_time")
                .first()
            )
            if linked_offer is not None:
                linked_offer.available_seats = max(
                    0, linked_offer.available_seats - ride_request.seats_needed
                )
                if linked_offer.available_seats == 0:
                    linked_offer.is_active = False
                linked_offer.save(update_fields=["available_seats", "is_active", "updated_at"])

        ride_request.status = "accepted"
        ride_request.driver = user
        if linked_offer is not None:
            ride_request.ride_offer = linked_offer
        ride_request.save()

        return Response({
            "status": "accepted",
            "driver": user.username,
            "ride_request_id": ride_request.id,
            "ride_offer_id": linked_offer.id if linked_offer else None,
        })

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """Driver marks the ride as completed."""
        ride_request = get_object_or_404(RideRequest, id=pk)
        
        # Security: Only the assigned driver can complete the ride
        if not request.user.is_authenticated:
            return Response({"error": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        if (
            ride_request.driver != request.user
            and ride_request.passenger != request.user
            and not request.user.is_staff
        ):
            return Response({"error": "Only assigned driver or rider can complete this ride."}, status=403)
        if ride_request.status not in ("accepted", "matched"):
            return Response({"error": "Only accepted/matched rides can be completed."}, status=400)
        
        ride_request.status = "completed"
        ride_request.save()
        return Response({"status": "completed"})

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Driver rejects a ride request."""
        if not request.user.is_authenticated:
            return Response({"error": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        ride_request = get_object_or_404(RideRequest, id=pk)
        if ride_request.status != "pending":
            return Response({"error": "Only pending requests can be rejected."}, status=400)
        ride_request.driver = request.user
        ride_request.status = "rejected"
        ride_request.save()
        return Response({"status": "rejected"})

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Passenger cancels their own request."""
        ride_request = get_object_or_404(RideRequest, id=pk)
        if not request.user.is_authenticated:
            return Response({"error": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        if ride_request.passenger != request.user and not request.user.is_staff:
            return Response({"error": "Only the passenger can cancel this request."}, status=403)
        if ride_request.status in ("completed", "rejected"):
            return Response({"error": "Completed/rejected requests cannot be cancelled."}, status=400)
        ride_request.status = "cancelled"
        ride_request.save()
        return Response({"status": "cancelled"})


class ClassScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = ClassScheduleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ClassSchedule.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
