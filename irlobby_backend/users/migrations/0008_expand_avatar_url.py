from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0007_user_legal_acceptance_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="avatar_url",
            field=models.TextField(blank=True),
        ),
    ]
