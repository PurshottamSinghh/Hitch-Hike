from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .auth_views import (
    LoginView,
    MicrosoftAuthCallbackView,
    MicrosoftAuthStartView,
    ProfileView,
    RegisterView,
    UpdateLocationView,
)
from .views import (
    ClassScheduleViewSet,
    ProactiveRideMatchViewSet,
    RideOfferViewSet,
    RideRequestViewSet,
)

router = DefaultRouter()
router.register(r"offers", RideOfferViewSet, basename="ride-offer")
router.register(r"requests", RideRequestViewSet, basename="ride-request")
router.register(r"schedules", ClassScheduleViewSet, basename="class-schedule")
router.register(r"proactive_matches", ProactiveRideMatchViewSet, basename="proactive-match")

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/microsoft/start/", MicrosoftAuthStartView.as_view(), name="microsoft-auth-start"),
    path("auth/microsoft/callback/", MicrosoftAuthCallbackView.as_view(), name="microsoft-auth-callback"),
    path("auth/profile/", ProfileView.as_view(), name="profile"),
    path("auth/location/", UpdateLocationView.as_view(), name="update-location"),
    path("", include(router.urls)),
]
