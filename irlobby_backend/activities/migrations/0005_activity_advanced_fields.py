from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('activities', '0004_activity_capacity_max_10'),
    ]

    operations = [
        migrations.AddField(
            model_name='activity',
            name='age_restriction',
            field=models.CharField(blank=True, default='', max_length=32),
        ),
        migrations.AddField(
            model_name='activity',
            name='category',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='activity',
            name='currency',
            field=models.CharField(default='USD', max_length=8),
        ),
        migrations.AddField(
            model_name='activity',
            name='end_time',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='activity',
            name='equipment_provided',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='activity',
            name='equipment_required',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='activity',
            name='is_private',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='activity',
            name='price',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='activity',
            name='requires_approval',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='activity',
            name='skill_level',
            field=models.CharField(blank=True, default='', max_length=32),
        ),
        migrations.AddField(
            model_name='activity',
            name='visibility',
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name='activity',
            name='weather_dependent',
            field=models.BooleanField(default=False),
        ),
    ]
