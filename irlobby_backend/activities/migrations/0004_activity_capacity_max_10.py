from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('activities', '0003_activity_is_approved'),
    ]

    operations = [
        migrations.AlterField(
            model_name='activity',
            name='capacity',
            field=models.PositiveIntegerField(validators=[django.core.validators.MaxValueValidator(10)]),
        ),
    ]
