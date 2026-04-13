"""
Hitch-Hike — Root URL configuration.

Routes all matching API endpoints under /api/matching/.
"""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/matching/", include("matching.urls")),
]
