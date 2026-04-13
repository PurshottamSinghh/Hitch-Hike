"""
Ride model — the core data structure for Functionality 3.

Links a RideOffer to one or more RideRequests and stores the matched ride's
status, geographic route, and total detour time.
"""

from django.db import models

# ---------------------------------------------------------------------------
# GDAL fallback — allows tests to run on plain SQLite (no GDAL required).
# In production (PostGIS), the real LineStringField is used.
# ---------------------------------------------------------------------------
try:
    from django.contrib.gis.db import models as gis_models
except Exception:
    gis_models = models

    class _FakeLineStringField(models.TextField):
        """Stand-in for LineStringField when GDAL/PostGIS is unavailable."""
        def __init__(self, *args, **kwargs):
            kwargs.pop("srid", None)
            kwargs.pop("geography", None)
            super().__init__(*args, **kwargs)

    gis_models.LineStringField = _FakeLineStringField

from users.models import RideOffer, RideRequest


class Ride(models.Model):
    """
    Represents a confirmed (or pending) carpool ride.

    A single ``RideOffer`` can serve multiple ``RideRequest``s — the
    ManyToMany relationship captures all riders assigned to this ride.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("completed", "Completed"),
    ]

    ride_offer = models.ForeignKey(
        RideOffer,
        on_delete=models.CASCADE,
        related_name="rides",
        help_text="The driver's ride offer this ride is based on.",
    )
    ride_requests = models.ManyToManyField(
        RideRequest,
        related_name="rides",
        blank=True,
        help_text="Rider requests assigned to this ride.",
    )
    status = models.CharField(
        max_length=12,
        choices=STATUS_CHOICES,
        default="pending",
        db_index=True,
        help_text="Current lifecycle stage of the ride.",
    )
    actual_route = gis_models.LineStringField(
        srid=4326,
        null=True,
        blank=True,
        help_text="Geographic path of the ride (stored as a GeoJSON LineString).",
    )
    total_detour_time = models.IntegerField(
        default=0,
        help_text="Total detour time in seconds caused by picking up / dropping off riders.",
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "matching_ride"
        ordering = ["-created_at"]
        verbose_name = "Ride"
        verbose_name_plural = "Rides"

    def __str__(self):
        return (
            f"Ride #{self.pk} — Offer #{self.ride_offer_id} "
            f"[{self.get_status_display()}]"
        )
