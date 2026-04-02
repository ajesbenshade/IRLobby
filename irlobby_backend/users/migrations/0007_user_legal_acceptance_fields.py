from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0006_push_device_token"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="privacy_accepted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="terms_accepted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
