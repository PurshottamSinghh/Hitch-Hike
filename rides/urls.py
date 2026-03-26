from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RideOfferViewSet, RideRequestViewSet

router = DefaultRouter()
router.register(r'offers', RideOfferViewSet)
router.register(r'requests', RideRequestViewSet)

urlpatterns = [
    path('', include(router.urls)),
]