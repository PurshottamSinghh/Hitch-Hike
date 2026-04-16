from rest_framework import viewsets, permissions, generics
from .models import UserStats, CarpoolGroup
from .serializers import (
    UserStatsSerializer, CarpoolGroupSerializer
)

class LeaderboardView(generics.ListAPIView):
    # Top 10 by total rides (given + taken)
    permission_classes = [permissions.AllowAny]
    serializer_class = UserStatsSerializer

    def get_queryset(self):
        # We'll use a property or annotate if needed, 
        # but for now let's just use rides_given + rides_taken
        # Note: SQLite doesn't support F expressions in order_by easily 
        # without annotation
        from django.db.models import F
        return UserStats.objects.annotate(
            total_rides=F('rides_given') + F('rides_taken')
        ).order_by('-total_rides')[:10]

class UserCarpoolGroupViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CarpoolGroupSerializer

    def get_queryset(self):
        return CarpoolGroup.objects.filter(members=self.request.user)
