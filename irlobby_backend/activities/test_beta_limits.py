"""Beta limits: 1 gathering per rolling week for members, photo upload throttle, photo cleanup."""

import os
import shutil
import tempfile
from datetime import timedelta
from io import StringIO

from django.core.cache import cache
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.test import APITestCase

from activities.management.commands.find_orphan_photos import orphan_photo_names
from activities.models import Activity, Church, EventCreationLog, EventPhoto
from activities.test_foyer import _activity, _jpeg_upload, _safe_birthdate
from users.models import User

CREATE_URL = reverse("activity-list")
PROFILE_URL = reverse("user-profile")
ADMIN_EMAIL = "pastor@example.com"
REVIEW_EMAIL = "app-review@irlobby.com"


def _user(name, email=None, **extra):
    return User.objects.create_user(
        username=name,
        email=email or f"{name}@example.com",
        password="Passw0rd-123",
        first_name=name.capitalize(),
        date_of_birth=_safe_birthdate(40),
        **extra,
    )


def _payload(**overrides):
    payload = {
        "title": "Supper Club",
        "description": "Dinner at our place.",
        "location": "12 Maple Lane",
        "latitude": 40.31,
        "longitude": -75.34,
        "time": (timezone.now() + timedelta(days=3)).isoformat(),
        "capacity": 6,
        "tags": [],
        "images": [],
    }
    payload.update(overrides)
    return payload


@override_settings(
    FOYER_CHURCH_ADMIN_EMAILS=[ADMIN_EMAIL],
    FOYER_EVENT_CREATE_LIMIT=1,
    FOYER_EVENT_CREATE_WINDOW_DAYS=7,
    FOYER_EVENT_LIMIT_EXEMPT_EMAILS=[REVIEW_EMAIL],
)
class EventCreateLimitTests(APITestCase):
    def setUp(self):
        self.member = _user("member")
        self.client.force_authenticate(self.member)

    def create(self, user=None, **overrides):
        if user is not None:
            self.client.force_authenticate(user)
        return self.client.post(CREATE_URL, _payload(**overrides), format="json")

    def assert_blocked(self, response):
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS, response.data)
        body = response.json()
        self.assertEqual(body["code"], "event_limit_reached")
        self.assertEqual(body["limit"], 1)
        self.assertEqual(body["period"], "week")
        self.assertIsInstance(body["retry_after"], int)
        self.assertGreater(body["retry_after"], 0)
        self.assertIn("detail", body)
        self.assertTrue(body["detail"])
        self.assertEqual(response["Retry-After"], str(body["retry_after"]))
        self.assertIsNotNone(parse_datetime(body["next_allowed_at"]))
        return body

    def test_first_event_allowed_second_blocked_with_full_error_shape(self):
        first = self.create()
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        activity = Activity.objects.get(pk=first.data["id"])

        body = self.assert_blocked(self.create(title="Another"))
        expected = activity.created_at + timedelta(days=7)
        self.assertEqual(parse_datetime(body["next_allowed_at"]), expected)
        seconds = (expected - timezone.now()).total_seconds()
        self.assertAlmostEqual(body["retry_after"], seconds, delta=5)
        self.assertEqual(Activity.objects.filter(host=self.member).count(), 1)

    def test_cancelled_event_still_counts(self):
        first = self.create()
        Activity.objects.filter(pk=first.data["id"]).update(
            is_cancelled=True, cancelled_at=timezone.now()
        )
        self.assert_blocked(self.create(title="Retry"))

    def test_deleted_event_still_counts(self):
        first = self.create()
        deleted = self.client.delete(reverse("activity-detail", args=[first.data["id"]]))
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Activity.objects.filter(pk=first.data["id"]).exists())
        log = EventCreationLog.objects.get(user=self.member)
        self.assertEqual(log.activity_id, first.data["id"])
        self.assert_blocked(self.create(title="Retry"))

    def test_window_boundary(self):
        _activity(self.member)  # created outside the API: still logged
        log = EventCreationLog.objects.get(user=self.member)

        # 60 seconds before the window ends: still blocked, about a minute to wait.
        log.created_at = timezone.now() - timedelta(days=7) + timedelta(seconds=60)
        log.save(update_fields=["created_at"])
        body = self.assert_blocked(self.create())
        self.assertLessEqual(body["retry_after"], 60)
        self.assertGreaterEqual(body["retry_after"], 50)

        # Just past seven days: allowed again.
        log.created_at = timezone.now() - timedelta(days=7, seconds=1)
        log.save(update_fields=["created_at"])
        self.assertEqual(self.create().status_code, status.HTTP_201_CREATED)

    def test_editing_existing_event_is_unaffected(self):
        first = self.create()
        self.assert_blocked(self.create(title="Second"))
        edit = self.client.patch(
            reverse("activity-detail", args=[first.data["id"]]),
            {"title": "Renamed"},
            format="json",
        )
        self.assertEqual(edit.status_code, status.HTTP_200_OK, edit.data)
        self.assertEqual(Activity.objects.get(pk=first.data["id"]).title, "Renamed")

    def test_other_peoples_events_do_not_count(self):
        _activity(_user("neighbor"))
        self.assertEqual(self.create().status_code, status.HTTP_201_CREATED)

    def test_church_admin_is_exempt(self):
        admin = _user("pastor", email=ADMIN_EMAIL)
        for title in ("One", "Two", "Three"):
            self.assertEqual(self.create(admin, title=title).status_code, 201)

    def test_staff_is_exempt(self):
        staff = _user("staffer", is_staff=True)
        for title in ("One", "Two"):
            self.assertEqual(self.create(staff, title=title).status_code, 201)

    def test_superuser_is_exempt(self):
        root = _user("root", is_superuser=True)
        for title in ("One", "Two"):
            self.assertEqual(self.create(root, title=title).status_code, 201)

    def test_review_account_is_exempt_but_not_a_church_admin(self):
        reviewer = _user("reviewer", email=REVIEW_EMAIL)
        for title in ("One", "Two"):
            self.assertEqual(self.create(reviewer, title=title).status_code, 201)
        profile = self.client.get(PROFILE_URL).json()
        self.assertFalse(profile["is_church_admin"])
        self.assertTrue(profile["event_limit_exempt"])
        self.assertIsNone(profile["next_host_available_at"])
        # No church-admin powers: cannot host as the church.
        church = Church.objects.create(name="Review Test Church")
        as_church = self.create(reviewer, host_kind="church", host_church=church.id)
        self.assertNotEqual(as_church.status_code, status.HTTP_201_CREATED)

    @override_settings(FOYER_EVENT_CREATE_LIMIT=2, FOYER_EVENT_CREATE_WINDOW_DAYS=3)
    def test_limit_and_window_are_configurable(self):
        self.assertEqual(self.create(title="One").status_code, 201)
        self.assertEqual(self.create(title="Two").status_code, 201)
        response = self.create(title="Three")
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["limit"], 2)
        self.assertEqual(response.json()["period"], "3 days")

    def test_profile_reports_next_host_available_at(self):
        before = self.client.get(PROFILE_URL).json()
        self.assertFalse(before["is_church_admin"])
        self.assertFalse(before["event_limit_exempt"])
        self.assertIsNone(before["next_host_available_at"])

        first = self.create()
        activity = Activity.objects.get(pk=first.data["id"])
        after = self.client.get(PROFILE_URL).json()
        self.assertEqual(
            parse_datetime(after["next_host_available_at"]),
            activity.created_at + timedelta(days=7),
        )

    def test_church_admin_profile_flags(self):
        admin = _user("pastor", email=ADMIN_EMAIL)
        self.client.force_authenticate(admin)
        self.create(title="One")
        profile = self.client.get(PROFILE_URL).json()
        self.assertTrue(profile["is_church_admin"])
        self.assertTrue(profile["event_limit_exempt"])
        self.assertIsNone(profile["next_host_available_at"])


