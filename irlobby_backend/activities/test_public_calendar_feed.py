"""Public church calendar: id/url, past-event filter, absolute .ics photos, anon throttle."""

import shutil
import tempfile
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import EventPhoto
from activities.public_calendar import (
    InvalidFromDate,
    event_ics_token,
    parse_from_param,
    public_calendar_queryset,
)
from activities.test_foyer import (
    _activity,
    _join_website_calendar_church,
    _jpeg_upload,
    _safe_birthdate,
)
from users.models import User

NY = ZoneInfo("America/New_York")
_MEDIA = tempfile.mkdtemp(prefix="foyer-public-cal-")


def _unfold(text: str) -> str:
    return text.replace("\r\n ", "").replace("\n ", "")


def _throttle_rates(rate):
    from django.conf import settings

    rest = dict(settings.REST_FRAMEWORK)
    rates = dict(rest["DEFAULT_THROTTLE_RATES"])
    rates["public_calendar"] = rate
    rest["DEFAULT_THROTTLE_RATES"] = rates
    return rest


@override_settings(
    MEDIA_ROOT=_MEDIA,
    PUBLIC_API_BASE_URL="https://api.irlobby.com",
    PUBLIC_WEB_BASE_URL="https://irlobby.com",
)
class PublicCalendarFeedTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(_MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.host = User.objects.create_user(
            username="feed-host",
            email="feed-host@example.com",
            password="feed-pass-123",
            first_name="Sarah",
            last_name="Host",
            date_of_birth=_safe_birthdate(40),
            sex="female",
        )
        _join_website_calendar_church(self.host)
        now = timezone.now()
        listed = dict(list_on_church_calendar=True, calendar_approved=True)
        self.upcoming = _activity(
            self.host,
            title="Upcoming Supper",
            time=now + timedelta(days=3),
            end_time=now + timedelta(days=3, hours=2),
            **listed,
        )
        self.long_ago = _activity(
            self.host,
            title="Old Picnic",
            time=now - timedelta(days=10),
            end_time=now - timedelta(days=10) + timedelta(hours=2),
            **listed,
        )
        # Started 30 hours ago but ended 2 hours ago: still within the window.
        self.just_ended = _activity(
            self.host,
            title="Overnight Retreat",
            time=now - timedelta(hours=30),
            end_time=now - timedelta(hours=2),
            **listed,
        )
        # No end time, started 12 hours ago: kept.
        self.today_no_end = _activity(
            self.host,
            title="Morning Prayer",
            time=now - timedelta(hours=12),
            end_time=None,
            **listed,
        )
        # No end time, started 3 days ago: hidden.
        self.old_no_end = _activity(
            self.host,
            title="Old Hymn Sing",
            time=now - timedelta(days=3),
            end_time=None,
            **listed,
        )
        photo = EventPhoto(activity=self.upcoming)
        photo.image.save("cover.jpg", _jpeg_upload(), save=True)
        self.photo = photo

    def _titles(self, response):
        return [event["title"] for event in response.data["events"]]

    # 1. id and url

    def test_events_have_id_and_gathering_url(self):
        response = self.client.get(reverse("public-calendar"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        event = next(e for e in response.data["events"] if e["title"] == "Upcoming Supper")
        self.assertEqual(event["id"], self.upcoming.id)
        self.assertEqual(event["url"], f"https://irlobby.com/gatherings/{self.upcoming.id}")
        # Existing fields are unchanged.
        for key in (
            "title",
            "start",
            "end",
            "location",
            "host_name",
            "audience",
            "description",
            "cover_photo_url",
            "is_full",
        ):
            self.assertIn(key, event)

    @override_settings(PUBLIC_WEB_BASE_URL="https://staging.example.org")
    def test_url_uses_configured_web_base(self):
        event = self.client.get(reverse("public-calendar")).data["events"][0]
        self.assertTrue(event["url"].startswith("https://staging.example.org/gatherings/"))

    # 2. past events

    def test_past_events_hidden_by_default(self):
        titles = self._titles(self.client.get(reverse("public-calendar")))
        self.assertEqual(titles, ["Overnight Retreat", "Morning Prayer", "Upcoming Supper"])
        self.assertNotIn("Old Picnic", titles)
        self.assertNotIn("Old Hymn Sing", titles)

    def test_from_param_brings_back_older_events(self):
        start = (timezone.now() - timedelta(days=11)).astimezone(NY).date().isoformat()
        titles = self._titles(self.client.get(reverse("public-calendar"), {"from": start}))
        self.assertIn("Old Picnic", titles)
        self.assertIn("Old Hymn Sing", titles)
        self.assertIn("Upcoming Supper", titles)

    def test_from_param_can_narrow_to_future(self):
        start = (timezone.now() + timedelta(days=2)).astimezone(NY).date().isoformat()
        titles = self._titles(self.client.get(reverse("public-calendar"), {"from": start}))
        self.assertEqual(titles, ["Upcoming Supper"])

    def test_blank_from_uses_default(self):
        titles = self._titles(self.client.get(reverse("public-calendar"), {"from": ""}))
        self.assertNotIn("Old Picnic", titles)
        self.assertIn("Upcoming Supper", titles)

    def test_bad_from_is_400(self):
        for bad in ("yesterday", "2026-13-01", "20261018", "2026-10-18T00:00", "1'; drop"):
            for name in ("public-calendar", "public-calendar-ics"):
                response = self.client.get(reverse(name), {"from": bad})
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, (name, bad))
                self.assertIn("YYYY-MM-DD", response.json()["detail"])

    def test_parse_from_param_is_midnight_new_york(self):
        parsed = parse_from_param("2026-10-18")
        self.assertEqual(parsed, datetime(2026, 10, 18, 0, 0, tzinfo=NY))
        self.assertIsNone(parse_from_param(None))
        self.assertIsNone(parse_from_param("  "))
        with self.assertRaises(InvalidFromDate):
            parse_from_param("10/18/2026")

    def test_queryset_without_since_is_unfiltered(self):
        titles = set(public_calendar_queryset().values_list("title", flat=True))
        self.assertIn("Old Picnic", titles)

    def test_calendar_ics_hides_past_by_default_and_honors_from(self):
        text = _unfold(self.client.get(reverse("public-calendar-ics")).content.decode())
        self.assertIn(f"UID:foyer-activity-{self.upcoming.id}@", text)
        self.assertIn(f"UID:foyer-activity-{self.just_ended.id}@", text)
        self.assertNotIn(f"UID:foyer-activity-{self.long_ago.id}@", text)
        start = (timezone.now() - timedelta(days=11)).astimezone(NY).date().isoformat()
        text = _unfold(
            self.client.get(reverse("public-calendar-ics"), {"from": start}).content.decode()
        )
        self.assertIn(f"UID:foyer-activity-{self.long_ago.id}@", text)

    def test_single_event_ics_still_works_for_past_events(self):
        response = self.client.get(reverse("public-event-ics", args=[self.long_ago.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Old Picnic", response.content.decode())
        token = event_ics_token(self.long_ago.id)
        signed = self.client.get(reverse("private-event-ics"), {"token": token})
        self.assertEqual(signed.status_code, status.HTTP_200_OK)

    # 3. absolute photo URLs in .ics

    def test_calendar_ics_photo_is_absolute(self):
        text = _unfold(self.client.get(reverse("public-calendar-ics")).content.decode())
        expected = (
            f"Photo: https://api.irlobby.com/api/activities/{self.upcoming.id}"
            f"/photos/{self.photo.id}/"
        )
        self.assertIn(expected, text)
        self.assertNotIn("Photo: /api/", text)

    def test_single_event_ics_photo_is_absolute(self):
        text = _unfold(
            self.client.get(reverse("public-event-ics", args=[self.upcoming.id])).content.decode()
        )
        self.assertIn(f"Photo: https://api.irlobby.com/api/activities/{self.upcoming.id}/", text)

    def test_signed_event_ics_photo_is_absolute_for_public_event(self):
        token = event_ics_token(self.upcoming.id)
        text = _unfold(
            self.client.get(reverse("private-event-ics"), {"token": token}).content.decode()
        )
        self.assertIn(f"Photo: https://api.irlobby.com/api/activities/{self.upcoming.id}/", text)

    def test_signed_event_ics_omits_uploaded_photo_of_private_gathering(self):
        private = _activity(self.host, title="Porch Hymns", location="Porch")
        photo = EventPhoto(activity=private)
        photo.image.save("porch.jpg", _jpeg_upload(), save=True)
        token = event_ics_token(private.id, hide_location=True)
        text = _unfold(
            self.client.get(reverse("private-event-ics"), {"token": token}).content.decode()
        )
        self.assertIn("Porch Hymns", text)
        self.assertNotIn("Photo:", text)
        self.assertNotIn(f"/photos/{photo.id}/", text)

    def test_external_https_image_passes_through(self):
        external = _activity(
            self.host,
            title="Linked Image",
            images=["https://cdn.example.org/a.jpg"],
            list_on_church_calendar=True,
            calendar_approved=True,
        )
        text = _unfold(
            self.client.get(reverse("public-event-ics", args=[external.id])).content.decode()
        )
        self.assertIn("Photo: https://cdn.example.org/a.jpg", text)

    # 4. anonymous throttle

    def test_public_endpoints_are_rate_limited_per_ip(self):
        with override_settings(REST_FRAMEWORK=_throttle_rates("3/min")):
            urls = [
                reverse("public-calendar"),
                reverse("public-calendar-ics"),
                reverse("public-event-ics", args=[self.upcoming.id]),
            ]
            for url in urls:
                cache.clear()
                for _ in range(3):
                    ok = self.client.get(url, REMOTE_ADDR="10.0.0.5")
                    self.assertEqual(ok.status_code, status.HTTP_200_OK, url)
                limited = self.client.get(url, REMOTE_ADDR="10.0.0.5")
                self.assertEqual(limited.status_code, status.HTTP_429_TOO_MANY_REQUESTS, url)
                other = self.client.get(url, REMOTE_ADDR="10.0.0.6")
                self.assertEqual(other.status_code, status.HTTP_200_OK, url)

    def test_signed_event_ics_is_rate_limited(self):
        token = event_ics_token(self.upcoming.id)
        with override_settings(REST_FRAMEWORK=_throttle_rates("1/min")):
            first = self.client.get(reverse("private-event-ics"), {"token": token})
            second = self.client.get(reverse("private-event-ics"), {"token": token})
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_throttle_keys_on_forwarded_for_behind_nginx(self):
        with override_settings(REST_FRAMEWORK=_throttle_rates("2/min")):
            url = reverse("public-calendar")
            proxy = {"REMOTE_ADDR": "172.18.0.2"}
            for _ in range(2):
                self.assertEqual(
                    self.client.get(url, HTTP_X_FORWARDED_FOR="203.0.113.7", **proxy).status_code,
                    status.HTTP_200_OK,
                )
            self.assertEqual(
                self.client.get(url, HTTP_X_FORWARDED_FOR="203.0.113.7", **proxy).status_code,
                status.HTTP_429_TOO_MANY_REQUESTS,
            )
            # A different client behind the same proxy has its own bucket.
            self.assertEqual(
                self.client.get(url, HTTP_X_FORWARDED_FOR="198.51.100.9", **proxy).status_code,
                status.HTTP_200_OK,
            )

    # 5. caching unchanged

    def test_ics_cache_headers_unchanged(self):
        for url in (
            reverse("public-calendar-ics"),
            reverse("public-event-ics", args=[self.upcoming.id]),
        ):
            self.assertEqual(self.client.get(url)["Cache-Control"], "public, max-age=300")
        token = event_ics_token(self.upcoming.id)
        signed = self.client.get(reverse("private-event-ics"), {"token": token})
        self.assertEqual(signed["Cache-Control"], "private, max-age=300")
