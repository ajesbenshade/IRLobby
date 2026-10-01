"""Edge paths for Foyer gatherings so error handling stays covered."""

from datetime import date, datetime, timedelta
from io import BytesIO
from types import SimpleNamespace

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from activities.access import is_activity_host, is_church_admin, user_has_going_rsvp
from activities.eligibility import (
    age_on,
    as_new_york,
    audience_label,
    confirmed_people_count,
    eligibility_for_person,
    host_display_name,
    ny_today,
)
from activities.household_rules import (
    account_age_error,
    dependent_blocks_minor_account,
    dependent_create_errors,
    minor_account_for_dependent,
)
from activities.models import (
    FRANCONIA_CHURCH_NAME,
    Activity,
    ActivityParticipant,
    Church,
    EventPhoto,
    HouseholdDependent,
)
from activities.photos import (
    PhotoProcessingError,
    absolute_photo_url,
    compress_uploaded_image,
    cover_photo_url,
)
from activities.public_calendar import _fold, _ics_escape, _ics_stamp, public_calendar_ics
from chat.consumers import _query_activity_id
from users.models import User

from .test_foyer import _activity, _jpeg_upload, _safe_birthdate


def _png_upload(mode="RGBA"):
    buffer = BytesIO()
    Image.new(mode, (8, 8), (255, 0, 0, 128) if mode == "RGBA" else "blue").save(
        buffer, format="PNG"
    )
    return SimpleUploadedFile("photo.png", buffer.getvalue(), content_type="image/png")