class PhotoBase(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media, True)
        override = override_settings(MEDIA_ROOT=self.media)
        override.enable()
        self.addCleanup(override.disable)
        self.host = _user("host")
        self.activity = _activity(self.host)

    def upload(self, activity=None, user=None):
        self.client.force_authenticate(user or self.host)
        return self.client.post(
            reverse("activity-photo-upload", args=[(activity or self.activity).id]),
            {"image": _jpeg_upload()},
            format="multipart",
        )

    def path(self, photo):
        return os.path.join(self.media, photo.image.name)


class PhotoUploadThrottleTests(PhotoBase):
    def test_31st_upload_in_an_hour_is_throttled(self):
        for _ in range(30):
            self.assertEqual(self.upload().status_code, status.HTTP_201_CREATED)
        response = self.upload()
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        body = response.json()
        self.assertEqual(body["code"], "throttled")
        self.assertTrue(body["detail"])
        self.assertIsInstance(body["retry_after"], int)
        self.assertGreater(body["retry_after"], 0)
        self.assertLessEqual(body["retry_after"], 3600)
        self.assertEqual(response["Retry-After"], str(body["retry_after"]))
        self.assertEqual(EventPhoto.objects.count(), 30)

    def test_throttle_is_per_user(self):
        other_host = _user("otherhost")
        other_event = _activity(other_host)
        with override_settings(
            REST_FRAMEWORK={"DEFAULT_THROTTLE_RATES": {"event_photo_upload": "1/hour"}}
        ):
            self.assertEqual(self.upload().status_code, 201)
            self.assertEqual(self.upload().status_code, 429)
            self.assertEqual(self.upload(other_event, other_host).status_code, 201)

    def test_non_host_rejection_does_not_use_up_the_allowance(self):
        stranger = _user("stranger")
        with override_settings(
            REST_FRAMEWORK={"DEFAULT_THROTTLE_RATES": {"event_photo_upload": "1/hour"}}
        ):
            self.assertEqual(self.upload(user=stranger).status_code, 403)
            stranger_event = _activity(stranger)
            self.assertEqual(self.upload(stranger_event, stranger).status_code, 201)

    def test_event_photo_cap_keeps_status_and_detail_and_adds_code(self):
        for _ in range(50):
            EventPhoto.objects.create(activity=self.activity, uploaded_by=self.host)
        response = self.upload()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        body = response.json()
        self.assertEqual(body["detail"], "An event can have at most 50 photos.")
        self.assertEqual(body["code"], "event_photo_limit_reached")
        self.assertEqual(body["limit"], 50)

    def test_no_lifetime_per_user_photo_cap(self):
        # 60 photos across two events (each under the 50 cap) are all accepted.
        second = _activity(self.host, title="Second")
        for _ in range(49):
            EventPhoto.objects.create(activity=self.activity, uploaded_by=self.host)
        for _ in range(11):
            EventPhoto.objects.create(activity=second, uploaded_by=self.host)
        self.assertEqual(self.upload().status_code, 201)
        self.assertEqual(self.upload(second).status_code, 201)


