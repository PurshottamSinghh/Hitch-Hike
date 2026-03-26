from django.db import models
from django.conf import settings


class RideOffer(models.Model):
    """A driver offers a ride with route, time, and available seats."""

    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ride_offers',
    )
    origin = models.CharField(max_length=255)
    origin_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    origin_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    destination = models.CharField(max_length=255)
    destination_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    destination_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    departure_time = models.DateTimeField()
    available_seats = models.PositiveIntegerField(default=1)
    price_per_seat = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_recurring = models.BooleanField(default=False)
    recurrence_days = models.CharField(
        max_length=50,
        blank=True,
        help_text='Comma-separated days: mon,tue,wed,thu,fri,sat,sun',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-departure_time']

    def __str__(self):
        return f"{self.origin} → {self.destination} by {self.driver}"


class RideRequest(models.Model):
    """A passenger requests a ride."""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]

    passenger = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ride_requests',
    )
    ride_offer = models.ForeignKey(
        RideOffer,
        on_delete=models.CASCADE,
        related_name='requests',
        null=True,
        blank=True,
    )
    pickup_location = models.CharField(max_length=255)
    pickup_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    pickup_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    dropoff_location = models.CharField(max_length=255)
    dropoff_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    dropoff_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    desired_time = models.DateTimeField()
    seats_needed = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.passenger} → {self.dropoff_location} ({self.status})"