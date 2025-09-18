from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('activities', '0003_auto_approve_field'),
    ]

    operations = [
        migrations.AddField(
            model_name='activity',
            name='is_private',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='activity',
            name='requires_approval',
            field=models.BooleanField(default=False),
        ),
    ]
