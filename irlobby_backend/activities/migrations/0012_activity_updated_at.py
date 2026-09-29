import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("activities", "0011_seed_churches_and_zero_fees"),
    ]

    operations = [
        migrations.AddField(
            model_name="activity",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
    ]
