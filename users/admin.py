from django.contrib import admin

from .models import RideOffer, RideRequest, User

admin.site.register(User)
admin.site.register(RideOffer)
admin.site.register(RideRequest)
