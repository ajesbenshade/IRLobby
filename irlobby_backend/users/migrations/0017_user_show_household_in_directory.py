from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0016_user_show_birthday"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="show_household_in_directory",
            field=models.BooleanField(default=False),
        ),
    ]
