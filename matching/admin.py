from django.contrib import admin

from .models import Ride


@admin.register(Ride)
class RideAdmin(admin.ModelAdmin):
    list_display = ("id", "ride_offer", "status", "total_detour_time", "created_at")
    list_filter = ("status",)
    search_fields = ("ride_offer__driver__username",)
    readonly_fields = ("created_at", "updated_at")
