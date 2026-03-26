from rest_framework import serializers
from .models import RideOffer, RideRequest


class RideOfferSerializer(serializers.ModelSerializer):
    driver_username = serializers.ReadOnlyField(source='driver.username')

    class Meta:
        model = RideOffer
        fields = [
            'id', 'driver', 'driver_username',
            'origin', 'origin_lat', 'origin_lng',
            'destination', 'destination_lat', 'destination_lng',
            'departure_time', 'available_seats', 'price_per_seat',
            'notes', 'is_active', 'is_recurring', 'recurrence_days',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['driver', 'created_at', 'updated_at']


class RideRequestSerializer(serializers.ModelSerializer):
    passenger_username = serializers.ReadOnlyField(source='passenger.username')

    class Meta:
        model = RideRequest
        fields = [
            'id', 'passenger', 'passenger_username',
            'ride_offer',
            'pickup_location', 'pickup_lat', 'pickup_lng',
            'dropoff_location', 'dropoff_lat', 'dropoff_lng',
            'desired_time', 'seats_needed', 'status',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['passenger', 'status', 'created_at', 'updated_at']