from decimal import Decimal

from django.db import migrations

SEEDED_CHURCHES = (
    "Franconia Mennonite Church",
    "Souderton Mennonite Church",
    "Blooming Glen Mennonite Church",
    "Plains Mennonite Church",
    "Zion Mennonite Church",
    "Perkasie Mennonite Church",
    "Deep Run East Mennonite Church",
    "Finland Mennonite Church",
)


def seed_churches_and_zero_fees(apps, schema_editor):
    Church = apps.get_model("activities", "Church")
    Activity = apps.get_model("activities", "Activity")
    for name in SEEDED_CHURCHES:
        church = Church.objects.filter(name__iexact=name).first()
        if church is None:
            Church.objects.create(name=name, is_verified=True)
        elif not church.is_verified:
            church.is_verified = True
            church.save(update_fields=["is_verified"])
    Activity.objects.update(platform_fee_percent=Decimal("0"))


def unseed_churches(apps, schema_editor):
    Church = apps.get_model("activities", "Church")
    Church.objects.filter(name__in=SEEDED_CHURCHES, created_by__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("activities", "0010_foyer_gatherings"),
    ]

    operations = [
        migrations.RunPython(seed_churches_and_zero_fees, unseed_churches),
    ]
