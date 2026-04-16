from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LeaderboardView, UserCarpoolGroupViewSet

router = DefaultRouter()
router.register(r'', UserCarpoolGroupViewSet, basename='groups')

urlpatterns = [
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('groups/', include(router.urls)),
]