class FoyerRuleUnitTests(TestCase):
    def test_audience_age_and_host_labels(self):
        activity = SimpleNamespace(
            audience_gender="unknown",
            age_min=6,
            age_max=None,
            host_kind="person",
            host=SimpleNamespace(first_name="", last_name="", username=""),
            host_church=None,
        )
        self.assertEqual(audience_label(activity), "Everyone · Ages 6+")
        activity.age_min = None
        activity.age_max = 12
        self.assertEqual(audience_label(activity), "Everyone · Ages 12 and under")
        activity.age_min = 6
        activity.age_max = 17
        self.assertEqual(audience_label(activity), "Everyone · Ages 6–17")
        activity.age_min = 18
        activity.age_max = None
        activity.audience_gender = "men"
        self.assertEqual(audience_label(activity), "Men · 18+")
        self.assertEqual(host_display_name(activity), "Host")

        church_event = SimpleNamespace(
            host_kind="church",
            host_church=SimpleNamespace(name=""),
            host=activity.host,
        )
        self.assertEqual(host_display_name(church_event), FRANCONIA_CHURCH_NAME)
        naive = datetime(2026, 1, 2, 3, 4)
        self.assertEqual(as_new_york(naive).tzinfo.key, "America/New_York")
        self.assertIsNone(age_on(None, ny_today()))

    def test_eligibility_reasons(self):
        men = SimpleNamespace(audience_gender="men", age_min=None, age_max=None)
        women = SimpleNamespace(audience_gender="women", age_min=10, age_max=12)
        open_ages = SimpleNamespace(audience_gender="everyone", age_min=None, age_max=40)
        on_date = date(2026, 6, 1)
        self.assertEqual(
            eligibility_for_person(activity=men, sex="", dob=None, on_date=on_date)[1],
            "Add a sex to join this gathering.",
        )
        self.assertIn(
            "women",
            eligibility_for_person(
                activity=women, sex="male", dob=date(2014, 1, 1), on_date=on_date
            )[1],
        )
        self.assertEqual(
            eligibility_for_person(activity=women, sex="", dob=date(2014, 1, 1), on_date=on_date)[
                1
            ],
            "Add a sex to join this gathering.",
        )
        self.assertEqual(
            eligibility_for_person(activity=women, sex="female", dob=None, on_date=on_date)[1],
            "Birth date is required for this gathering's age range.",
        )
        too_old = eligibility_for_person(
            activity=open_ages, sex="female", dob=date(1970, 1, 1), on_date=on_date
        )
        self.assertFalse(too_old[0])
        self.assertIsNone(
            eligibility_for_person(
                activity=SimpleNamespace(audience_gender="everyone", age_min=None, age_max=None),
                sex="",
                dob=None,
                on_date=on_date,
            )[1]
        )

    def test_household_age_rules(self):
        self.assertIsNone(account_age_error(None))
        self.assertIn("13", account_age_error(_safe_birthdate(10)))
        self.assertIsNone(minor_account_for_dependent("", _safe_birthdate(15)))
        self.assertIsNone(minor_account_for_dependent("Kid", _safe_birthdate(10)))
        self.assertFalse(
            dependent_blocks_minor_account(
                first_name="Kid", username="kid", date_of_birth=_safe_birthdate(20)
            )
        )
        self.assertFalse(
            dependent_blocks_minor_account(first_name="", username="", date_of_birth=None)
        )
        teen_dob = _safe_birthdate(15)
        self.assertFalse(
            dependent_blocks_minor_account(
                first_name="", last_name="", username="", date_of_birth=teen_dob
            )
        )
        User.objects.create_user(
            username="other-teen",
            email="other-teen@example.com",
            password="password123",
            first_name="Other",
            date_of_birth=teen_dob,
        )
        self.assertIsNone(minor_account_for_dependent("Not Other", teen_dob))
        HouseholdDependent.objects.create(
            parent=User.objects.create_user(
                username="dep-parent",
                email="dep-parent@example.com",
                password="password123",
                date_of_birth=_safe_birthdate(40),
            ),
            name="Someone Else",
            date_of_birth=teen_dob,
        )
        self.assertFalse(
            dependent_blocks_minor_account(
                first_name="Unrelated", username="unrelated", date_of_birth=teen_dob
            )
        )
        parent = SimpleNamespace(date_of_birth=None)
        errors = dependent_create_errors(
            parent=parent, name="Kid", date_of_birth=_safe_birthdate(8)
        )
        self.assertIn("parent", errors)
        parent.date_of_birth = _safe_birthdate(16)
        errors = dependent_create_errors(
            parent=parent, name="Kid", date_of_birth=_safe_birthdate(8)
        )
        self.assertIn("18", errors["parent"])
        parent.date_of_birth = _safe_birthdate(30)
        errors = dependent_create_errors(
            parent=parent, name="Adult", date_of_birth=_safe_birthdate(20)
        )
        self.assertIn("under 18", errors["date_of_birth"])

    def test_photo_compression_and_cover_selection(self):
        jpeg = compress_uploaded_image(_png_upload("RGBA"))
        self.assertTrue(jpeg.read().startswith(b"\xff\xd8"))
        gray = compress_uploaded_image(_png_upload("L"))
        self.assertTrue(gray.read().startswith(b"\xff\xd8"))
        with self.assertRaises(PhotoProcessingError):
            compress_uploaded_image(SimpleUploadedFile("x.txt", b"not-an-image"))

        activity = SimpleNamespace(
            photos=SimpleNamespace(all=lambda: []),
            images=["  data:image/png;base64,abc", 12, " https://example.com/cover.jpg "],
        )
        self.assertEqual(cover_photo_url(activity), "https://example.com/cover.jpg")
        photo = SimpleNamespace(activity_id=4, id=9, image=True)
        activity.photos = SimpleNamespace(all=lambda: [photo])
        self.assertEqual(absolute_photo_url(photo), "/api/activities/4/photos/9/")
        self.assertEqual(cover_photo_url(activity), "/api/activities/4/photos/9/")

    def test_calendar_folding_and_naive_stamps(self):
        self.assertIsNone(_ics_stamp(None))
        self.assertTrue(_ics_stamp(datetime(2026, 1, 2, 3, 4)).endswith("Z"))
        folded = _fold("SUMMARY:" + ("A" * 90))
        self.assertIn("\r\n ", folded)
        self.assertIn("\\;", _ics_escape("a;b,c\\d\n"))

    def test_access_helpers_reject_anonymous_users(self):
        personal = SimpleNamespace(host_kind="person", host_id=1)
        self.assertFalse(is_church_admin(None))
        self.assertFalse(is_activity_host(SimpleNamespace(is_authenticated=False), personal))
        self.assertIsNone(_query_activity_id({"query_string": "activityId="}))
        self.assertEqual(_query_activity_id({"query_string": "activity_id=12"}), "12")


