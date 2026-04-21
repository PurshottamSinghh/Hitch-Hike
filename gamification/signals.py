from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
from matching.models import Ride
from rides.models import RideRequest
from django.contrib.auth import get_user_model
from .models import UserStats, PointTransaction, Achievement, UserAchievement

User = get_user_model()

@receiver(post_save, sender=User)
def create_user_stats(sender, instance, created, **kwargs):
    """Automatically create UserStats when a new User is created."""
    if created:
        UserStats.objects.get_or_create(user=instance)

@receiver(post_save, sender=Ride)
def handle_ride_status_change(sender, instance, created, **kwargs):
    """Award points when a legacy Ride object is completed."""
    if instance.status == 'completed':
        driver = instance.ride_offer.driver
        award_points(driver, 50, 'RIDE_GIVEN', f"Completed ride #{instance.pk} as driver")
        requests = instance.ride_requests.all()
        for req in requests:
            passenger = req.passenger
            award_points(passenger, 20, 'RIDE_TAKEN', f"Completed ride #{instance.pk} as passenger")
        update_stats_on_completion(instance)


@receiver(pre_save, sender=RideRequest)
def _stash_prev_ride_request_status(sender, instance, **kwargs):
    """Record the previous status so post_save can detect transitions."""
    if instance.pk:
        try:
            instance._prev_status = (
                RideRequest.objects.only("status").get(pk=instance.pk).status
            )
        except RideRequest.DoesNotExist:
            instance._prev_status = None
    else:
        instance._prev_status = None


@receiver(post_save, sender=RideRequest)
def handle_ride_request_completion(sender, instance, created, **kwargs):
    """Award points + update stats on RideRequest -> completed transitions."""
    if created:
        return
    prev_status = getattr(instance, "_prev_status", None)
    if prev_status == "completed" or instance.status != "completed":
        return

    if instance.driver_id:
        award_points(
            instance.driver,
            50,
            "RIDE_GIVEN",
            f"Completed ride request #{instance.pk} as driver",
        )
        driver_stats, _ = UserStats.objects.get_or_create(user=instance.driver)
        driver_stats.rides_given += 1
        update_streak(driver_stats)
        driver_stats.save()

    if instance.passenger_id:
        award_points(
            instance.passenger,
            20,
            "RIDE_TAKEN",
            f"Completed ride request #{instance.pk} as passenger",
        )
        rider_stats, _ = UserStats.objects.get_or_create(user=instance.passenger)
        rider_stats.rides_taken += 1
        update_streak(rider_stats)
        rider_stats.save()

def award_points(user, amount, transaction_type, description=""):
    """Utility to award points and log transaction."""
    stats, _ = UserStats.objects.get_or_create(user=user)
    stats.total_points += amount
    stats.save()
    
    PointTransaction.objects.create(
        user=user,
        amount=amount,
        transaction_type=transaction_type,
        description=description
    )
    
    # Check for achievements
    check_achievements(user)

def update_stats_on_completion(ride):
    """Update ride counts and streaks."""
    # Driver stats
    driver = ride.ride_offer.driver
    driver_stats, _ = UserStats.objects.get_or_create(user=driver)
    driver_stats.rides_given += 1
    update_streak(driver_stats)
    driver_stats.save()
    
    # Passenger stats
    requests = ride.ride_requests.all()
    for req in requests:
        passenger = req.passenger
        rider_stats, _ = UserStats.objects.get_or_create(user=passenger)
        rider_stats.rides_taken += 1
        update_streak(rider_stats)
        rider_stats.save()


def update_streak(stats):
    """Simple daily streak logic."""
    today = timezone.now().date()
    if stats.last_activity_date:
        diff = (today - stats.last_activity_date).days
        if diff == 1:
            stats.current_streak += 1
        elif diff > 1:
            stats.current_streak = 1
        # if diff == 0, streak stays same (multiple rides in one day)
    else:
        stats.current_streak = 1
    
    if stats.current_streak > stats.max_streak:
        stats.max_streak = stats.current_streak
    
    stats.last_activity_date = today

def check_achievements(user):
    """Check if user met any new achievement criteria."""
    stats = user.gamification_stats
    achievements = Achievement.objects.exclude(userachievement__user=user)
    
    for ach in achievements:
        val = getattr(stats, ach.criteria_type, 0)
        if val >= ach.required_value:
            UserAchievement.objects.get_or_create(user=user, achievement=ach)
