"""Foyer gathering rules: eligibility, RSVP headcount, fees, chat, and the public calendar."""

from datetime import date, datetime, timedelta
from datetime import timezone as datetime_timezone
from decimal import Decimal
from io import BytesIO
from unittest.mock import Mock, patch
from zoneinfo import ZoneInfo

from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, TransactionTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from activities.eligibility import ny_today
from activities.models import (
    FRANCONIA_CHURCH_NAME,
    Activity,
    ActivityParticipant,
    Church,
    HouseholdDependent,
)
from activities.public_calendar import ICS_PRODID, PUBLIC_EVENT_FIELDS
from irlobby_backend.asgi import application
from users.models import User
from users.stripe_connect import create_direct_checkout_session

NY = ZoneInfo("America/New_York")


def _safe_birthdate(years_ago: int) -> date:
    today = ny_today()
    return date(today.year - years_ago, today.month, min(today.day, 28))


def _jpeg_upload(name="photo.jpg"):
    buffer = BytesIO()
    Image.new("RGB", (32, 24), "red").save(buffer, format="JPEG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/jpeg")


def _activity(host, **overrides):
    payload = dict(
        host=host,
        is_approved=True,
        title="Gathering",
        description="A church gathering.",
        location="Fellowship Hall",
        latitude=40.31,
        longitude=-75.34,
        time=timezone.now() + timedelta(days=7),
        capacity=10,
        tags=[],
        images=[],
    )
    payload.update(overrides)
    return Activity.objects.create(**payload)


class FoyerEligibilityTests(APITestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            username="host",
            email="host@example.com",
            password="password123",
            date_of_birth=_safe_birthdate(40),
            sex="female",
            first_name="Sarah",
        )
        self.woman = User.objects.create_user(
            username="woman",
            email="woman@example.com",
            password="password123",
            date_of_birth=date(2000, 3, 4),
            sex="female",
            first_name="Anna",
        )
        self.man = User.objects.create_user(
            username="man",
            email="man@example.com",
            password="password123",
            date_of_birth=date(2000, 3, 4),
            sex="male",
            first_name="Daniel",
        )

    def _rsvp(self, user, activity, **body):
        self.client.force_authenticate(user)
        return self.client.post(reverse("activity-rsvp", args=[activity.id]), body, format="json")

    def test_gender_and_age_use_the_event_date_in_new_york(self):
        # 2026-03-04 03:30 UTC is still 2026-03-03 in America/New_York (EST, UTC-5).
        before_birthday = _activity(
            self.host,
            audience_gender="women",
            age_min=9,
            age_max=9,
            time=datetime(2026, 3, 4, 3, 30, tzinfo=datetime_timezone.utc),
        )
        on_birthday = _activity(
            self.host,
            audience_gender="women",
            age_min=9,
            age_max=9,
            time=datetime(2026, 3, 4, 15, 0, tzinfo=datetime_timezone.utc),
        )
        child = HouseholdDependent.objects.create(
            parent=self.woman,
            name="Child 1",
            date_of_birth=date(2017, 3, 4),
            sex="female",
        )

        too_young = self._rsvp(
            self.woman, before_birthday, include_self=False, dependent_ids=[child.id]
        )
        self.assertEqual(too_young.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(too_young.data["people"][0]["reason"], "Outside this event's age range")

        sheet = self.client.get(reverse("activity-whos-coming", args=[before_birthday.id]))
        self.assertEqual(sheet.status_code, status.HTTP_200_OK)
        listed = sheet.data["dependents"][0]
        self.assertFalse(listed["eligible"])
        self.assertEqual(listed["reason"], "Outside this event's age range")
        self.assertEqual(listed["age"], 8)
        self.assertNotIn("date_of_birth", listed)

        allowed = self._rsvp(self.woman, on_birthday, include_self=False, dependent_ids=[child.id])
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertEqual(allowed.data["people_count"], 1)

        men_only = _activity(self.host, audience_gender="men", age_min=18)
        rejected = self._rsvp(self.woman, men_only, include_self=True, dependent_ids=[])
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("men", rejected.data["people"][0]["reason"])

        accepted = self._rsvp(self.man, men_only, include_self=True, dependent_ids=[])
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.client.get(reverse("activity-detail", args=[men_only.id])).data["audience"],
            "Men · 18+",
        )


