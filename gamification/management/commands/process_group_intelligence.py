from django.core.management.base import BaseCommand
from gamification.ai_services import GroupIntelligenceService

class Command(BaseCommand):
    help = "Analyzes completed rides to identify frequent carpool groups and assign AI nicknames."

    def handle(self, *args, **options):
        self.stdout.write("Starting Group Intelligence analysis...")
        service = GroupIntelligenceService()
        service.aggregate_groups()
        self.stdout.write(self.style.SUCCESS("Successfully processed carpool groups."))
