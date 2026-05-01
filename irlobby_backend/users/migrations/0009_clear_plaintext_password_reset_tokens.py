from django.db import migrations


def clear_password_reset_tokens(apps, schema_editor):
    User = apps.get_model("users", "User")
    User.objects.exclude(password_reset_token__isnull=True).update(
        password_reset_token=None,
        token_created_at=None,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0008_expand_avatar_url"),
    ]

    operations = [
        migrations.RunPython(clear_password_reset_tokens, migrations.RunPython.noop),
    ]
