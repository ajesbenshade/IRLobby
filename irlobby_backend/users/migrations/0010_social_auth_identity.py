from django.db import migrations, models


def copy_legacy_oauth_identities(apps, schema_editor):
    User = apps.get_model("users", "User")
    SocialAuthIdentity = apps.get_model("users", "SocialAuthIdentity")

    for user in User.objects.exclude(oauth_provider__isnull=True).exclude(oauth_id__isnull=True):
        if not user.oauth_provider or not user.oauth_id:
            continue

        SocialAuthIdentity.objects.get_or_create(
            provider=user.oauth_provider,
            provider_user_id=user.oauth_id,
            defaults={
                "user": user,
                "email": user.email or "",
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0009_clear_plaintext_password_reset_tokens"),
    ]

    operations = [
        migrations.CreateModel(
            name="SocialAuthIdentity",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "provider",
                    models.CharField(
                        choices=[
                            ("apple", "Apple"),
                            ("google", "Google"),
                            ("twitter", "Twitter/X"),
                        ],
                        max_length=32,
                    ),
                ),
                ("provider_user_id", models.CharField(max_length=255)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="social_identities",
                        to="users.user",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="socialauthidentity",
            constraint=models.UniqueConstraint(
                fields=("provider", "provider_user_id"),
                name="unique_social_auth_identity",
            ),
        ),
        migrations.AddConstraint(
            model_name="socialauthidentity",
            constraint=models.UniqueConstraint(
                fields=("user", "provider"),
                name="unique_user_social_provider",
            ),
        ),
        migrations.RunPython(copy_legacy_oauth_identities, migrations.RunPython.noop),
    ]
