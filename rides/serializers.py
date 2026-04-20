"""
Rides serializers — Standardized for PostGIS.
"""

from rest_framework import serializers
from rest_framework_gis.serializers import GeometryField
from django.conf import settings
from django.contrib.auth.models import User
from .models import RideOffer, RideRequest, UserProfile
from gamification.serializers import UserStatsSerializer, UserAchievementSerializer


# ---------------------------------------------------------------------------
# Identity & Auth Serializers
# ---------------------------------------------------------------------------
class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["role", "home_address", "phone_number", "vehicle_info", "is_online"]


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    stats = UserStatsSerializer(source="gamification_stats", read_only=True)
    achievements = UserAchievementSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "profile", "stats", "achievements"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, write_only=True)
    home_address = serializers.CharField(write_only=True, required=False, allow_blank=True, default="")

    class Meta:
        model = User
        fields = ["username", "email", "password", "role", "home_address"]

    def validate_email(self, value):
        """Mock SSO: Enforce @utoledo.edu or @rockets.utoledo.edu domains (skipped when DEBUG)."""
        if getattr(settings, "DEBUG", False):
            return value
        valid_domains = ["@rockets.utoledo.edu", "@utoledo.edu"]
        if not any(value.lower().endswith(domain) for domain in valid_domains):
            raise serializers.ValidationError(
                "Registration restricted to UToledo accounts (@rockets or @utoledo)."
            )
        return value

    def create(self, validated_data):
        role = validated_data.pop("role")
        home_address = validated_data.pop("home_address", "") or ""
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )
        # Update the profile created by signal
        user.profile.role = role
        user.profile.home_address = home_address
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
    driver_coords = serializers.SerializerMethodField()
    driver_is_online = serializers.ReadOnlyField(source="driver.profile.is_online")

    class Meta:
        model = RideRequest
        fields = [
            "id",
            "passenger",
            "passenger_username",
            "driver",
            "driver_username",
            "driver_coords",
            "driver_is_online",
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

    def get_driver_coords(self, obj):
        if obj.driver and hasattr(obj.driver, "profile") and obj.driver.profile.current_location:
            return {
                "lng": obj.driver.profile.current_location.x,
                "lat": obj.driver.profile.current_location.y
            }
        return None
