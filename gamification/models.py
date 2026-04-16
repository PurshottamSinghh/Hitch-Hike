from django.db import models
from django.conf import settings

class UserStats(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='gamification_stats'
    )
    total_points = models.IntegerField(default=0)
    current_streak = models.IntegerField(default=0)
    max_streak = models.IntegerField(default=0)
    rides_given = models.IntegerField(default=0)
    rides_taken = models.IntegerField(default=0)
    last_activity_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"Stats for {self.user.username}"

    class Meta:
        verbose_name_plural = "User Stats"

class Achievement(models.Model):
    ACHIEVEMENT_TYPES = (
        ('MILESTONE', 'Milestone'),
        ('STREAK', 'Streak'),
        ('SPECIAL', 'Special'),
    )
    
    name = models.CharField(max_length=100)
    description = models.TextField()
    badge_icon = models.ImageField(upload_to='badges/', null=True, blank=True)
    achievement_type = models.CharField(max_length=20, choices=ACHIEVEMENT_TYPES, default='MILESTONE')
    required_value = models.IntegerField(help_text="Value required to unlock (e.g., 10 rides)")
    criteria_type = models.CharField(max_length=50, help_text="e.g., rides_given, total_points")

    def __str__(self):
        return self.name

class UserAchievement(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='achievements')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE)
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'achievement')

    def __str__(self):
        return f"{self.user.username} earned {self.achievement.name}"

class PointTransaction(models.Model):
    TRANSACTION_TYPES = (
        ('RIDE_GIVEN', 'Ride Given'),
        ('RIDE_TAKEN', 'Ride Taken'),
        ('STREAK_BONUS', 'Streak Bonus'),
        ('MINI_GAME', 'Mini Game Bonus'),
        ('REDEMPTION', 'Point Redemption'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='point_transactions')
    amount = models.IntegerField()
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    timestamp = models.DateTimeField(auto_now_add=True)
    description = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.user.username}: {self.amount} ({self.transaction_type})"

class CarpoolGroup(models.Model):
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='carpool_groups')
    nickname = models.CharField(max_length=100, blank=True)
    rides_completed = models.IntegerField(default=0)
    
    # Keeping some useful existing fields
    rank = models.CharField(max_length=50, blank=True)
    last_ride_date = models.DateField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return self.nickname or f"Group {self.pk} ({self.rides_completed} rides)"

