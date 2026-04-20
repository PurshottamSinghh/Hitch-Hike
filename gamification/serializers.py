from rest_framework import serializers
from .models import UserStats, Achievement, UserAchievement, PointTransaction, CarpoolGroup
from django.contrib.auth import get_user_model

User = get_user_model()


class UserStatsSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    # Django User has no studentName; expose a display name from first/last or username.
    student_name = serializers.SerializerMethodField()
    total_rides = serializers.SerializerMethodField()

    class Meta:
        model = UserStats
        fields = [
            "username",
            "student_name",
            "total_points",
            "current_streak",
            "max_streak",
            "rides_given",
            "rides_taken",
            "total_rides",
        ]

    def get_student_name(self, obj):
        u = obj.user
        parts = [u.first_name or "", u.last_name or ""]
        name = " ".join(p for p in parts if p).strip()
        return name or u.username

    def get_total_rides(self, obj):
        return obj.rides_given + obj.rides_taken

class AchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = ['id', 'name', 'description', 'badge_icon', 'achievement_type']

class UserAchievementSerializer(serializers.ModelSerializer):
    achievement = AchievementSerializer(read_only=True)
    
    class Meta:
        model = UserAchievement
        fields = ['achievement', 'earned_at']

class PointTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PointTransaction
        fields = ['amount', 'transaction_type', 'timestamp', 'description']

class GamificationProfileSerializer(serializers.ModelSerializer):
    stats = UserStatsSerializer(source='gamification_stats', read_only=True)
    earned_achievements = UserAchievementSerializer(source='achievements', many=True, read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'stats', 'earned_achievements']

class CarpoolGroupSerializer(serializers.ModelSerializer):
    members = serializers.SlugRelatedField(
        many=True,
        read_only=True,
        slug_field='username'
    )

    class Meta:
        model = CarpoolGroup
        fields = ['id', 'members', 'nickname', 'rides_completed', 'rank', 'last_ride_date']
