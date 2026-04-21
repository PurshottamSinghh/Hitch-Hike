"""
Seed 5 test drivers for manual end-to-end testing.

All drivers use password ``12345678`` and email ``driverN@utoledo.edu``.
Run with:

    docker compose exec -w /app backend env PYTHONPATH=/app \
        python scripts/seed_test_drivers.py
"""
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hitchhike.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point

User = get_user_model()

DRIVERS = [
    # (username, lng, lat, nickname shown in table output)
    ("driver1", -83.6130, 41.6610, "UToledo University Hall"),
    ("driver2", -83.6180, 41.6585, "UToledo Student Union"),
    ("driver3", -83.5970, 41.6500, "Scott Park Campus (~1 mi SE)"),
    ("driver4", -83.6230, 41.6760, "Westgate Plaza (~1.5 mi NW)"),
    ("driver5", -83.6990, 41.7090, "Sylvania (~6 mi NW — far)"),
]

PASSWORD = "12345678"


def main() -> None:
    print("\nSeeding drivers (password for all = 12345678)\n")
    print(f"{'USERNAME':<10} {'EMAIL':<28} {'LNG':>10} {'LAT':>10}   LOCATION")
    print("-" * 90)

    for username, lng, lat, label in DRIVERS:
        email = f"{username}@utoledo.edu"

        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email},
        )
        user.email = email
        user.set_password(PASSWORD)
        user.save()

        profile = user.profile
        profile.role = "driver"
        profile.current_location = Point(lng, lat, srid=4326)
        profile.is_online = True
        profile.notify_on_ride_request = True
        profile.home_address = label
        profile.save()

        marker = "created" if created else "updated"
        print(
            f"{username:<10} {email:<28} {lng:>10.4f} {lat:>10.4f}   "
            f"{label}  ({marker})"
        )

    print("\nAll drivers are online and notify_on_ride_request=True.\n")


if __name__ == "__main__":
    main()
