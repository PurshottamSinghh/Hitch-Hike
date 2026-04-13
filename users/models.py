"""
Placeholder models for User, RideOffer, and RideRequest.

These are stubs so the ``matching`` app can reference them via ForeignKey /
ManyToMany relationships.  Your teammates who own the User & Ride modules
should replace these with their production-ready implementations.

When merging, update the FK references in ``matching/models.py`` if field
names differ.
"""

from django.contrib.auth.models import AbstractUser
from django.db import models

# ---------------------------------------------------------------------------
# GDAL fallback — allows tests to run on plain SQLite (no GDAL required).
# In production (PostGIS), the real PointField is used.
# ---------------------------------------------------------------------------
try:
    from django.contrib.gis.db import models as gis_models
except Exception:
    # GDAL not installed — create a mock gis_models module with
    # PointField falling back to a CharField (stores "lng,lat" text).
    gis_models = models

    class _FakePointField(models.CharField):
        """Stand-in for PointField when GDAL/PostGIS is unavailable."""
        def __init__(self, *args, **kwargs):
            kwargs.pop("srid", None)
            kwargs.pop("geography", None)
            kwargs.setdefault("max_length", 100)
            kwargs.setdefault("default", "POINT(0 0)")
            super().__init__(*args, **kwargs)

        class _FakePoint:
            """Minimal object with .x and .y attributes."""
            def __init__(self, val):
                self._val = val
            @property
            def x(self):
                return 0.0
            @property
            def y(self):
                return 0.0

    gis_models.PointField = _FakePointField


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------
class User(AbstractUser):
    """
    Custom user model — extends Django's AbstractUser.

    Add any additional profile fields here (e.g., university email,
    phone number, profile picture URL).
    """

    phone_number = models.CharField(max_length=20, blank=True, default="")
    university_email = models.EmailField(blank=True, default="")

    class Meta:
        db_table = "users_user"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.get_full_name() or self.username


# ---------------------------------------------------------------------------
# RideOffer  (Driver posts an offer)
# ---------------------------------------------------------------------------
class RideOffer(models.Model):
    """A driver's offer to share a ride along a particular route."""

    STATUS_CHOICES = [
        ("active", "Active"),
        ("full", "Full"),
        ("cancelled", "Cancelled"),
        ("completed", "Completed"),
    ]

    driver = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="ride_offers",
    )
    origin = gis_models.PointField(srid=4326, help_text="Driver start location (lng, lat)")
    destination = gis_models.PointField(srid=4326, help_text="Driver end location (lng, lat)")
    departure_time = models.DateTimeField()
    available_seats = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users_rideoffer"
        ordering = ["-departure_time"]

    def __str__(self):
        return f"Offer #{self.pk} by {self.driver} ({self.status})"


# ---------------------------------------------------------------------------
# RideRequest  (Rider posts a request)
# ---------------------------------------------------------------------------
class RideRequest(models.Model):
    """A rider's request to be picked up and dropped off."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("matched", "Matched"),
        ("cancelled", "Cancelled"),
        ("completed", "Completed"),
    ]

    rider = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="ride_requests",
    )
    pickup_location = gis_models.PointField(
        srid=4326,
        help_text="Desired pickup point (lng, lat)",
    )
    dropoff_location = gis_models.PointField(
        srid=4326,
        help_text="Desired dropoff point (lng, lat)",
    )
    requested_time = models.DateTimeField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "users_riderequest"
        ordering = ["-requested_time"]

    def __str__(self):
        return f"Request #{self.pk} by {self.rider} ({self.status})"
