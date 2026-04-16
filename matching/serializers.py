"""
DRF Serializers for the Ride Matching & Coordination API.

Provides serializers for:
  - ``Ride`` model (full CRUD representation).
  - Ranked match results (read-only, non-model).
  - Confirm-match request payload (write-only input).
"""

import re

from rest_framework import serializers

from matching.models import Ride
from rides.models import RideOffer, RideRequest


# ---------------------------------------------------------------------------
# Utility — extract coordinates from both Point objects and WKT strings
# ---------------------------------------------------------------------------
def _extract_coords(value):
    """
    Extract [longitude, latitude] from a GIS Point object.
    """
    if value is None:
        return None
    # If it has .x and .y attributes, it's a real Point
    if hasattr(value, "x") and hasattr(value, "y"):
        return [value.x, value.y]
    return None


# ═══════════════════════════════════════════════════════════════════════════
# Nested helpers (lightweight representations for related objects)
# ═══════════════════════════════════════════════════════════════════════════
class RideOfferSummarySerializer(serializers.ModelSerializer):
    """Compact read-only view of a RideOffer embedded inside Ride."""

    driver_name = serializers.CharField(source="driver.__str__", read_only=True)
    origin_coords = serializers.SerializerMethodField()
    destination_coords = serializers.SerializerMethodField()

    class Meta:
        model = RideOffer
        fields = [
            "id",
            "driver_name",
            "origin_coords",
            "destination_coords",
            "departure_time",
            "available_seats",
            "is_active",
        ]

    def get_origin_coords(self, obj):
        """Return origin as [longitude, latitude]."""
        return _extract_coords(obj.origin)

    def get_destination_coords(self, obj):
        """Return destination as [longitude, latitude]."""
        return _extract_coords(obj.destination)


class RideRequestSummarySerializer(serializers.ModelSerializer):
    """Compact read-only view of a RideRequest embedded inside Ride."""

    passenger_name = serializers.CharField(source="passenger.__str__", read_only=True)
    pickup_coords = serializers.SerializerMethodField()
    dropoff_coords = serializers.SerializerMethodField()

    class Meta:
        model = RideRequest
        fields = [
            "id",
            "passenger_name",
            "pickup_coords",
            "dropoff_coords",
            "desired_time",
            "status",
        ]

    def get_pickup_coords(self, obj):
        """Return pickup location as [longitude, latitude]."""
        return _extract_coords(obj.pickup_location)

    def get_dropoff_coords(self, obj):
        """Return dropoff location as [longitude, latitude]."""
        return _extract_coords(obj.dropoff_location)


# ═══════════════════════════════════════════════════════════════════════════
# Main Ride serializer
# ═══════════════════════════════════════════════════════════════════════════
class RideSerializer(serializers.ModelSerializer):
    """
    Full serializer for the ``Ride`` model.

    Read responses include nested offer / request summaries.
    """

    ride_offer_detail = RideOfferSummarySerializer(
        source="ride_offer", read_only=True
    )
    ride_requests_detail = RideRequestSummarySerializer(
        source="ride_requests", many=True, read_only=True
    )
    actual_route_geojson = serializers.SerializerMethodField()

    class Meta:
        model = Ride
        fields = [
            "id",
            "ride_offer",
            "ride_offer_detail",
            "ride_requests",
            "ride_requests_detail",
            "status",
            "actual_route_geojson",
            "total_detour_time",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]

    def get_actual_route_geojson(self, obj):
        """
        Serialize the LineStringField as a GeoJSON-compatible dict.
        Handles both real GIS objects (production) and plain values (test).
        """
        if not obj.actual_route:
            return None
        # Real GIS LineString has .coords
        if hasattr(obj.actual_route, "coords"):
            return {
                "type": "LineString",
                "coordinates": list(obj.actual_route.coords),
            }
        return None


# ═══════════════════════════════════════════════════════════════════════════
# Non-model serializers for API input / output
# ═══════════════════════════════════════════════════════════════════════════
class MatchResultSerializer(serializers.Serializer):
    """
    Read-only serializer for a single ranked match result.

    Used by the ``RankMatchesView`` to structure the API response.
    """

    ride_offer_id = serializers.IntegerField()
    driver_name = serializers.CharField()
    departure_time = serializers.CharField()
    available_seats = serializers.IntegerField()
    original_duration = serializers.FloatField(
        help_text="Original trip duration in seconds (no detour)."
    )
    detoured_duration = serializers.FloatField(
        help_text="Trip duration in seconds including the rider detour."
    )
    extra_seconds = serializers.FloatField(
        help_text="Additional seconds of travel caused by the detour."
    )


class ConfirmMatchSerializer(serializers.Serializer):
    """
    Write-only serializer for confirming a match.

    The React frontend POSTs this payload to lock in a ride.
    """

    ride_offer_id = serializers.IntegerField(
        help_text="PK of the RideOffer to confirm."
    )
    ride_request_id = serializers.IntegerField(
        help_text="PK of the RideRequest to attach."
    )
