import django.contrib.gis.db.models.fields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("activities", "0006_ticketing"),
    ]

    operations = [
        migrations.AddField(
            model_name="activity",
            name="location_point",
            field=django.contrib.gis.db.models.fields.PointField(
                blank=True, geography=True, null=True, srid=4326
            ),
        ),
        migrations.AddField(
            model_name="ticket",
            name="stripe_payment_intent_id",
            field=models.CharField(
                blank=True, db_index=True, max_length=255, null=True
            ),
        ),
        migrations.AddIndex(
            model_name="ticket",
            index=models.Index(
                fields=["stripe_payment_intent_id"],
                name="activities_t_stripe__idx",
            ),
        ),
    ]
