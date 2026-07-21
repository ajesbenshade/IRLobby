import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("activities", "0003_activity_is_approved"),
    ]

    operations = [
        migrations.AlterField(
            model_name="activity",
            name="capacity",
            field=models.PositiveIntegerField(
                validators=[django.core.validators.MaxValueValidator(10)]
            ),
        ),
    ]
