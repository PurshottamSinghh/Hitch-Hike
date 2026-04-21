"""
Hitch-Hike — Root URL configuration.

Routes:
  /admin/            → Django admin
  /api/rides/        → Rides CRUD (Antardip's data layer)
  /api/matching/     → Matching engine (ranking + confirmation)
"""

from django.contrib import admin
from django.urls import include, path

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/rides/", include("rides.urls")),
    path("api/matching/", include("matching.urls")),
    path("api/gamification/", include("gamification.urls")),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]