class FoyerEndpointEdgeTests(APITestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            username="edge-host",
            email="edge-host@example.com",
            password="password123",
            first_name="Helen",
            last_name="Host",
            date_of_birth=_safe_birthdate(40),
            sex="female",
        )
        self.parent = User.objects.create_user(
            username="edge-parent",
            email="edge-parent@example.com",
            password="password123",
            first_name="Paul",
            date_of_birth=_safe_birthdate(36),
            sex="male",
        )
        self.admin = User.objects.create_user(
            username="edge-admin",
            email="ajesbenshade@gmail.com",
            password="password123",
            date_of_birth=_safe_birthdate(45),
            sex="male",
        )

    def test_churches_and_household_validation(self):
        self.client.force_authenticate(self.parent)
        missing = self.client.post(reverse("church-list"), {}, format="json")
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        too_long = self.client.post(reverse("church-list"), {"name": "A" * 256}, format="json")
        self.assertEqual(too_long.status_code, status.HTTP_400_BAD_REQUEST)
        created = self.client.post(reverse("church-list"), {"name": "Typed Chapel"}, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        again = self.client.post(reverse("church-list"), {"name": "typed chapel"}, format="json")
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(again.data["id"], created.data["id"])
        searched = self.client.get(reverse("church-list"), {"q": "Typed"})
        self.assertEqual(searched.data[0]["name"], "Typed Chapel")

        bad_sex = self.client.post(
            reverse("household"),
            {"name": "Kid", "date_of_birth": _safe_birthdate(6).isoformat(), "sex": "other"},
            format="json",
        )
        self.assertEqual(bad_sex.status_code, status.HTTP_400_BAD_REQUEST)
        no_name = self.client.post(
            reverse("household"),
            {"date_of_birth": _safe_birthdate(6).isoformat(), "sex": "m"},
            format="json",
        )
        self.assertEqual(no_name.status_code, status.HTTP_400_BAD_REQUEST)
        bad_date = self.client.post(
            reverse("household"), {"name": "Kid", "date_of_birth": "soon"}, format="json"
        )
        self.assertEqual(bad_date.status_code, status.HTTP_400_BAD_REQUEST)

        undated = User.objects.create_user(
            username="undated", email="undated@example.com", password="password123"
        )
        self.client.force_authenticate(undated)
        needs_dob = self.client.post(
            reverse("household"),
            {"name": "Kid", "birth_date": _safe_birthdate(6).isoformat(), "sex": "f"},
            format="json",
        )
        self.assertEqual(needs_dob.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.parent)
        adult = self.client.post(
            reverse("household"),
            {"name": "Grown", "date_of_birth": _safe_birthdate(19).isoformat(), "sex": "male"},
            format="json",
        )
        self.assertEqual(adult.status_code, status.HTTP_400_BAD_REQUEST)
        child = self.client.post(
            reverse("household"),
            {"name": "Sam", "date_of_birth": _safe_birthdate(7).isoformat(), "sex": "male"},
            format="json",
        )
        self.assertEqual(child.status_code, status.HTTP_201_CREATED)
        teen_dob = _safe_birthdate(15)
        User.objects.create_user(
            username="riley",
            email="riley@example.com",
            password="password123",
            first_name="Riley",
            date_of_birth=teen_dob,
            sex="female",
        )
        teen_dependent = self.client.post(
            reverse("household"),
            {"name": "Riley", "date_of_birth": teen_dob.isoformat(), "sex": "female"},
            format="json",
        )
        self.assertEqual(teen_dependent.status_code, status.HTTP_400_BAD_REQUEST)
        listed = self.client.get(reverse("household"))
        self.assertEqual(listed.data["children"][0]["name"], "Sam")
        missing_child = self.client.delete(reverse("household-delete", args=[999999]))
        self.assertEqual(missing_child.status_code, status.HTTP_404_NOT_FOUND)
        removed = self.client.delete(reverse("household-delete", args=[child.data["id"]]))
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)

    def test_profile_and_registration_age_rules(self):
        self.client.force_authenticate(self.parent)
        church = Church.objects.get(name=FRANCONIA_CHURCH_NAME)
        updated = self.client.patch(
            reverse("user-profile"),
            {"birthDate": _safe_birthdate(36).isoformat(), "sex": "MALE", "churchId": church.id},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["sex"], "male")
        self.assertEqual(updated.data["church"]["id"], church.id)
        self.assertEqual(updated.data["household_child_count"], 0)
        too_young = self.client.patch(
            reverse("user-profile"),
            {"date_of_birth": _safe_birthdate(8).isoformat()},
            format="json",
        )
        self.assertEqual(too_young.status_code, status.HTTP_400_BAD_REQUEST)
        bad_sex = self.client.patch(reverse("user-profile"), {"sex": "other"}, format="json")
        self.assertEqual(bad_sex.status_code, status.HTTP_400_BAD_REQUEST)

        teen_dob = _safe_birthdate(15)
        HouseholdDependent.objects.create(
            parent=self.parent, name="Jamie Host", date_of_birth=teen_dob, sex="female"
        )
        blocked = self.client.post(
            reverse("user-register"),
            {
                "username": "jamie",
                "email": "jamie@example.com",
                "password": "password123",
                "password_confirm": "password123",
                "first_name": "Jamie",
                "last_name": "Host",
                "date_of_birth": teen_dob.isoformat(),
                "sex": "female",
            },
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="jamie@example.com").exists())

        self.client.force_authenticate(self.admin)
        profile = self.client.get(reverse("user-profile"))
        self.assertTrue(profile.data["is_church_admin"])

    def test_rsvp_validation_capacity_and_going_list(self):
        child = HouseholdDependent.objects.create(
            parent=self.parent,
            name="Sam",
            date_of_birth=_safe_birthdate(7),
            sex="male",
        )
        men_only = _activity(self.host, audience_gender="men", age_min=18, capacity=1)
        self.client.force_authenticate(self.parent)
        sheet = self.client.get(reverse("activity-whos-coming", args=[men_only.id]))
        self.assertEqual(sheet.status_code, status.HTTP_200_OK)
        self.assertFalse(sheet.data["dependents"][0]["eligible"])

        bad_ids = self.client.post(
            reverse("activity-rsvp", args=[men_only.id]),
            {"dependent_ids": "1"},
            format="json",
        )
        self.assertEqual(bad_ids.status_code, status.HTTP_400_BAD_REQUEST)
        bad_values = self.client.post(
            reverse("activity-rsvp", args=[men_only.id]),
            {"dependent_ids": ["nope"]},
            format="json",
        )
        self.assertEqual(bad_values.status_code, status.HTTP_400_BAD_REQUEST)
        unknown = self.client.post(
            reverse("activity-rsvp", args=[men_only.id]),
            {"dependent_ids": [999999], "include_self": False},
            format="json",
        )
        self.assertEqual(unknown.status_code, status.HTTP_400_BAD_REQUEST)
        empty = self.client.post(
            reverse("activity-rsvp", args=[men_only.id]),
            {"include_self": "false", "dependent_ids": None},
            format="json",
        )
        self.assertEqual(empty.status_code, status.HTTP_400_BAD_REQUEST)

        ineligible = self.client.post(
            reverse("activity-rsvp", args=[men_only.id]),
            {"include_self": True, "dependent_ids": [child.id]},
            format="json",
        )
        self.assertEqual(ineligible.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(ineligible.data["people"])

        open_event = _activity(self.host, capacity=1, audience_gender="everyone")
        ActivityParticipant.objects.create(
            activity=open_event, user=self.host, status="confirmed", include_self=True
        )
        ActivityParticipant.objects.create(
            activity=open_event,
            user=self.admin,
            status="pending",
            include_self=True,
        )
        full = self.client.post(
            reverse("activity-rsvp", args=[open_event.id]),
            {"include_self": True},
            format="json",
        )
        self.assertEqual(full.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(confirmed_people_count(open_event), 1)
        self.assertFalse(user_has_going_rsvp(self.admin, open_event))

        roomy = _activity(self.host, capacity=4)
        first = self.client.post(reverse("activity-rsvp", args=[roomy.id]), {}, format="json")
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        replaced = self.client.post(
            reverse("activity-rsvp", args=[roomy.id]),
            {"includeSelf": False, "dependentIds": [child.id]},
            format="json",
        )
        self.assertEqual(replaced.status_code, status.HTTP_200_OK)
        self.assertEqual(replaced.data["people_count"], 1)
        self.assertTrue(user_has_going_rsvp(self.parent, roomy))

        going = self.client.get(reverse("going-activities"))
        rows = going.data if isinstance(going.data, list) else going.data["results"]
        self.assertEqual(rows[0]["id"], roomy.id)

        missing = self.client.delete(reverse("activity-rsvp-cancel", args=[men_only.id]))
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        cancelled = self.client.delete(reverse("activity-rsvp-cancel", args=[roomy.id]))
        self.assertEqual(cancelled.status_code, status.HTTP_200_OK)
        self.assertEqual(cancelled.data["going_count"], 0)

    def test_hosting_rules_and_calendar_approval(self):
        self.client.force_authenticate(self.parent)
        bad_ages = self.client.post(
            reverse("activity-list"),
            {
                "title": "Bad ages",
                "description": "Nope.",
                "location": "Hall",
                "latitude": 40.3,
                "longitude": -75.3,
                "time": (timezone.now() + timedelta(days=3)).isoformat(),
                "age_min": 20,
                "age_max": 10,
            },
            format="json",
        )
        self.assertEqual(bad_ages.status_code, status.HTTP_400_BAD_REQUEST)
        too_old = self.client.post(
            reverse("activity-list"),
            {
                "title": "Too old",
                "description": "Nope.",
                "location": "Hall",
                "latitude": 40.3,
                "longitude": -75.3,
                "time": (timezone.now() + timedelta(days=3)).isoformat(),
                "ageMin": 121,
            },
            format="json",
        )
        self.assertEqual(too_old.status_code, status.HTTP_400_BAD_REQUEST)
        too_old_max = self.client.post(
            reverse("activity-list"),
            {
                "title": "Too old max",
                "description": "Nope.",
                "location": "Hall",
                "latitude": 40.3,
                "longitude": -75.3,
                "time": (timezone.now() + timedelta(days=3)).isoformat(),
                "age_max": 121,
            },
            format="json",
        )
        self.assertEqual(too_old_max.status_code, status.HTTP_400_BAD_REQUEST)

        created = self.client.post(
            reverse("activity-list"),
            {
                "title": "Member breakfast",
                "description": "Eggs.",
                "location": "Hall",
                "latitude": 40.3,
                "longitude": -75.3,
                "time": (timezone.now() + timedelta(days=3)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        listed = self.client.patch(
            reverse("activity-detail", args=[created.data["id"]]),
            {"list_on_church_calendar": True},
            format="json",
        )
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertFalse(listed.data["calendar_approved"])

        self.client.force_authenticate(self.host)
        denied = self.client.post(reverse("activity-calendar-approve", args=[created.data["id"]]))
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.admin)
        not_listed = _activity(self.host, list_on_church_calendar=False)
        skipped = self.client.post(reverse("activity-calendar-approve", args=[not_listed.id]))
        self.assertEqual(skipped.status_code, status.HTTP_400_BAD_REQUEST)
        approved = self.client.post(reverse("activity-calendar-approve", args=[created.data["id"]]))
        self.assertTrue(approved.data["calendar_approved"])

        admin_event = self.client.post(
            reverse("activity-list"),
            {
                "title": "Admin listing",
                "description": "Approved.",
                "location": "Hall",
                "latitude": 40.3,
                "longitude": -75.3,
                "time": (timezone.now() + timedelta(days=6)).isoformat(),
                "host_kind": "person",
                "list_on_church_calendar": True,
                "age_max": 120,
            },
            format="json",
        )
        self.assertEqual(admin_event.status_code, status.HTTP_201_CREATED)
        self.assertTrue(admin_event.data["calendar_approved"])

        Church.objects.all().delete()
        missing_church = self.client.post(
            reverse("activity-list"),
            {
                "title": "No church",
                "description": "Missing seed.",
                "location": "Hall",
                "latitude": 40.3,
                "longitude": -75.3,
                "time": (timezone.now() + timedelta(days=6)).isoformat(),
                "host_kind": "church",
            },
            format="json",
        )
        self.assertEqual(missing_church.status_code, status.HTTP_400_BAD_REQUEST)

    def test_photo_limits_and_deletion(self):
        activity = _activity(self.host)
        self.client.force_authenticate(self.parent)
        forbidden = self.client.post(
            reverse("activity-photo-upload", args=[activity.id]),
            {"photo": _jpeg_upload()},
            format="multipart",
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.host)
        missing = self.client.post(reverse("activity-photo-upload", args=[activity.id]), {})
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        bad = self.client.post(
            reverse("activity-photo-upload", args=[activity.id]),
            {"file": SimpleUploadedFile("notes.txt", b"hello")},
            format="multipart",
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

        for _ in range(50):
            photo = EventPhoto(activity=activity)
            photo.image.save("seed.jpg", _jpeg_upload(), save=True)
        limited = self.client.post(
            reverse("activity-photo-upload", args=[activity.id]),
            {"image": _jpeg_upload()},
            format="multipart",
        )
        self.assertEqual(limited.status_code, status.HTTP_400_BAD_REQUEST)

        photo = activity.photos.first()
        self.client.force_authenticate(self.parent)
        denied = self.client.delete(reverse("activity-photo-delete", args=[activity.id, photo.id]))
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(None)
        anon = self.client.delete(reverse("activity-photo-file", args=[activity.id, photo.id]))
        self.assertEqual(anon.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.force_authenticate(self.host)
        gone = self.client.delete(reverse("activity-photo-file", args=[activity.id, photo.id]))
        self.assertEqual(gone.status_code, status.HTTP_204_NO_CONTENT)
        missing_photo = self.client.delete(
            reverse("activity-photo-delete", args=[activity.id, 999999])
        )
        self.assertEqual(missing_photo.status_code, status.HTTP_404_NOT_FOUND)

        leftover = activity.photos.first()
        EventPhoto.objects.filter(pk=leftover.pk).update(image="")
        empty = self.client.get(reverse("activity-photo-file", args=[activity.id, leftover.id]))
        self.assertEqual(empty.status_code, status.HTTP_404_NOT_FOUND)

        activity.images = ["https://example.com/cover.jpg"]
        activity.save(update_fields=["images"])
        stored = Activity.objects.get(pk=activity.pk)
        self.assertEqual(stored.platform_fee_percent, 0)

    def test_public_ics_includes_end_photo_and_escaped_text(self):
        activity = _activity(
            self.host,
            title="Soup; Salad, and \\Bread",
            description="Line one\nLine two " + ("warm " * 30),
            list_on_church_calendar=True,
            calendar_approved=True,
            end_time=timezone.now() + timedelta(days=7, hours=2),
            images=["https://example.com/soup.jpg"],
            host_kind="church",
            host_church=Church.objects.get(name=FRANCONIA_CHURCH_NAME),
        )
        body = public_calendar_ics([activity])
        self.assertIn("DTEND:", body)
        self.assertIn("soup.jpg", body)
        self.assertIn("\\;", body)
        response = self.client.get(reverse("public-calendar-ics"))
        self.assertIn(activity.title.split(";")[0], response.content.decode())

    def test_join_leave_remove_and_activity_chat(self):
        activity = _activity(self.host, capacity=1)
        ActivityParticipant.objects.create(
            activity=activity, user=self.host, status="confirmed", include_self=True
        )
        self.client.force_authenticate(self.parent)
        full = self.client.post(reverse("join-activity", args=[activity.id]))
        self.assertEqual(full.status_code, status.HTTP_400_BAD_REQUEST)

        activity.capacity = 5
        activity.save(update_fields=["capacity"])
        joined = self.client.post(reverse("join-activity", args=[activity.id]))
        self.assertEqual(joined.status_code, status.HTTP_201_CREATED)
        again = self.client.post(reverse("join-activity", args=[activity.id]))
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.admin)
        forbidden = self.client.delete(
            reverse("remove-activity-participant", args=[activity.id, self.parent.id])
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.host)
        self_remove = self.client.delete(
            reverse("remove-activity-participant", args=[activity.id, self.host.id])
        )
        self.assertEqual(self_remove.status_code, status.HTTP_400_BAD_REQUEST)
        removed = self.client.delete(
            reverse("remove-activity-participant", args=[activity.id, self.parent.id])
        )
        self.assertEqual(removed.status_code, status.HTTP_200_OK)
        missing = self.client.delete(
            reverse("remove-activity-participant", args=[activity.id, self.parent.id])
        )
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)

        self.client.force_authenticate(self.parent)
        not_going = self.client.post(reverse("leave-activity", args=[activity.id]))
        self.assertEqual(not_going.status_code, status.HTTP_400_BAD_REQUEST)
        self.client.post(reverse("join-activity", args=[activity.id]))
        left = self.client.post(reverse("leave-activity", args=[activity.id]))
        self.assertEqual(left.status_code, status.HTTP_200_OK)

        blocked = self.client.get(reverse("activity-chat", args=[activity.id]))
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)

        ActivityParticipant.objects.filter(activity=activity, user=self.host).delete()
        ActivityParticipant.objects.create(
            activity=activity, user=self.parent, status="confirmed", include_self=True
        )
        self.client.force_authenticate(self.host)
        empty = self.client.get(reverse("activity-chat", args=[activity.id]))
        self.assertEqual(empty.status_code, status.HTTP_200_OK)
        self.assertEqual(empty.data, [])
        too_few = self.client.post(
            reverse("activity-chat", args=[activity.id]),
            {"message": "Hello"},
            format="json",
        )
        self.assertEqual(too_few.status_code, status.HTTP_400_BAD_REQUEST)

        ActivityParticipant.objects.create(
            activity=activity, user=self.admin, status="confirmed", include_self=True
        )
        blank = self.client.post(reverse("activity-chat", args=[activity.id]), {}, format="json")
        self.assertEqual(blank.status_code, status.HTTP_400_BAD_REQUEST)
        sent = self.client.post(
            reverse("activity-chat", args=[activity.id]),
            {"message": "Welcome"},
            format="json",
        )
        self.assertEqual(sent.status_code, status.HTTP_201_CREATED)
        listed = self.client.get(reverse("activity-chat", args=[activity.id]))
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data[0]["message"], "Welcome")
