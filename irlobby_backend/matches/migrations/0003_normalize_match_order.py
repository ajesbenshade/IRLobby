from django.db import migrations


def normalize_match_user_order(apps, schema_editor):
    Match = apps.get_model('matches', 'Match')

    seen = set()
    for match in Match.objects.all().order_by('created_at', 'id'):
        user_a_id = match.user_a_id
        user_b_id = match.user_b_id

        if user_a_id is None or user_b_id is None:
            continue

        if user_a_id > user_b_id:
            match.user_a_id, match.user_b_id = user_b_id, user_a_id
            match.save(update_fields=['user_a', 'user_b'])

        key = (match.activity_id, match.user_a_id, match.user_b_id)
        if key in seen:
            match.delete()
        else:
            seen.add(key)


class Migration(migrations.Migration):

    dependencies = [
        ('matches', '0002_initial'),
    ]

    operations = [
        migrations.RunPython(normalize_match_user_order, migrations.RunPython.noop),
    ]
