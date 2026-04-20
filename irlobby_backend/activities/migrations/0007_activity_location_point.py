import django.contrib.gis.db.models.fields
from django.db import migrations


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
    ]
