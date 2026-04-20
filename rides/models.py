"""
Ride models — Standardized for PostGIS.
"""

from django.conf import settings
from django.db import models
from django.contrib.gis.db import models as gis_models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User


# ---------------------------------------------------------------------------
# User Profile & Roles
# ---------------------------------------------------------------------------
class UserProfile(models.Model):
    ROLE_CHOICES = [
        ("rider", "Rider"),
        ("driver", "Driver"),
    ]

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="profile"
    )
    role = models.CharField(
        max_length=10, choices=ROLE_CHOICES, default="rider"
    )
    home_address = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Onboarding home or neighborhood text (not exact coords for other users).",
    )
    phone_number = models.CharField(max_length=20, blank=True)
    vehicle_info = models.JSONField(
        null=True, blank=True, help_text="Car model, plate, color"
    )
    is_online = models.BooleanField(default=False)
    current_location = gis_models.PointField(geography=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(
            user=instance,
            defaults={"home_address": ""},
        )


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()


# ---------------------------------------------------------------------------
# RideOffer  (Driver posts an offer)
# ---------------------------------------------------------------------------
class RideOffer(models.Model):
    """A driver offers a ride with route, time, and available seats."""

    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="offered_rides",
    )
    origin = gis_models.PointField(geography=True)
    destination = gis_models.PointField(geography=True)
    departure_time = models.DateTimeField()
    available_seats = models.PositiveIntegerField(default=1)
    price_per_seat = models.DecimalField(
        max_digits=8, decimal_places=2, default=0.00
    )
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_recurring = models.BooleanField(default=False)
    recurrence_days = models.CharField(
        max_length=50,
        blank=True,
        help_text="Comma-separated days: mon,tue,wed,thu,fri,sat,sun",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-departure_time"]

    def __str__(self):
        return f"Offer #{self.pk} by {self.driver} ({self.available_seats} seats)"


# ---------------------------------------------------------------------------
# RideRequest  (Rider posts a request)
# ---------------------------------------------------------------------------
class RideRequest(models.Model):
    """A passenger requests a ride."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("matched", "Matched"),
        ("rejected", "Rejected"),
        ("cancelled", "Cancelled"),
        ("completed", "Completed"),
    ]

    passenger = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="requested_rides",
    )
    ride_offer = models.ForeignKey(
        RideOffer,
        on_delete=models.CASCADE,
        related_name="requests",
        null=True,
        blank=True,
    )
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="accepted_ride_requests",
        null=True,
        blank=True,
    )
    pickup_location = gis_models.PointField(geography=True)
    dropoff_location = gis_models.PointField(geography=True)
    desired_time = models.DateTimeField()
    seats_needed = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending"
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Request #{self.pk} by {self.passenger} ({self.status})"
