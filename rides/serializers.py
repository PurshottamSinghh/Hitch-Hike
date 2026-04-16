"""
Rides serializers — Standardized for PostGIS.
"""

from rest_framework import serializers
from rest_framework_gis.serializers import GeometryField
from django.contrib.auth.models import User
from .models import RideOffer, RideRequest, UserProfile


# ---------------------------------------------------------------------------
# Identity & Auth Serializers
# ---------------------------------------------------------------------------
class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["role", "phone_number", "vehicle_info", "is_online"]


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "profile"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "role"]

    def create(self, validated_data):
        role = validated_data.pop("role")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )
        # Update the profile created by signal
        user.profile.role = role
        user.profile.save()
        return user


# ---------------------------------------------------------------------------
# Rides Serializers
# ---------------------------------------------------------------------------
class RideOfferSerializer(serializers.ModelSerializer):
    driver_username = serializers.ReadOnlyField(source="driver.username")
    origin = GeometryField()
    destination = GeometryField()

    class Meta:
        model = RideOffer
        fields = [
            "id",
            "driver",
            "driver_username",
            "origin",
            "destination",
            "departure_time",
            "available_seats",
            "price_per_seat",
            "notes",
            "is_active",
            "is_recurring",
            "recurrence_days",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["driver", "created_at", "updated_at"]


class RideRequestSerializer(serializers.ModelSerializer):
    passenger_username = serializers.ReadOnlyField(source="passenger.username")
    driver_username = serializers.ReadOnlyField(source="driver.username")
    pickup_location = GeometryField()
    dropoff_location = GeometryField()

    class Meta:
        model = RideRequest
        fields = [
            "id",
            "passenger",
            "passenger_username",
            "driver",
            "driver_username",
            "ride_offer",
            "pickup_location",
            "dropoff_location",
            "desired_time",
            "seats_needed",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["passenger", "driver", "status", "created_at", "updated_at"]
