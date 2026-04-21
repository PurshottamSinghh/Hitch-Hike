"""
Rides serializers — Standardized for PostGIS.
"""

from rest_framework import serializers
from rest_framework_gis.serializers import GeometryField
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.models import User
from .models import RideOffer, RideRequest, UserProfile, ClassSchedule
from gamification.serializers import UserStatsSerializer, UserAchievementSerializer
from .auth_utils import get_allowed_campus_domains, is_campus_email


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
        """Enforce UToledo email domains at registration time."""
        if not is_campus_email(value):
            raise serializers.ValidationError(
                f"Registration restricted to UToledo accounts ({', '.join(get_allowed_campus_domains())})."
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


class ProfileUpdateSerializer(serializers.Serializer):
    username = serializers.CharField(required=False, max_length=150)
    email = serializers.EmailField(required=False)
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, required=False)
    home_address = serializers.CharField(required=False, allow_blank=True, max_length=255)
    phone_number = serializers.CharField(required=False, allow_blank=True, max_length=20)

    def validate_email(self, value):
        if not is_campus_email(value):
            raise serializers.ValidationError(
                f"Email must use a UToledo domain ({', '.join(get_allowed_campus_domains())})."
            )

        request = self.context.get("request")
        if not request or not request.user:
            return value

        if (
            User.objects.filter(email__iexact=value)
            .exclude(id=request.user.id)
            .exists()
        ):
            raise serializers.ValidationError("This email is already in use.")

        return value

    def validate_username(self, value):
        request = self.context.get("request")
        if not request or not request.user:
            return value

        if (
            User.objects.filter(username__iexact=value)
            .exclude(id=request.user.id)
            .exists()
        ):
            raise serializers.ValidationError("This username is already in use.")

        return value


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

    def validate_available_seats(self, value):
        if value < 1:
            raise serializers.ValidationError("Available seats must be at least 1.")
        if value > 6:
            raise serializers.ValidationError("Available seats cannot exceed 6.")
        return value

    def validate_departure_time(self, value):
        min_time = timezone.now() - timedelta(minutes=5)
        if value < min_time:
            raise serializers.ValidationError("Departure time cannot be in the past.")
        return value

    def validate(self, attrs):
        is_recurring = attrs.get("is_recurring", getattr(self.instance, "is_recurring", False))
        recurrence_days = attrs.get("recurrence_days", getattr(self.instance, "recurrence_days", ""))
        if is_recurring and not recurrence_days.strip():
            raise serializers.ValidationError(
                {"recurrence_days": "Recurrence days are required when recurring is enabled."}
            )
        return attrs


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

    def validate_seats_needed(self, value):
        if value < 1:
            raise serializers.ValidationError("Seats needed must be at least 1.")
        if value > 4:
            raise serializers.ValidationError("Seats needed cannot exceed 4.")
        return value

    def validate_desired_time(self, value):
        min_time = timezone.now() - timedelta(minutes=5)
        if value < min_time:
            raise serializers.ValidationError("Desired time cannot be in the past.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        ride_offer = attrs.get("ride_offer")
        seats_needed = attrs.get("seats_needed", getattr(self.instance, "seats_needed", 1))
        if ride_offer:
            if not ride_offer.is_active:
                raise serializers.ValidationError({"ride_offer": "Selected offer is no longer active."})
            if seats_needed > ride_offer.available_seats:
                raise serializers.ValidationError(
                    {"seats_needed": "Selected offer does not have enough seats available."}
                )
        return attrs


class ClassScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassSchedule
        fields = [
            "id",
            "user",
            "course_name",
            "course_code",
            "day_of_week",
            "start_time",
            "end_time",
            "location",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["user", "created_at", "updated_at"]

    def validate(self, attrs):
        start_time = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end_time = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError({"end_time": "End time must be after start time."})
        return attrs
