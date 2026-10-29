from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0016_user_show_birthday"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="voting_member_attested_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
