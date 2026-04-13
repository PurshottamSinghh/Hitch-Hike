"""
URL routing for the Ride Matching & Coordination API.

All paths are relative to ``/api/matching/`` (mounted in ``hitchhike/urls.py``).
"""

from django.urls import path

from matching.views import (
    ConfirmMatchView,
    RankMatchesView,
    RideDetailView,
    RideListView,
)

app_name = "matching"

urlpatterns = [
    # A) Ranked matches for a ride request
    path(
        "rank/<int:ride_request_id>/",
        RankMatchesView.as_view(),
        name="rank-matches",
    ),
    # B) Confirm a match
    path(
        "confirm/",
        ConfirmMatchView.as_view(),
        name="confirm-match",
    ),
    # Ride list & detail
    path(
        "rides/",
        RideListView.as_view(),
        name="ride-list",
    ),
    path(
        "rides/<int:pk>/",
        RideDetailView.as_view(),
        name="ride-detail",
    ),
]
