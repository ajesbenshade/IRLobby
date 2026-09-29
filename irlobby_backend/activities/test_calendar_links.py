"""Per-gathering calendar files and subscribe links. No device calendar permission."""

from datetime import datetime, timedelta
from datetime import timezone as datetime_timezone
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit
from zoneinfo import ZoneInfo

from django.core.signing import Signer
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import Activity, HouseholdDependent
from activities.public_calendar import (
    CHURCH_CALENDAR_NAME,
    ICS_PRODID,
    ICS_TOKEN_SALT,
    activity_id_from_ics_token,
    build_calendar_links,
    event_ics,
    event_ics_token,
    public_calendar_ics,
    to_webcal,
)
from activities.test_foyer import _activity, _safe_birthdate
from users.models import User

NY = ZoneInfo("America/New_York")


def _unfold(text: str) -> str:
    return text.replace("\r\n ", "").replace("\n ", "")


class CalendarLinkTests(APITestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            username="cal-link-host",
            email="private-host@example.com",
            password="password123",
            first_name="Sarah",
            last_name="Host",
            date_of_birth=_safe_birthdate(42),
            sex="female",
        )
        self.child = HouseholdDependent.objects.create(
            parent=self.host,
            name="SecretChild",
            date_of_birth=_safe_birthdate(6),
            sex="female",
        )
        self.start = datetime(2026, 3, 4, 15, 0, tzinfo=datetime_timezone.utc)
        self.end = datetime(2026, 3, 4, 17, 30, tzinfo=datetime_timezone.utc)
        self.approved = _activity(
            self.host,
            title="Soup & Hymns",
            description="Bring bread\nand soup",
            location="Hall, 123 Main",
            time=self.start,
            end_time=self.end,
            list_on_church_calendar=True,
            calendar_approved=True,
        )
        self.waiting = _activity(
            self.host,
            title="Unapproved Picnic",
            description="Not yet",
            list_on_church_calendar=True,
            calendar_approved=False,
            time=self.start,
        )
        self.private = _activity(
            self.host,
            title="Backyard Hymns",
            description="Just the porch.",
            location="Porch",
            time=self.start,
            end_time=self.end,
            list_on_church_calendar=False,
            calendar_approved=False,
        )

    def _links(self, activity):
        self.client.force_authenticate(self.host)
        detail = self.client.get(reverse("activity-detail", args=[activity.id]))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        return detail.data["calendar_links"]

    def _fetch(self, url, **extra):
        self.client.force_authenticate(None)
        parts = urlsplit(url)
        return self.client.get(
            f"{parts.path}?{parts.query}" if parts.query else parts.path, **extra
        )

    def test_public_event_ics_is_valid_and_has_no_private_fields(self):
        links = self._links(self.approved)
        self.assertEqual(
            set(links),
            {"ics_url", "webcal_url", "google_url", "outlook_url"},
        )
        self.assertIn(f"/api/public/events/{self.approved.id}.ics", links["ics_url"])
        self.assertNotIn("token=", links["ics_url"])
        self.assertEqual(
            links["webcal_url"].split("://", 1)[1], links["ics_url"].split("://", 1)[1]
        )
        self.assertTrue(links["webcal_url"].startswith("webcal://"))

        response = self._fetch(links["ics_url"], HTTP_AUTHORIZATION="Bearer not-a-jwt")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("text/calendar", response["Content-Type"])
        self.assertEqual(response["Cache-Control"], "public, max-age=300")
        text = _unfold(response.content.decode())
        self.assertIn(f"PRODID:{ICS_PRODID}", text)
        self.assertIn("SUMMARY:Soup & Hymns", text)
        self.assertIn("DTSTART:20260304T150000Z", text)
        self.assertIn("DTEND:20260304T173000Z", text)
        self.assertLess(text.index("DTSTART:"), text.index("DTEND:"))
        self.assertIn("LOCATION:Hall\\, 123 Main", text)
        self.assertIn("Host: Sarah Host", text)
        self.assertIn("Bring bread", text)
        self.assertIn(f"UID:foyer-activity-{self.approved.id}@franconiamennonite.org", text)
        self.assertIn("LAST-MODIFIED:", text)
        self.assertIn("SEQUENCE:", text)
        self.assertIn("X-WR-TIMEZONE:America/New_York", text)
        self.assertNotIn("ATTENDEE", text)
        self.assertNotIn("private-host@example.com", text)
        self.assertNotIn("SecretChild", text)
        self.assertNotIn(self.host.date_of_birth.isoformat(), text)
        self.assertNotIn("Audience:", text)

        direct = self.client.get(reverse("public-event-ics", args=[self.approved.id]))
        self.assertEqual(direct.status_code, status.HTTP_200_OK)

    def test_google_and_outlook_links_are_encoded(self):
        links = self._links(self.approved)
        google = urlsplit(links["google_url"])
        self.assertEqual(google.scheme, "https")
        self.assertEqual(google.netloc, "calendar.google.com")
        self.assertEqual(google.path, "/calendar/render")
        google_query = parse_qs(google.query)
        self.assertEqual(google_query["action"], ["TEMPLATE"])
        self.assertEqual(google_query["text"], ["Soup & Hymns"])
        self.assertEqual(google_query["dates"], ["20260304T150000Z/20260304T173000Z"])
        self.assertEqual(google_query["location"], ["Hall, 123 Main"])
        self.assertEqual(google_query["details"], ["Host: Sarah Host\nBring bread\nand soup"])
        self.assertIn("text=Soup%20%26%20Hymns", links["google_url"])
        self.assertIn("location=Hall%2C%20123%20Main", links["google_url"])

        outlook = urlsplit(links["outlook_url"])
        self.assertEqual(outlook.netloc, "outlook.live.com")
        self.assertEqual(outlook.path, "/calendar/0/deeplink/compose")
        outlook_query = parse_qs(outlook.query)
        self.assertEqual(outlook_query["subject"], ["Soup & Hymns"])
        self.assertEqual(outlook_query["startdt"], ["2026-03-04T15:00:00Z"])
        self.assertEqual(outlook_query["enddt"], ["2026-03-04T17:30:00Z"])
        self.assertEqual(outlook_query["location"], ["Hall, 123 Main"])
        self.assertEqual(outlook_query["body"], ["Host: Sarah Host\nBring bread\nand soup"])
        self.assertIn("startdt=2026-03-04T15%3A00%3A00Z", links["outlook_url"])

    def test_private_token_cannot_be_guessed_or_enumerated(self):
        links = self._links(self.private)
        self.assertIn("/api/public/event.ics?token=", links["ics_url"])
        self.assertNotIn(f"/events/{self.private.id}.ics", links["ics_url"])
        token = parse_qs(urlsplit(links["ics_url"]).query)["token"][0]
        self.assertEqual(token, event_ics_token(self.private.id))
        self.assertEqual(event_ics_token(self.private.id), event_ics_token(self.private.id))
        self.assertNotEqual(token, str(self.private.id))
        signed_id = token.split(":", 1)[0]
        self.assertEqual(signed_id, str(self.private.id))
        self.assertGreater(len(token.split(":", 1)[1]), 8)

        self.client.force_authenticate(None)
        opened = self._fetch(links["ics_url"])
        self.assertEqual(opened.status_code, status.HTTP_200_OK)
        self.assertEqual(opened["Cache-Control"], "private, max-age=300")
        text = _unfold(opened.content.decode())
        self.assertIn("SUMMARY:Backyard Hymns", text)
        self.assertIn("Host: Sarah Host", text)
        self.assertIn(f"PRODID:{ICS_PRODID}", text)
        self.assertNotIn("ATTENDEE", text)
        self.assertNotIn("private-host@example.com", text)
        self.assertNotIn("SecretChild", text)

        hidden = self.client.get(reverse("public-event-ics", args=[self.private.id]))
        self.assertEqual(hidden.status_code, status.HTTP_404_NOT_FOUND)
        self.assertNotIn(b"Backyard Hymns", hidden.content)

        unapproved = self.client.get(reverse("public-event-ics", args=[self.waiting.id]))
        self.assertEqual(unapproved.status_code, status.HTTP_404_NOT_FOUND)
        self.assertNotIn(b"Unapproved Picnic", unapproved.content)

        missing = self.client.get(reverse("public-event-ics", args=[999999]))
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)

        guesses = [
            "",
            "1",
            "0",
            str(self.private.id),
            str(self.approved.id),
            "null",
            token[:-1] + ("A" if token[-1] != "A" else "B"),
            Signer(salt="other-salt").sign(str(self.private.id)),
            Signer(salt=ICS_TOKEN_SALT).sign("not-an-id"),
            token.replace(str(self.private.id), str(self.approved.id), 1),
        ]
        for guess in guesses:
            response = self.client.get(reverse("private-event-ics"), {"token": guess})
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND, guess)
            self.assertNotIn(b"Backyard Hymns", response.content)
            self.assertNotIn(b"Soup", response.content)

        self.assertIsNone(activity_id_from_ics_token(""))
        self.assertIsNone(activity_id_from_ics_token(Signer(salt=ICS_TOKEN_SALT).sign("nope")))

        other = self._fetch(self._links(self.approved)["ics_url"])
        self.assertIn(b"Soup & Hymns", other.content)
        self.assertNotIn(b"Backyard Hymns", other.content)

        self.private.delete()
        gone = self.client.get(reverse("private-event-ics"), {"token": token})
        self.assertEqual(gone.status_code, status.HTTP_404_NOT_FOUND)

    def test_unapproved_events_stay_off_the_public_feed(self):
        feed = self.client.get(reverse("public-calendar"))
        titles = [event["title"] for event in feed.data["events"]]
        self.assertIn("Soup & Hymns", titles)
        self.assertNotIn("Unapproved Picnic", titles)
        self.assertNotIn("Backyard Hymns", titles)

        ics = self.client.get(reverse("public-calendar-ics"))
        self.assertEqual(ics.status_code, status.HTTP_200_OK)
        self.assertEqual(ics["Cache-Control"], "public, max-age=300")
        text = _unfold(ics.content.decode())
        self.assertIn(f"X-WR-CALNAME:{CHURCH_CALENDAR_NAME}", text)
        self.assertIn("–", CHURCH_CALENDAR_NAME)
        self.assertIn(f"UID:foyer-activity-{self.approved.id}@franconiamennonite.org", text)
        self.assertIn("DTSTAMP:", text)
        self.assertIn("LAST-MODIFIED:", text)
        self.assertNotIn("Unapproved Picnic", text)
        self.assertNotIn("Backyard Hymns", text)
        self.assertNotIn(f"foyer-activity-{self.waiting.id}@", text)
        self.assertNotIn("STATUS:CANCELLED", text)
        self.assertNotIn("private-host@example.com", text)
        self.assertNotIn("SecretChild", text)

        Activity.objects.filter(pk=self.approved.pk).update(
            updated_at=timezone.now() - timedelta(days=5)
        )
        self.approved.refresh_from_db()
        before = _unfold(public_calendar_ics([self.approved]))
        sequence_before = int(before.split("SEQUENCE:", 1)[1].split("\r\n", 1)[0])
        uid = f"UID:foyer-activity-{self.approved.id}@franconiamennonite.org"
        self.approved.title = "Soup & Hymns Revised"
        self.approved.save()
        self.approved.refresh_from_db()
        after = _unfold(public_calendar_ics([self.approved]))
        sequence_after = int(after.split("SEQUENCE:", 1)[1].split("\r\n", 1)[0])
        self.assertGreater(sequence_after, sequence_before)
        self.assertIn(uid, before)
        self.assertIn(uid, after)

        self.approved.delete()
        self.waiting.calendar_approved = False
        self.waiting.save(update_fields=["calendar_approved"])
        refreshed = _unfold(self.client.get(reverse("public-calendar-ics")).content.decode())
        self.assertNotIn("Soup & Hymns", refreshed)
        self.assertNotIn("Unapproved Picnic", refreshed)

    def test_zero_length_and_new_york_midnight_do_not_break(self):
        moment = datetime(2026, 1, 15, 18, 0, tzinfo=datetime_timezone.utc)
        self.private.end_time = moment
        self.private.time = moment
        self.private.save()
        body = _unfold(event_ics(self.private))
        self.assertIn("DTSTART:20260115T180000Z", body)
        self.assertNotIn("DTEND:", body)
        self.assertIn("BEGIN:VCALENDAR", body)
        self.assertIn("END:VCALENDAR", body)
        links = build_calendar_links(self.private, None)
        self.assertIn("20260115T180000Z/20260115T190000Z", links["google_url"])
        self.assertIn("startdt=2026-01-15T18%3A00%3A00Z", links["outlook_url"])
        self.assertIn("enddt=2026-01-15T19%3A00%3A00Z", links["outlook_url"])
        self.assertTrue(links["ics_url"].startswith("/api/public/event.ics?token="))
        self.assertEqual(links["webcal_url"], links["ics_url"])

        self.private.end_time = None
        self.private.save()
        self.assertNotIn("DTEND:", _unfold(event_ics(self.private)))

        self.private.end_time = moment - timedelta(hours=3)
        self.private.save()
        inverted = _unfold(event_ics(self.private))
        self.assertIn("DTSTART:20260115T180000Z", inverted)
        self.assertNotIn("DTEND:", inverted)

        start = datetime(2026, 6, 15, 0, 0, tzinfo=NY)
        end = datetime(2026, 6, 16, 0, 0, tzinfo=NY)
        self.approved.time = start
        self.approved.end_time = end
        self.approved.save()
        summer = _unfold(event_ics(self.approved))
        self.assertIn("DTSTART:20260615T040000Z", summer)
        self.assertIn("DTEND:20260616T040000Z", summer)
        self.assertLess(summer.index("DTSTART:"), summer.index("DTEND:"))

        winter_start = datetime(2026, 1, 10, 0, 0, tzinfo=NY)
        winter_end = datetime(2026, 1, 11, 0, 0, tzinfo=NY)
        self.approved.time = winter_start
        self.approved.end_time = winter_end
        self.approved.save()
        winter = _unfold(event_ics(self.approved))
        self.assertIn("DTSTART:20260110T050000Z", winter)
        self.assertIn("DTEND:20260111T050000Z", winter)

        naive = datetime(2026, 1, 2, 3, 4)
        self.assertEqual(
            int(_unfold(event_ics(self.private)).count("BEGIN:VEVENT")),
            1,
        )
        blank = SimpleNamespace(
            id=4,
            title="",
            description="",
            location="",
            time=naive,
            end_time=None,
            updated_at=None,
            created_at=None,
            host_kind="person",
            host_church=None,
            host=self.host,
            list_on_church_calendar=False,
            calendar_approved=False,
            audience_gender="everyone",
            age_min=None,
            age_max=None,
            images=[],
            photos=SimpleNamespace(all=list),
        )
        rendered = _unfold(event_ics(blank))
        self.assertIn("DTSTART:20260102T030400Z", rendered)
        self.assertIn("Host: Sarah Host", rendered)
        self.assertNotIn("DTEND:", rendered)

    def test_list_payload_includes_the_same_links(self):
        self.client.force_authenticate(self.host)
        listing = self.client.get(reverse("activity-list"))
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        rows = listing.data["results"]
        private_row = next(row for row in rows if row["id"] == self.private.id)
        approved_row = next(row for row in rows if row["id"] == self.approved.id)
        self.assertIn("token=", private_row["calendar_links"]["ics_url"])
        self.assertIn(
            f"/api/public/events/{self.approved.id}.ics",
            approved_row["calendar_links"]["ics_url"],
        )
        hosted = self.client.get(reverse("hosted-activities"))
        hosted_rows = hosted.data["results"]
        self.assertTrue(any("calendar_links" in row for row in hosted_rows))

    def test_email_shaped_host_name_is_not_copied_into_the_file(self):
        self.host.first_name = ""
        self.host.last_name = ""
        self.host.username = "hidden@example.com"
        self.host.save(update_fields=["first_name", "last_name", "username"])
        text = _unfold(event_ics(self.private))
        self.assertIn("Host: Host", text)
        self.assertNotIn("hidden@example.com", text)
        self.assertNotIn("@", text.split("DESCRIPTION:", 1)[1].split("END:VEVENT", 1)[0])

    @override_settings(ALLOWED_HOSTS=["example.com", "testserver"])
    def test_webcal_swaps_http_and_https(self):
        self.assertEqual(
            to_webcal("https://example.com/api/public/calendar.ics"),
            "webcal://example.com/api/public/calendar.ics",
        )
        self.assertEqual(
            to_webcal("http://example.com/api/public/events/3.ics"),
            "webcal://example.com/api/public/events/3.ics",
        )
        self.assertEqual(
            to_webcal("/api/public/event.ics?token=abc"), "/api/public/event.ics?token=abc"
        )
