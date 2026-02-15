from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_invite_model'),
    ]

    operations = [
        migrations.CreateModel(
            name='PushDeviceToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(max_length=255, unique=True)),
                ('platform', models.CharField(choices=[('ios', 'iOS'), ('android', 'Android'), ('web', 'Web'), ('unknown', 'Unknown')], default='unknown', max_length=20)),
                ('device_id', models.CharField(blank=True, max_length=255)),
                ('is_active', models.BooleanField(default=True)),
                ('last_seen_at', models.DateTimeField(auto_now=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='push_tokens', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-last_seen_at'],
            },
        ),
    ]
