from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('activities', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='activity',
            name='is_approved',
            field=models.BooleanField(default=False),
        ),
    ]
