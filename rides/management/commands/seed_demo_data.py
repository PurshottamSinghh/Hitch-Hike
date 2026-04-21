import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.gis.geos import Point
from django.contrib.auth import get_user_model
from rides.models import RideOffer, RideRequest

User = get_user_model()

class Command(BaseCommand):
    help = 'Seed Neon database with demo data around University of Toledo'

    def handle(self, *args, **options):
        self.stdout.write("Seeding data...")
        
        # 1. Clear existing entries to avoid bloat and integrity errors
        User.objects.all().delete()
        RideOffer.objects.all().delete()
        RideRequest.objects.all().delete()

        # 2. Ensure demo users exist with roles
        u1 = User.objects.create_user(username='demo_driver', password='password123', email='driver@utoledo.edu')
        u1.profile.role = 'driver'
        u1.profile.save()

        u2 = User.objects.create_user(username='demo_rider', password='password123', email='rider@utoledo.edu')
        u2.profile.role = 'rider'
        u2.profile.save()

        u3 = User.objects.create_user(username='demo_user', password='password123', email='demo@utoledo.edu')
        u3.profile.role = 'rider'
        u3.profile.save()

        # UT Toledo Base: -83.614, 41.654
        ut_lng, ut_lat = -83.614, 41.654

        # 3. Create 3 Ride Offers
        offers = [
            {"driver": u1, "offset": (0.01, 0.01), "dest_offset": (0.05, 0.05), "note": "Going to downtown"},
            {"driver": u2, "offset": (-0.02, 0.02), "dest_offset": (0.04, -0.04), "note": "Heading North"},
            {"driver": u1, "offset": (0.03, -0.01), "dest_offset": (-0.02, 0.03), "note": "Early morning commute"},
        ]

        for i, o in enumerate(offers):
            origin = Point(ut_lng + o["offset"][0], ut_lat + o["offset"][1])
            destination = Point(ut_lng + o["dest_offset"][0], ut_lat + o["dest_offset"][1])
            
            RideOffer.objects.create(
                driver=o["driver"],
                origin=origin,
                destination=destination,
                departure_time=timezone.now() + timedelta(hours=i+2),
                available_seats=random.randint(1, 4),
                price_per_seat=10.00,
                notes=o["note"]
            )

        # 4. Create 1 Ride Request
        pickup = Point(ut_lng + 0.005, ut_lat + 0.005)
        dropoff = Point(ut_lng + 0.04, ut_lat + 0.04)
        
        RideRequest.objects.create(
            passenger=u3,
            pickup_location=pickup,
            dropoff_location=dropoff,
            desired_time=timezone.now() + timedelta(hours=1),
            seats_needed=1,
            status="pending",
            notes="Need a ride to the library area."
        )

        self.stdout.write(self.style.SUCCESS('Successfully seeded Neon database with UT Toledo data.'))
