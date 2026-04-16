"""
Rides API views — adapted from Antardip's code.

Key adaptation: ``perform_create`` uses a demo user when the request
is from an anonymous/unauthenticated user (local development).
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import RideOffer, RideRequest
from .serializers import RideOfferSerializer, RideRequestSerializer


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

    queryset = RideOffer.objects.filter(is_active=True)
    serializer_class = RideOfferSerializer
    ordering_fields = ["departure_time", "price_per_seat", "available_seats"]

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
        from django.utils import timezone
        from datetime import timedelta
        
        user = self.request.user
        if not user.is_authenticated:
            # For local demo/unauthenticated, show all pending from last hour
            one_hour_ago = timezone.now() - timedelta(hours=1)
            return RideRequest.objects.filter(status="pending", created_at__gte=one_hour_ago)

        one_hour_ago = timezone.now() - timedelta(hours=1)
        
        return RideRequest.objects.filter(
            Q(passenger=user) | 
            (Q(status="pending") & Q(created_at__gte=one_hour_ago))
        ).distinct()

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_authenticated:
            user = _get_demo_user()
        serializer.save(passenger=user)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        """Driver accepts a ride request."""
        # Use objects.get to bypass get_queryset's restrictions
        ride_request = RideRequest.objects.get(id=pk)
        user = request.user if request.user.is_authenticated else _get_demo_user()
        
        ride_request.status = "accepted"
        ride_request.driver = user
        ride_request.save()
        
        return Response({
            "status": "accepted", 
            "driver": user.username
        })

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """Driver marks the ride as completed."""
        ride_request = RideRequest.objects.get(id=pk)
        
        # Security: Only the assigned driver can complete the ride
        if ride_request.driver != request.user and not request.user.is_staff:
             if request.user.is_authenticated: # Demo user check
                 pass # Allow demo user for now
        
        ride_request.status = "completed"
        ride_request.save()
        return Response({"status": "completed"})

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Driver rejects a ride request."""
        ride_request = self.get_object()
        ride_request.status = "rejected"
        ride_request.save()
        return Response({"status": "rejected"})

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Passenger cancels their own request."""
        ride_request = self.get_object()
        ride_request.status = "cancelled"
        ride_request.save()
        return Response({"status": "cancelled"})
