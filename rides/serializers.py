"""
Rides serializers — Standardized for PostGIS.
"""

from rest_framework import serializers
from rest_framework_gis.serializers import GeometryField
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.models import User
from .models import (
    ClassSchedule,
    ProactiveRideMatch,
    RideOffer,
    RideRequest,
    UserProfile,
)
from gamification.serializers import UserStatsSerializer, UserAchievementSerializer
from .auth_utils import get_allowed_campus_domains, is_campus_email


# ---------------------------------------------------------------------------
# Identity & Auth Serializers
# ---------------------------------------------------------------------------
class UserProfileSerializer(serializers.ModelSerializer):
    current_location = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            "role",
            "home_address",
            "phone_number",
            "vehicle_info",
            "is_online",
            "notify_on_ride_request",
            "current_location",
        ]

    def get_current_location(self, obj):
        if obj.current_location is None:
            return None
        return {"lng": obj.current_location.x, "lat": obj.current_location.y}


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
    notify_on_ride_request = serializers.BooleanField(required=False)

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


class RideRequestSerializer(serializers.ModelSerializer):
    passenger_username = serializers.ReadOnlyField(source="passenger.username")
    driver_username = serializers.ReadOnlyField(source="driver.username")
    pickup_location = GeometryField()
    dropoff_location = GeometryField()
    driver_coords = serializers.SerializerMethodField()
    eligible_count = serializers.SerializerMethodField()

    class Meta:
        model = RideRequest
        fields = [
            "id",
            "passenger",
            "passenger_username",
            "driver",
            "driver_username",
            "driver_coords",
            "pickup_location",
            "dropoff_location",
            "pickup_address",
            "dropoff_address",
            "desired_time",
            "seats_needed",
            "status",
            "dispatch_source",
            "eligible_driver_ids",
            "rejected_driver_ids",
            "pickup_eta_seconds",
            "eligible_count",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "passenger",
            "driver",
            "status",
            "dispatch_source",
            "eligible_driver_ids",
            "rejected_driver_ids",
            "pickup_eta_seconds",
            "created_at",
            "updated_at",
        ]

    def get_driver_coords(self, obj):
        if obj.driver and hasattr(obj.driver, "profile") and obj.driver.profile.current_location:
            return {
                "lng": obj.driver.profile.current_location.x,
                "lat": obj.driver.profile.current_location.y,
            }
        return None

    def get_eligible_count(self, obj):
        return len(obj.eligible_driver_ids or [])

    def validate_seats_needed(self, value):
        if value < 1 or value > 4:
            raise serializers.ValidationError("Seats needed must be between 1 and 4.")
        return value

    def validate_desired_time(self, value):
        if value < timezone.now() - timedelta(minutes=5):
            raise serializers.ValidationError("Desired time cannot be in the past.")
        return value


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
            "building",
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


class ProactiveRideMatchSerializer(serializers.ModelSerializer):
    driver_username = serializers.ReadOnlyField(source="driver.username")
    rider_username = serializers.ReadOnlyField(source="rider.username")
    driver_schedule_detail = ClassScheduleSerializer(source="driver_schedule", read_only=True)
    rider_schedule_detail = ClassScheduleSerializer(source="rider_schedule", read_only=True)

    class Meta:
        model = ProactiveRideMatch
        fields = [
            "id",
            "driver",
            "driver_username",
            "rider",
            "rider_username",
            "driver_schedule",
            "driver_schedule_detail",
            "rider_schedule",
            "rider_schedule_detail",
            "building",
            "day_of_week",
            "status",
            "ride_request",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
