"""
Smoke test for the redesigned dispatch flow.

Run against the running Docker stack:
    docker compose exec backend python /code/scripts/smoke_dispatch.py
"""
import json
import os
import sys

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hitchhike.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.utils import timezone

from rides.models import RideRequest, UserProfile
from matching.services import find_eligible_drivers_for_pickup

User = get_user_model()


def _get_or_create(
    username: str,
    email: str,
    role: str,
    lng: float,
    lat: float,
    notify: bool = True,
):
    user, created = User.objects.get_or_create(
        username=username,
        defaults={"email": email},
    )
    if created:
        user.set_password("testpass123")
        user.save()
    profile = user.profile
    profile.role = role
    profile.current_location = Point(lng, lat, srid=4326)
    profile.notify_on_ride_request = notify
    profile.save()
    return user


def main():
    print("=" * 64)
    print("Clean-slate smoke test — new dispatch flow")
    print("=" * 64)

    # Use the wipe command first in a real run.
    print("\n[1] Create 1 rider + 5 drivers around UToledo.")
    rider = _get_or_create("smoke_rider", "smoke_rider@utoledo.edu", "rider", -83.61, 41.66)
    drivers = [
        _get_or_create("smoke_d1", "smoke_d1@utoledo.edu", "driver", -83.612, 41.661),
        _get_or_create("smoke_d2", "smoke_d2@utoledo.edu", "driver", -83.617, 41.663),
        _get_or_create("smoke_d3", "smoke_d3@utoledo.edu", "driver", -83.64, 41.68),  # farther
        _get_or_create("smoke_d4", "smoke_d4@utoledo.edu", "driver", -83.53, 41.72),  # far
        _get_or_create("smoke_d5", "smoke_d5@utoledo.edu", "driver", -83.61, 41.659, notify=False),  # silenced
    ]
    print(f"    rider={rider.id}, drivers={[d.id for d in drivers]}")

    print("\n[2] Submit a rider request and find eligible drivers (5-min radius).")
    req = RideRequest.objects.create(
        passenger=rider,
        pickup_location=Point(-83.611, 41.6605, srid=4326),
        dropoff_location=Point(-83.615, 41.67, srid=4326),
        desired_time=timezone.now(),
        seats_needed=1,
    )
    eligible = find_eligible_drivers_for_pickup(req)
    print(f"    found {len(eligible)} eligible drivers")
    for row in eligible:
        print(
            f"      - {row['driver_username']} "
            f"(id={row['driver_id']}, pickup_seconds={row['pickup_seconds']})"
        )

    print("\n[3] Populate request eligibility + re-save.")
    req.eligible_driver_ids = [d["driver_id"] for d in eligible]
    req.pickup_eta_seconds = {str(d["driver_id"]): d["pickup_seconds"] for d in eligible}
    if not eligible:
        req.status = "no_drivers_available"
    req.save()
    req.refresh_from_db()
    print(
        f"    request #{req.id}: status={req.status}, "
        f"eligible={req.eligible_driver_ids}, rejected={req.rejected_driver_ids}"
    )

    assert drivers[-1].id not in req.eligible_driver_ids, (
        "Driver with notify_on_ride_request=False should NOT be eligible."
    )
    print("    ✓ Silenced driver correctly excluded.")

    print("\nDone. Run `docker compose exec backend python manage.py wipe_all_data --yes` "
          "to clear these users before manual testing.")


if __name__ == "__main__":
    main()