class FoyerAccountAndRsvpTests(APITestCase):
    def test_under_13_signup_is_rejected(self):
        response = self.client.post(
            reverse("user-register"),
            {
                "username": "too-young",
                "email": "child@example.com",
                "password": "password123",
                "password_confirm": "password123",
                "date_of_birth": _safe_birthdate(10).isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("13", str(response.data))
        self.assertFalse(User.objects.filter(email="child@example.com").exists())

    def test_parent_rsvp_for_a_child_counts_people_toward_capacity(self):
        parent = User.objects.create_user(
            username="parent",
            email="parent@example.com",
            password="password123",
            first_name="Sarah",
            date_of_birth=_safe_birthdate(35),
            sex="female",
        )
        other = User.objects.create_user(
            username="other",
            email="other@example.com",
            password="password123",
            date_of_birth=_safe_birthdate(30),
            sex="female",
        )
        host = User.objects.create_user(
            username="cap-host",
            email="cap-host@example.com",
            password="password123",
            date_of_birth=_safe_birthdate(40),
            sex="female",
        )
        child = HouseholdDependent.objects.create(
            parent=parent,
            name="Child 1",
            date_of_birth=_safe_birthdate(9),
            sex="female",
        )
        activity = _activity(host, capacity=2, audience_gender="everyone")

        self.client.force_authenticate(parent)
        response = self.client.post(
            reverse("activity-rsvp", args=[activity.id]),
            {"include_self": True, "dependent_ids": [child.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["people_count"], 2)
        self.assertEqual(response.data["going_count"], 2)
        self.assertEqual(ActivityParticipant.objects.filter(activity=activity).count(), 1)

        self.client.force_authenticate(other)
        blocked = self.client.post(
            reverse("activity-rsvp", args=[activity.id]),
            {"include_self": True, "dependent_ids": []},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(blocked.data["message"], "Activity is full")

    def test_teen_with_an_account_cannot_be_stored_as_a_dependent(self):
        parent = User.objects.create_user(
            username="parent-teen",
            email="parent-teen@example.com",
            password="password123",
            date_of_birth=_safe_birthdate(40),
            sex="female",
        )
        teen_dob = _safe_birthdate(15)
        User.objects.create_user(
            username="teen-account",
            email="teen@example.com",
            password="password123",
            first_name="Jordan",
            last_name="Lee",
            date_of_birth=teen_dob,
            sex="male",
        )
        self.client.force_authenticate(parent)
        response = self.client.post(
            reverse("household"),
            {"name": "Jordan Lee", "date_of_birth": teen_dob.isoformat(), "sex": "male"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("account", response.data["name"])

    def test_parent_must_be_18_to_add_a_child(self):
        minor = User.objects.create_user(
            username="minor-parent",
            email="minor-parent@example.com",
            password="password123",
            date_of_birth=_safe_birthdate(16),
            sex="female",
        )
        self.client.force_authenticate(minor)
        response = self.client.post(
            reverse("household"),
            {
                "name": "Child 1",
                "date_of_birth": _safe_birthdate(4).isoformat(),
                "sex": "female",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("18", response.data["parent"])


@override_settings(STRIPE_PLATFORM_FEE_PERCENT=15, STRIPE_API_KEY="sk_test_123")
class FoyerGivingTests(APITestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            username="giver-host",
            email="giver-host@example.com",
            password="password123",
            first_name="Sarah",
            date_of_birth=_safe_birthdate(40),
            sex="female",
            stripe_connect_account_id="acct_host",
            stripe_connect_payouts_enabled=True,
            stripe_connect_details_submitted=True,
        )
        self.guest = User.objects.create_user(
            username="guest",
            email="guest@example.com",
            password="password123",
            date_of_birth=_safe_birthdate(30),
            sex="female",
        )

    def test_platform_fee_is_forced_to_zero(self):
        self.client.force_authenticate(self.host)
        response = self.client.post(
            reverse("activity-list"),
            {
                "title": "Brunch",
                "description": "Food.",
                "location": "Hall",
                "latitude": 40.3,
                "longitude": -75.3,
                "time": (timezone.now() + timedelta(days=2)).isoformat(),
                "capacity": 500,
                "platform_fee_percent": "10.00",
                "donation_enabled": True,
                "suggested_donation": "10.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        activity = Activity.objects.get(id=response.data["id"])
        self.assertEqual(activity.platform_fee_percent, Decimal("0"))
        self.assertEqual(response.data["platform_fee_percent"], "0.00")
        self.assertEqual(activity.capacity, 500)

        unlimited = self.client.post(
            reverse("activity-list"),
            {
                "title": "Open house",
                "description": "Come by.",
                "location": "Hall",
                "latitude": 40.3,
                "longitude": -75.3,
                "time": (timezone.now() + timedelta(days=3)).isoformat(),
                "capacity": None,
            },
            format="json",
        )
        self.assertEqual(unlimited.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(Activity.objects.get(id=unlimited.data["id"]).capacity)

    @patch("activities.foyer_views.create_direct_checkout_session")
    def test_personal_gift_link_discloses_it_is_not_a_church_gift(self, mock_session):
        mock_session.return_value = {
            "id": "cs_gift",
            "url": "https://checkout.stripe.com/c/pay/cs_gift",
        }
        activity = _activity(self.host, donation_enabled=True, suggested_donation=Decimal("10.00"))
        ActivityParticipant.objects.create(
            activity=activity, user=self.guest, status="confirmed", include_self=True
        )
        self.client.force_authenticate(self.guest)
        response = self.client.post(
            reverse("activity-giving-link", args=[activity.id]),
            {"amount": "10.00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["url"], "https://checkout.stripe.com/c/pay/cs_gift")
        self.assertEqual(response.data["platform_fee_percent"], 0)
        self.assertEqual(response.data["application_fee_amount"], 0)
        self.assertFalse(response.data["tax_deductible"])
        self.assertIn("not a tax-deductible gift", response.data["disclaimer"])
        self.assertIn("Sarah", response.data["disclaimer"])
        self.assertEqual(mock_session.call_args.kwargs["connected_account_id"], "acct_host")
        self.assertEqual(mock_session.call_args.kwargs["unit_amount"], 1000)

    def test_church_gift_uses_the_church_account(self):
        church = Church.objects.create(
            name="Test Church", is_verified=True, stripe_account_id="acct_church"
        )
        activity = _activity(
            self.host,
            host_kind="church",
            host_church=church,
            donation_enabled=True,
            calendar_approved=True,
        )
        ActivityParticipant.objects.create(
            activity=activity, user=self.guest, status="confirmed", include_self=True
        )
        self.client.force_authenticate(self.guest)
        with patch("activities.foyer_views.create_direct_checkout_session") as mock_session:
            mock_session.return_value = {
                "id": "cs_church",
                "url": "https://checkout.stripe.com/c/pay/cs_church",
            }
            response = self.client.post(
                reverse("activity-giving-link", args=[activity.id]),
                {"amount": "20.00"},
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data["tax_deductible"])
        self.assertNotIn("not a tax-deductible", response.data["disclaimer"])
        self.assertIn("Test Church", response.data["disclaimer"])
        self.assertEqual(mock_session.call_args.kwargs["connected_account_id"], "acct_church")

    @override_settings(STRIPE_API_KEY="sk_live_blocked", STRIPE_ALLOW_LIVE_MODE=False)
    def test_giving_keeps_the_live_mode_guard(self):
        activity = _activity(self.host, donation_enabled=True)
        ActivityParticipant.objects.create(
            activity=activity, user=self.guest, status="confirmed", include_self=True
        )
        self.client.force_authenticate(self.guest)
        response = self.client.post(
            reverse("activity-giving-link", args=[activity.id]),
            {"amount": "5.00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("Live Stripe keys", response.data["detail"])


class DirectChargeSessionTests(TestCase):
    @override_settings(STRIPE_API_KEY="sk_test_123")
    @patch("users.stripe_connect.get_stripe_client")
    def test_checkout_is_a_direct_charge_with_zero_application_fee(self, mock_get_client):
        mock_client = Mock()
        mock_client.v1.checkout.sessions.create.return_value = {
            "id": "cs_direct",
            "url": "https://checkout.stripe.com/c/pay/cs_direct",
        }
        mock_get_client.return_value = mock_client

        create_direct_checkout_session(
            connected_account_id="acct_recipient",
            unit_amount=500,
            currency="usd",
            product_name="Gift",
            description="Meal",
            success_url="https://api.irlobby.com/tickets/success",
            cancel_url="https://api.irlobby.com/tickets/cancel",
            metadata={"kind": "gift", "gift_id": "1"},
        )

        params, options = mock_client.v1.checkout.sessions.create.call_args.args
        self.assertEqual(options, {"stripe_account": "acct_recipient"})
        self.assertEqual(params["payment_intent_data"]["application_fee_amount"], 0)
        self.assertNotIn("transfer_data", params["payment_intent_data"])


class FoyerChatAccessTests(APITestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            username="chat-host",
            email="chat-host@example.com",
            password="password123",
            date_of_birth=_safe_birthdate(40),
            sex="female",
        )
        self.guest = User.objects.create_user(
            username="chat-guest",
            email="chat-guest@example.com",
            password="password123",
            date_of_birth=_safe_birthdate(30),
            sex="female",
        )
        self.activity = _activity(self.host)

    def test_chat_is_blocked_before_rsvp_and_allowed_after(self):
        self.client.force_authenticate(self.guest)
        url = reverse("activity-chat", args=[self.activity.id])
        blocked = self.client.get(url)
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)

        rsvp = self.client.post(
            reverse("activity-rsvp", args=[self.activity.id]),
            {"include_self": True, "dependent_ids": []},
            format="json",
        )
        self.assertEqual(rsvp.status_code, status.HTTP_200_OK)
        allowed = self.client.get(url)
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)

    def test_host_can_open_chat_without_an_rsvp(self):
        self.client.force_authenticate(self.host)
        response = self.client.get(reverse("activity-chat", args=[self.activity.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class FoyerChatSocketTests(TransactionTestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            username="socket-host",
            email="socket-host@example.com",
            password="password123",
        )
        self.guest = User.objects.create_user(
            username="socket-guest",
            email="socket-guest@example.com",
            password="password123",
            date_of_birth=_safe_birthdate(28),
            sex="male",
        )
        self.activity = _activity(self.host)

    def _connect(self, user):
        token = str(AccessToken.for_user(user))

        async def run():
            communicator = WebsocketCommunicator(
                application,
                f"/ws/?token={token}&activityId={self.activity.id}",
                headers=[(b"origin", b"http://localhost:5173")],
            )
            connected, _ = await communicator.connect()
            if connected:
                await communicator.disconnect()
            return connected

        return async_to_sync(run)()

    @patch("chat.consumers.set_user_online")
    @patch("chat.consumers.clear_user_online")
    def test_websocket_connect_requires_a_going_rsvp(self, _clear, _online):
        self.assertFalse(self._connect(self.guest))
        ActivityParticipant.objects.create(
            activity=self.activity, user=self.guest, status="confirmed", include_self=True
        )
        self.assertTrue(self._connect(self.guest))
        self.assertTrue(self._connect(self.host))


class FoyerCalendarTests(APITestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            username="cal-host",
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
        self.approved = _activity(
            self.host,
            title="Harvest Supper",
            description="Bring a dish.",
            location="Franconia meetinghouse",
            list_on_church_calendar=True,
            calendar_approved=True,
            audience_gender="everyone",
            age_min=6,
            end_time=timezone.now() + timedelta(days=7, hours=2),
        )
        self.waiting = _activity(
            self.host,
            title="Unapproved Picnic",
            list_on_church_calendar=True,
            calendar_approved=False,
        )
        self.private = _activity(
            self.host,
            title="Backyard Hymns",
            list_on_church_calendar=False,
            calendar_approved=False,
        )

    def test_public_calendar_omits_private_fields_and_unapproved_events(self):
        response = self.client.get(
            reverse("public-calendar"), HTTP_ORIGIN="https://franconiamennonite.org"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Access-Control-Allow-Origin"], "https://franconiamennonite.org")
        titles = [event["title"] for event in response.data["events"]]
        self.assertIn("Harvest Supper", titles)
        self.assertNotIn("Unapproved Picnic", titles)
        self.assertNotIn("Backyard Hymns", titles)
        event = next(item for item in response.data["events"] if item["title"] == "Harvest Supper")
        self.assertEqual(set(event.keys()), set(PUBLIC_EVENT_FIELDS))
        self.assertEqual(event["host_name"], "Sarah Host")
        self.assertEqual(event["audience"], "Everyone · Ages 6+")
        body = str(response.data)
        self.assertNotIn("private-host@example.com", body)
        self.assertNotIn("SecretChild", body)
        self.assertNotIn(self.host.date_of_birth.isoformat(), body)
        self.assertNotIn("base64", body)

        ics = self.client.get(reverse("public-calendar-ics"))
        self.assertEqual(ics.status_code, status.HTTP_200_OK)
        self.assertIn("text/calendar", ics["Content-Type"])
        text = ics.content.decode()
        self.assertIn(f"PRODID:{ICS_PRODID}", text)
        self.assertIn("Harvest Supper", text)
        self.assertNotIn("Unapproved Picnic", text)
        self.assertNotIn("private-host@example.com", text)
        self.assertNotIn("SecretChild", text)


class FoyerChurchAndPhotoTests(APITestCase):
    def setUp(self):
        self.member = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="password123",
            date_of_birth=_safe_birthdate(33),
            sex="male",
        )
        self.admin = User.objects.create_user(
            username="aaron",
            email="ajesbenshade@gmail.com",
            password="password123",
            date_of_birth=_safe_birthdate(40),
            sex="male",
        )

    def test_seeded_churches_and_unverified_create(self):
        self.assertTrue(
            Church.objects.filter(name=FRANCONIA_CHURCH_NAME, is_verified=True).exists()
        )
        self.assertEqual(Church.objects.filter(is_verified=True).count(), 8)
        self.client.force_authenticate(self.member)
        found = self.client.get(reverse("church-list"), {"q": "blooming"})
        self.assertEqual(found.status_code, status.HTTP_200_OK)
        self.assertEqual(found.data[0]["name"], "Blooming Glen Mennonite Church")
        self.assertNotIn("stripe_account_id", found.data[0])

        created = self.client.post(reverse("church-list"), {"name": "Typed Chapel"}, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertFalse(created.data["is_verified"])
        again = self.client.post(reverse("church-list"), {"name": "typed chapel"}, format="json")
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(again.data["id"], created.data["id"])

    def test_admin_church_events_are_calendar_approved_and_members_need_approval(self):
        self.client.force_authenticate(self.member)
        member_event = self.client.post(
            reverse("activity-list"),
            {
                "title": "Member potluck",
                "description": "Salads.",
                "location": "Hall",
                "latitude": 40.3,
                "longitude": -75.3,
                "time": (timezone.now() + timedelta(days=4)).isoformat(),
                "list_on_church_calendar": True,
                "host_kind": "church",
            },
            format="json",
        )
        self.assertEqual(member_event.status_code, status.HTTP_400_BAD_REQUEST)

        listed = self.client.post(
            reverse("activity-list"),
            {
                "title": "Member potluck",
                "description": "Salads.",
                "location": "Hall",
                "latitude": 40.3,
                "longitude": -75.3,
                "time": (timezone.now() + timedelta(days=4)).isoformat(),
                "list_on_church_calendar": True,
            },
            format="json",
        )
        self.assertEqual(listed.status_code, status.HTTP_201_CREATED)
        self.assertFalse(listed.data["calendar_approved"])

        self.client.force_authenticate(self.admin)
        denied = self.client.post(reverse("activity-calendar-approve", args=[listed.data["id"]]))
        self.assertEqual(denied.status_code, status.HTTP_200_OK)
        titles = [
            event["title"] for event in self.client.get(reverse("public-calendar")).data["events"]
        ]
        self.assertIn("Member potluck", titles)

        church_event = self.client.post(
            reverse("activity-list"),
            {
                "title": "Church supper",
                "description": "The church is hosting.",
                "location": "Meetinghouse",
                "latitude": 40.3,
                "longitude": -75.3,
                "time": (timezone.now() + timedelta(days=5)).isoformat(),
                "host_kind": "church",
                "list_on_church_calendar": True,
                "donation_enabled": True,
            },
            format="json",
        )
        self.assertEqual(church_event.status_code, status.HTTP_201_CREATED)
        self.assertTrue(church_event.data["calendar_approved"])
        self.assertEqual(church_event.data["host_kind"], "church")
        self.assertEqual(church_event.data["host_name"], FRANCONIA_CHURCH_NAME)

    def test_event_photo_is_served_as_a_url(self):
        activity = _activity(self.member)
        self.client.force_authenticate(self.member)
        response = self.client.post(
            reverse("activity-photo-upload", args=[activity.id]),
            {"image": _jpeg_upload()},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["url"].startswith("http"))
        self.assertNotIn("base64", response.data["url"])
        self.assertNotIn("data:", response.content.decode())
        from urllib.parse import urlparse

        fetched = self.client.get(urlparse(response.data["url"]).path)
        self.assertEqual(fetched.status_code, status.HTTP_200_OK)
        self.assertEqual(fetched["Content-Type"], "image/jpeg")
        body = b"".join(fetched.streaming_content)
        self.assertTrue(body.startswith(b"\xff\xd8"))
