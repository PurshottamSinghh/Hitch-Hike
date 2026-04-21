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
# University of Toledo building options (used by the matching engine to
# decide when two class schedules share the same destination).
# ---------------------------------------------------------------------------
BUILDING_CHOICES = [
    ("", "Unspecified"),
    ("bancroft_campus", "Bancroft (Main) Campus"),
    ("student_union", "Thompson Student Union"),
    ("memorial_field_house", "Memorial Field House"),
    ("university_hall", "University Hall"),
    ("mulford_library", "Mulford Health Sciences Library"),
    ("carlson_library", "Carlson Library"),
    ("rocket_hall", "Rocket Hall"),
    ("engineering_nitschke", "Nitschke Hall (Engineering)"),
    ("engineering_palmer", "Palmer Hall"),
    ("engineering_north", "North Engineering"),
    ("stranahan_hall", "Stranahan Hall (Business)"),
    ("health_education_building", "Health Education Building"),
    ("savage_arena", "Savage Arena"),
    ("glass_bowl", "Glass Bowl Stadium"),
    ("wolfe_hall", "Wolfe Hall"),
    ("bowman_oddy", "Bowman-Oddy Labs"),
    ("mcmaster_hall", "McMaster Hall"),
    ("scott_park_campus", "Scott Park Campus"),
    ("health_science_campus", "Health Science Campus"),
    ("off_campus", "Off-Campus / Other"),
]


# Approximate (lng, lat) for each UToledo building. Used as the
# dropoff coordinate for schedule-based proactive ride offers so the
# ride page can draw driver → rider → class map.
BUILDING_COORDS: dict[str, tuple[float, float]] = {
    "bancroft_campus": (-83.6131, 41.6605),
    "student_union": (-83.6127, 41.6600),
    "memorial_field_house": (-83.6135, 41.6591),
    "university_hall": (-83.6145, 41.6609),
    "mulford_library": (-83.6141, 41.6134),
    "carlson_library": (-83.6137, 41.6603),
    "rocket_hall": (-83.6161, 41.6592),
    "engineering_nitschke": (-83.6117, 41.6611),
    "engineering_palmer": (-83.6116, 41.6604),
    "engineering_north": (-83.6112, 41.6615),
    "stranahan_hall": (-83.6153, 41.6606),
    "health_education_building": (-83.6144, 41.6123),
    "savage_arena": (-83.6158, 41.6576),
    "glass_bowl": (-83.6168, 41.6576),
    "wolfe_hall": (-83.6133, 41.6613),
    "bowman_oddy": (-83.6128, 41.6618),
    "mcmaster_hall": (-83.6129, 41.6615),
    "scott_park_campus": (-83.6010, 41.6389),
    "health_science_campus": (-83.6141, 41.6134),
    "off_campus": (-83.6131, 41.6605),
}
BUILDING_LABELS: dict[str, str] = {slug: label for slug, label in BUILDING_CHOICES}


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
    notify_on_ride_request = models.BooleanField(
        default=True,
        help_text=(
            "When enabled, drivers may be alerted via the in-app dispatch modal "
            "whenever a rider within a 5-minute pickup radius submits a request."
        ),
    )
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
# RideOffer  (Driver posts an offer) — legacy support only. New flow does not
# require drivers to pre-post an offer; drivers are matched directly from
# their `UserProfile.current_location` to each incoming `RideRequest`.
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
        ("no_drivers_available", "No drivers available"),
        ("pending_rider_confirm", "Proactive offer — waiting for rider"),
    ]

    DISPATCH_SOURCE_CHOICES = [
        ("manual", "Manual request"),
        ("schedule", "Proactive schedule match"),
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
    pickup_address = models.CharField(max_length=255, blank=True, default="")
    dropoff_address = models.CharField(max_length=255, blank=True, default="")
    desired_time = models.DateTimeField()
    seats_needed = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=24, choices=STATUS_CHOICES, default="pending"
    )
    dispatch_source = models.CharField(
        max_length=16,
        choices=DISPATCH_SOURCE_CHOICES,
        default="manual",
    )
    eligible_driver_ids = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            "User IDs of drivers whose current location is within a 5-minute "
            "pickup window of the rider. Populated at request creation time; "
            "drivers are removed from this list as they reject."
        ),
    )
    rejected_driver_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="User IDs of drivers who explicitly declined this request.",
    )
    pickup_eta_seconds = models.JSONField(
        default=dict,
        blank=True,
        help_text="Map of driver_id -> driver→pickup travel time in seconds (at dispatch time).",
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Request #{self.pk} by {self.passenger} ({self.status})"


class ClassSchedule(models.Model):
    DAY_CHOICES = [
        ("mon", "Monday"),
        ("tue", "Tuesday"),
        ("wed", "Wednesday"),
        ("thu", "Thursday"),
        ("fri", "Friday"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="class_schedules",
    )
    course_name = models.CharField(max_length=120)
    course_code = models.CharField(max_length=30, blank=True, default="")
    day_of_week = models.CharField(max_length=3, choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    building = models.CharField(
        max_length=40,
        choices=BUILDING_CHOICES,
        default="",
        blank=True,
        help_text="Canonical UToledo building — used by the proactive matcher.",
    )
    location = models.CharField(max_length=120, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["day_of_week", "start_time"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "day_of_week", "start_time", "end_time", "course_name"],
                name="unique_user_class_block",
            ),
        ]

    def __str__(self):
        return f"{self.user.username}: {self.course_name} ({self.day_of_week})"


# ---------------------------------------------------------------------------
# ProactiveRideMatch — synthesized when a driver and rider have overlapping
# class schedules (same building, same day, start-time within 15 minutes).
# Drivers see these as "Suggested rides" in their dispatcher; tapping Accept
# generates a RideRequest on the rider's behalf in status `pending_rider_confirm`.
# ---------------------------------------------------------------------------
class ProactiveRideMatch(models.Model):
    STATUS_CHOICES = [
        ("open", "Open"),
        ("offered", "Offered to rider"),
        ("declined", "Declined by driver"),
        ("expired", "Expired"),
    ]

    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="proactive_matches_as_driver",
    )
    rider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="proactive_matches_as_rider",
    )
    driver_schedule = models.ForeignKey(
        ClassSchedule,
        on_delete=models.CASCADE,
        related_name="proactive_matches_as_driver",
    )
    rider_schedule = models.ForeignKey(
        ClassSchedule,
        on_delete=models.CASCADE,
        related_name="proactive_matches_as_rider",
    )
    building = models.CharField(max_length=40, choices=BUILDING_CHOICES, default="")
    day_of_week = models.CharField(max_length=3, choices=ClassSchedule.DAY_CHOICES)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="open")
    ride_request = models.ForeignKey(
        RideRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="proactive_matches",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["driver_schedule", "rider_schedule"],
                name="unique_proactive_match_per_schedule_pair",
            ),
        ]

    def __str__(self):
        return (
            f"ProactiveRideMatch #{self.pk} "
            f"(driver={self.driver_id}, rider={self.rider_id}, status={self.status})"
        )
