# Generated manually for schedule support.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("rides", "0006_userprofile_home_address"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ClassSchedule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("course_name", models.CharField(max_length=120)),
                ("course_code", models.CharField(blank=True, default="", max_length=30)),
                ("day_of_week", models.CharField(choices=[("mon", "Monday"), ("tue", "Tuesday"), ("wed", "Wednesday"), ("thu", "Thursday"), ("fri", "Friday")], max_length=3)),
                ("start_time", models.TimeField()),
                ("end_time", models.TimeField()),
                ("location", models.CharField(blank=True, default="", max_length=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="class_schedules", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["day_of_week", "start_time"],
            },
        ),
        migrations.AddConstraint(
            model_name="classschedule",
            constraint=models.UniqueConstraint(
                fields=("user", "day_of_week", "start_time", "end_time", "course_name"),
                name="unique_user_class_block",
            ),
        ),
    ]

