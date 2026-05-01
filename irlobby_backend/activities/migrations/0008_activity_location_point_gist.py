from django.contrib.postgres.indexes import GistIndex
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("activities", "0007_activity_location_point"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="activity",
            index=GistIndex(fields=["location_point"], name="activity_loc_point_gist"),
        ),
    ]
