from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0016_user_show_birthday"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="mailing_city",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="user",
            name="mailing_postal",
            field=models.CharField(blank=True, default="", max_length=10),
        ),
        migrations.AddField(
            model_name="user",
            name="mailing_state",
            field=models.CharField(blank=True, default="", max_length=2),
        ),
        migrations.AddField(
            model_name="user",
            name="mailing_street",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="user",
            name="mailing_street2",
            field=models.CharField(blank=True, default=None, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="show_mailing_address",
            field=models.BooleanField(default=False),
        ),
    ]