class PhotoCleanupTests(PhotoBase):
    def test_deleting_event_removes_photo_rows_and_files(self):
        photos = [EventPhoto.objects.get(pk=self.upload().data["id"]) for _ in range(2)]
        paths = [self.path(p) for p in photos]
        self.assertTrue(all(os.path.exists(p) for p in paths))
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(reverse("activity-detail", args=[self.activity.id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(EventPhoto.objects.filter(pk__in=[p.pk for p in photos]).exists())
        self.assertFalse(any(os.path.exists(p) for p in paths))
        # The weekly-limit record outlives the event.
        self.assertTrue(
            EventCreationLog.objects.filter(user=self.host, activity_id=self.activity.id).exists()
        )

    def test_deleting_host_account_removes_hosted_event_photo_files(self):
        photo = EventPhoto.objects.get(pk=self.upload().data["id"])
        path = self.path(photo)
        self.client.force_authenticate(self.host)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(reverse("delete-profile"))
        self.assertIn(response.status_code, (200, 204))
        self.assertFalse(Activity.objects.filter(pk=self.activity.id).exists())
        self.assertFalse(EventPhoto.objects.filter(pk=photo.pk).exists())
        self.assertFalse(os.path.exists(path))

    def test_cancelling_event_keeps_photos(self):
        photo = EventPhoto.objects.get(pk=self.upload().data["id"])
        path = self.path(photo)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse("activity-cancel-event", args=[self.activity.id]), {}, format="json"
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(EventPhoto.objects.filter(pk=photo.pk).exists())
        self.assertTrue(os.path.exists(path))

    def test_missing_file_does_not_break_event_delete(self):
        photo = EventPhoto.objects.get(pk=self.upload().data["id"])
        os.remove(self.path(photo))
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(reverse("activity-detail", args=[self.activity.id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_find_orphan_photos_is_a_dry_run_by_default(self):
        kept = EventPhoto.objects.get(pk=self.upload().data["id"])
        os.makedirs(os.path.join(self.media, "event_photos"), exist_ok=True)
        orphan = os.path.join(self.media, "event_photos", "stray.jpg")
        with open(orphan, "wb") as handle:
            handle.write(b"x")
        self.assertEqual(orphan_photo_names(), ["event_photos/stray.jpg"])

        out = StringIO()
        call_command("find_orphan_photos", stdout=out)
        self.assertIn("1 orphan photo file(s) found (dry run", out.getvalue())
        self.assertTrue(os.path.exists(orphan))

        call_command("find_orphan_photos", "--delete", stdout=StringIO())
        self.assertFalse(os.path.exists(orphan))
        self.assertTrue(os.path.exists(self.path(kept)))


class ProfileChurchTests(APITestCase):
    def setUp(self):
        self.user = _user("member")
        self.church = Church.objects.create(name="Profile Test Church")
        self.client.force_authenticate(self.user)

    def test_patch_church_id_int_null_and_alias(self):
        response = self.client.patch(PROFILE_URL, {"church_id": self.church.id}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.json()["church_id"], self.church.id)
        self.user.refresh_from_db()
        self.assertEqual(self.user.church_id, self.church.id)

        response = self.client.patch(PROFILE_URL, {"church_id": None}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.json()["church_id"])
        self.user.refresh_from_db()
        self.assertIsNone(self.user.church_id)

        response = self.client.patch(PROFILE_URL, {"churchId": self.church.id}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.json()["church_id"], self.church.id)
        self.assertEqual(self.client.get(PROFILE_URL).json()["church_id"], self.church.id)
