import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("activities", "0005_activity_advanced_fields"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="activity",
            name="is_ticketed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="activity",
            name="ticket_price",
            field=models.DecimalField(default=0, max_digits=10, decimal_places=2),
        ),
        migrations.AddField(
            model_name="activity",
            name="max_tickets",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="activity",
            name="tickets_sold",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="activity",
            name="platform_fee_percent",
            field=models.DecimalField(default=10, max_digits=5, decimal_places=2),
        ),
        migrations.CreateModel(
            name="Ticket",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("ticket_id", models.UUIDField(default=uuid.uuid4, unique=True, editable=False)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("paid", "Paid"),
                            ("used", "Used"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="pending",
                        max_length=10,
                    ),
                ),
                ("stripe_session_id", models.CharField(blank=True, max_length=255, null=True)),
                ("qr_code_data_url", models.TextField(blank=True, default="")),
                ("purchased_at", models.DateTimeField(blank=True, null=True)),
                ("redeemed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "activity",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tickets",
                        to="activities.activity",
                    ),
                ),
                (
                    "buyer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tickets",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="TicketRedemptionLog",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("scanned_at", models.DateTimeField(auto_now_add=True)),
                ("successful", models.BooleanField(default=False)),
                ("status", models.CharField(max_length=20)),
                ("message", models.TextField(blank=True, default="")),
                (
                    "activity",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, to="activities.activity"
                    ),
                ),
                (
                    "host",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ticket_validations",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "ticket",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="redemption_logs",
                        to="activities.ticket",
                    ),
                ),
            ],
            options={
                "ordering": ["-scanned_at"],
            },
        ),
    ]
