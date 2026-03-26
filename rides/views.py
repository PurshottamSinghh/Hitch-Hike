from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import RideOffer, RideRequest
from .serializers import RideOfferSerializer, RideRequestSerializer


class RideOfferViewSet(viewsets.ModelViewSet):
    """CRUD for ride offers. Drivers create, everyone can browse."""

    queryset = RideOffer.objects.filter(is_active=True)
    serializer_class = RideOfferSerializer
    filterset_fields = ['is_recurring', 'is_active']
    search_fields = ['origin', 'destination']
    ordering_fields = ['departure_time', 'price_per_seat', 'available_seats']

    def perform_create(self, serializer):
        serializer.save(driver=self.request.user)

    @action(detail=True, methods=['get'])
    def requests(self, request, pk=None):
        """List all ride requests for a specific offer."""
        ride_offer = self.get_object()
        requests = ride_offer.requests.all()
        serializer = RideRequestSerializer(requests, many=True)
        return Response(serializer.data)


class RideRequestViewSet(viewsets.ModelViewSet):
    """CRUD for ride requests. Passengers create, drivers manage status."""

    queryset = RideRequest.objects.all()
    serializer_class = RideRequestSerializer
    filterset_fields = ['status', 'ride_offer']
    ordering_fields = ['desired_time', 'created_at']

    def perform_create(self, serializer):
        serializer.save(passenger=self.request.user)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Driver accepts a ride request."""
        ride_request = self.get_object()
        ride_request.status = 'accepted'
        ride_request.save()
        return Response({'status': 'accepted'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Driver rejects a ride request."""
        ride_request = self.get_object()
        ride_request.status = 'rejected'
        ride_request.save()
        return Response({'status': 'rejected'})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Passenger cancels their own request."""
        ride_request = self.get_object()
        ride_request.status = 'cancelled'
        ride_request.save()
        return Response({'status': 'cancelled'})