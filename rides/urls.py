from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RideOfferViewSet, RideRequestViewSet

from .auth_views import RegisterView, LoginView, ProfileView

router = DefaultRouter()
router.register(r"offers", RideOfferViewSet, basename="ride-offer")
router.register(r"requests", RideRequestViewSet, basename="ride-request")

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/profile/", ProfileView.as_view(), name="profile"),
    path("", include(router.urls)),
]
