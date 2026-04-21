from django.test import TestCase
from django.contrib.auth import get_user_model
from matching.models import Ride
from users.models import RideOffer, RideRequest
from gamification.models import UserStats, PointTransaction
from django.utils import timezone

User = get_user_model()

class GamificationSignalTest(TestCase):
    def setUp(self):
        self.driver = User.objects.create_user(username='driver', password='password')
        self.rider = User.objects.create_user(username='rider', password='password')
        
        # Create RideOffer
        self.offer = RideOffer.objects.create(
            driver=self.driver,
            origin="POINT(0 0)",
            destination="POINT(1 1)",
            departure_time=timezone.now() + timezone.timedelta(hours=1),
            available_seats=4
        )
        
        # Create RideRequest
        self.request = RideRequest.objects.create(
            rider=self.rider,
            pickup_location="POINT(0 0)",
            dropoff_location="POINT(1 1)",
            requested_time=timezone.now() + timezone.timedelta(hours=1)
        )
        
        # Create Ride
        self.ride = Ride.objects.create(
            ride_offer=self.offer,
            status='pending'
        )
        self.ride.ride_requests.add(self.request)

    def test_points_awarded_on_completion(self):
        """Test that driver and rider get points when ride status is set to 'completed'."""
        self.ride.status = 'completed'
        self.ride.save()
        
        # Check driver stats
        driver_stats = UserStats.objects.get(user=self.driver)
        self.assertEqual(driver_stats.total_points, 50)
        self.assertEqual(driver_stats.rides_given, 1)
        
        # Check rider stats
        rider_stats = UserStats.objects.get(user=self.rider)
        self.assertEqual(rider_stats.total_points, 20)
        self.assertEqual(rider_stats.rides_taken, 1)
        
        # Check transactions
        self.assertEqual(PointTransaction.objects.filter(user=self.driver).count(), 1)
        self.assertEqual(PointTransaction.objects.filter(user=self.rider).count(), 1)
