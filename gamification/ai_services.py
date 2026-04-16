import os
from openai import OpenAI
from django.conf import settings
from django.db.models import Count
from matching.models import Ride
from .models import CarpoolGroup
from django.contrib.auth import get_user_model
import json
import environ

User = get_user_model()
env = environ.Env()
environ.Env.read_env(os.path.join(settings.BASE_DIR, '.env'))

class GroupIntelligenceService:
    def __init__(self):
        self.api_key = env("OPENROUTER_API_KEY", default=None)
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key if self.api_key else "dummy"
        )
        self.model = "openrouter/free"

    def aggregate_groups(self):
        """Find unique sets of users who completed rides together."""
        completed_rides = Ride.objects.filter(status='completed')
        groups_raw = {}

        for ride in completed_rides:
            # Participants includes both driver and riders
            user_ids = sorted(list(ride.participants.values_list('id', flat=True)))
            if not user_ids:
                continue
            
            group_key = tuple(user_ids)
            if group_key not in groups_raw:
                groups_raw[group_key] = {
                    'count': 0,
                    'last_date': ride.updated_at.date()
                }
            groups_raw[group_key]['count'] += 1
            if ride.updated_at.date() > groups_raw[group_key]['last_date']:
                groups_raw[group_key]['last_date'] = ride.updated_at.date()

        for user_ids, data in groups_raw.items():
            if data['count'] >= 1: # Threshold for creation
                # Find or create group
                matching_groups = CarpoolGroup.objects.annotate(c=Count('members')).filter(c=len(user_ids))
                for uid in user_ids:
                    matching_groups = matching_groups.filter(members__id=uid)
                
                if matching_groups.exists():
                    group = matching_groups.first()
                else:
                    group = CarpoolGroup.objects.create()
                    group.members.set(user_ids)
                
                group.ridesCompleted = data['count']
                group.last_ride_date = data['last_date']
                group.save()
                
                # Generate nickname if missing or generic
                if (not group.nickname or group.nickname == "The Mystery Crew") and self.api_key:
                    self.generate_whimsical_nickname(group)

    def generate_whimsical_nickname(self, group):
        """Calls OpenRouter to get a nickname based on members and frequency."""
        member_list = [m.studentName for m in group.members.all()]
        prompt = (
            f"Generate a whimsical and creative nickname and a playful rank for a carpool group "
            f"consisting of these members: {', '.join(member_list)}. "
            f"They have completed {group.ridesCompleted} rides together. "
            f"The nickname should be fun, campus-themed (University of Toledo Rockets), and rocket-related. "
            f"Return the result as a JSON object with keys 'nickname' and 'rank'."
        )

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}]
            )
            content = response.choices[0].message.content
            
            if "{" in content and "}" in content:
                json_part = content[content.find("{"):content.rfind("}")+1]
                result = json.loads(json_part)
            else:
                result = {}

            group.nickname = result.get('nickname', 'Rocket Poolers')
            group.rank = result.get('rank', 'Launch Crew')
            group.save()
        except Exception as e:
            group.nickname = "Midnight Rockets"
            group.rank = "Stellar Commuters"
            group.save()
