from django.core.management.base import BaseCommand
from gamification.models import Achievement

class Command(BaseCommand):
    help = "Seeds initial achievements for the gamification system."

    def handle(self, *args, **options):
        achievements = [
            {
                "name": "First Hitch",
                "description": "Completed your first ride as a driver.",
                "required_value": 1,
                "criteria_type": "rides_given",
                "achievement_type": "MILESTONE",
            },
            {
                "name": "Eco-Warrior",
                "description": "Completed 10 rides as a driver.",
                "required_value": 10,
                "criteria_type": "rides_given",
                "achievement_type": "MILESTONE",
            },
            {
                "name": "Frequent Flyer",
                "description": "Completed 5 rides as a passenger.",
                "required_value": 5,
                "criteria_type": "rides_taken",
                "achievement_type": "MILESTONE",
            },
            {
                "name": "On Fire",
                "description": "Maintained a 3-day carpooling streak.",
                "required_value": 3,
                "criteria_type": "current_streak",
                "achievement_type": "STREAK",
            },
            {
                "name": "Point Millionaire",
                "description": "Accumulated 1,000 Hitch-Points.",
                "required_value": 1000,
                "criteria_type": "total_points",
                "achievement_type": "SPECIAL",
            },
        ]

        for ach_data in achievements:
            obj, created = Achievement.objects.get_or_create(
                name=ach_data["name"],
                defaults=ach_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created achievement: {obj.name}"))
            else:
                self.stdout.write(self.style.WARNING(f"Achievement already exists: {obj.name}"))
