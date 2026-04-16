from rest_framework import serializers
from .models import UserStats, Achievement, UserAchievement, PointTransaction, CarpoolGroup
from django.contrib.auth import get_user_model

User = get_user_model()

class UserStatsSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    student_name = serializers.CharField(source='user.studentName', read_only=True)
    total_rides = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = UserStats
        fields = ['username', 'student_name', 'total_points', 'current_streak', 'max_streak', 'rides_given', 'rides_taken', 'total_rides']

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
