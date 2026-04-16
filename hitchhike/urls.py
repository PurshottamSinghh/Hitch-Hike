"""
Hitch-Hike — Root URL configuration.

Routes:
  /admin/            → Django admin
  /api/rides/        → Rides CRUD (Antardip's data layer)
  /api/matching/     → Matching engine (ranking + confirmation)
"""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/rides/", include("rides.urls")),
    path("api/matching/", include("matching.urls")),
]
