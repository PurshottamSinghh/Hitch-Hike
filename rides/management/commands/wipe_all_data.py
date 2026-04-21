"""
Destructive wipe of every user and every piece of ride/gamification data.

Intentional scope (confirmed with the product owner):
  * All Users (including superusers)
  * All UserProfiles, UserStats, PointTransactions
  * All Achievements + UserAchievements
  * All RideOffers, RideRequests, Rides
  * All ClassSchedules
  * All ProactiveRideMatches

Usage:
    docker-compose exec backend python manage.py wipe_all_data --yes
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Delete ALL users and ALL ride/gamification data from the database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Required confirmation flag; without it the command is a no-op.",
        )

    def handle(self, *args, **options):
        if not options.get("yes"):
            self.stdout.write(
                self.style.WARNING(
                    "Refusing to wipe without --yes. Re-run with --yes to proceed."
                )
            )
            return

        User = get_user_model()

        with transaction.atomic():
            from rides.models import RideOffer, RideRequest, UserProfile, ClassSchedule

            counts: dict[str, int] = {}

            # Optional models that may or may not be present depending on migration state.
            try:
                from rides.models import ProactiveRideMatch
                counts["ProactiveRideMatch"] = ProactiveRideMatch.objects.count()
                ProactiveRideMatch.objects.all().delete()
            except Exception:
                pass

            try:
                from matching.models import Ride
                counts["Ride"] = Ride.objects.count()
                Ride.objects.all().delete()
            except Exception:
                pass

            counts["RideRequest"] = RideRequest.objects.count()
            RideRequest.objects.all().delete()

            counts["RideOffer"] = RideOffer.objects.count()
            RideOffer.objects.all().delete()

            counts["ClassSchedule"] = ClassSchedule.objects.count()
            ClassSchedule.objects.all().delete()

            try:
                from gamification.models import (
                    UserStats,
                    PointTransaction,
                    UserAchievement,
                )
                counts["PointTransaction"] = PointTransaction.objects.count()
                PointTransaction.objects.all().delete()
                counts["UserAchievement"] = UserAchievement.objects.count()
                UserAchievement.objects.all().delete()
                counts["UserStats"] = UserStats.objects.count()
                UserStats.objects.all().delete()
            except Exception:
                pass

            counts["UserProfile"] = UserProfile.objects.count()
            UserProfile.objects.all().delete()

            counts["User"] = User.objects.count()
            User.objects.all().delete()

        for label, n in counts.items():
            self.stdout.write(self.style.SUCCESS(f"Deleted {n} {label}(s)"))

        self.stdout.write(self.style.SUCCESS("Database purged. You can now create fresh accounts."))
