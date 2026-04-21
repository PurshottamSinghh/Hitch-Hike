# Generated manually — fixes DBs where home_address exists as NOT NULL without a safe default.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("rides", "0005_userprofile_current_location"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="userprofile",
                    name="home_address",
                    field=models.CharField(
                        blank=True,
                        default="",
                        help_text="Onboarding home or neighborhood text (not exact coords for other users).",
                        max_length=255,
                    ),
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql=r"""
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.columns
                            WHERE table_schema = 'public'
                              AND table_name = 'rides_userprofile'
                              AND column_name = 'home_address'
                        ) THEN
                            UPDATE rides_userprofile SET home_address = '' WHERE home_address IS NULL;
                            ALTER TABLE rides_userprofile ALTER COLUMN home_address SET DEFAULT '';
                        ELSE
                            ALTER TABLE rides_userprofile
                                ADD COLUMN home_address varchar(255) NOT NULL DEFAULT '';
                        END IF;
                    END $$;
                    """,
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
        ),
    ]
