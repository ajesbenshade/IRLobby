from datetime import date, datetime, timedelta, timezone as datetime_timezone
from decimal import Decimal
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.foyer import age_on, event_local_date, person_is_eligible
from activities.models import Activity, Church, Donation, HouseholdDependent, Ticket
from activities.public_calendar import ICS_PRODID
from django.conf import settings
from users.models import User

NEW_YORK = ZoneInfo("America/New_York")


def _activity_payload(**overrides):
    payload = {
        "title": "Potluck",
        "description": "Bring a dish.",
        "location": "Fellowship Hall",
        "latitude": 40.31,
        "longitude": -75.34,
        "time": (timezone.now() + timedelta(days=10)).isoformat(),
        "capacity": 40,
        "audience_gender": "everyone",
        "tags": [],
        "images": [],
    }
    payload.update(overrides)
    return payload


@override_settings(FOYER_MODE=True, STRIPE_API_KEY="sk_test_123")
class FoyerTests(APITestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            username="host",
            email="host@example.com",
            password="password123",
            first_name="Helen",
            last_name="Host",
            birth_date=date(1985, 4, 2),
            sex="female",
        )
        self.member = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="password123",
            first_name="Mia",
            last_name="Member",
            birth_date=date(1992, 6, 1),
            sex="female",
        )
        self.admin = User.objects.create_user(
            username="aaron",
            email="ajesbenshade@gmail.com",
            password="password123",
            first_name="Aaron",
            last_name="Admin",
            birth_date=date(1980, 1, 15),
            sex="male",
        )

    def _create(self, user, **overrides):
        self.client.force_authenticate(user)
        return self.client.post(reverse("activity-list"), _activity_payload(**overrides), format="json")

    def test_gender_and_event_date_age_eligibility(self):
        # 04:30 UTC on Jan 1 is still Dec 31 in America/New_York.
        event_time = datetime(2026, 1, 1, 4, 30, tzinfo=datetime_timezone.utc)
        activity = Activity.objects.create(
            host=self.host,
            is_approved=True,
            title="New Year breakfast",
            description="Men 18 and older",
            location="Fellowship Hall",
            latitude=40.3,
            longitude=-75.3,
            time=event_time,
            capacity=20,
            audience_gender="men",
            age_min=18,
            tags=[],
            images=[],
        )
        self.assertEqual(event_local_date(activity), date(2025, 12, 31))
        birthday = date(2008, 1, 1)
        self.assertEqual(age_on(birthday, date(2025, 12, 31)), 17)
        self.assertEqual(age_on(birthday, date(2026, 1, 1)), 18)
        self.assertFalse(person_is_eligible(birthday, "male", activity))

        self.member.sex = "male"
        self.member.birth_date = birthday
        self.member.save(update_fields=["sex", "birth_date"])
        self.client.force_authenticate(self.member)
        rejected = self.client.post(
            reverse("activity-rsvp", args=[activity.id]),
            {"include_self": True, "dependent_ids": []},
            format="json",
        )
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)

        woman = self._create(self.host, audience_gender="women", title="Sister circle")
        self.assertEqual(woman.status_code, status.HTTP_201_CREATED)
        self.member.sex = "male"
        self.member.birth_date = date(1992, 6, 1)
        self.member.save(update_fields=["sex", "birth_date"])
        self.client.force_authenticate(self.member)
        gendered = self.client.post(
            reverse("activity-rsvp", args=[woman.data["id"]]),
            {"include_self": True},
            format="json",
        )
        self.assertEqual(gendered.status_code, status.HTTP_400_BAD_REQUEST)

    def test_under_13_cannot_register(self):
        too_young = (timezone.now().astimezone(NEW_YORK).date() - timedelta(days=365 * 12)).isoformat()
        response = self.client.post(
            reverse("user-register"),
            {
                "username": "child-account",
                "email": "child-account@example.com",
                "password": "password123",
                "password_confirm": "password123",
                "birth_date": too_young,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="child-account@example.com").exists())

    def test_parent_rsvp_counts_child_toward_capacity(self):
        self.member.birth_date = date(1988, 3, 3)
        self.member.sex = "male"
        self.member.save(update_fields=["birth_date", "sex"])
        child = HouseholdDependent.objects.create(
            guardian=self.member,
            first_name="Ada",
            last_name="Member",
            birth_date=date(2016, 5, 5),
            sex="female",
        )
        created = self._create(
            self.host,
            audience_gender="women",
            age_max=12,
            capacity=1,
            title="Kids craft",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.client.force_authenticate(self.member)
        response = self.client.post(
            reverse("activity-rsvp", args=[created.data["id"]]),
            {"include_self": False, "dependent_ids": [child.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["headcount"], 1)
        self.assertFalse(response.data["include_self"])

        other = User.objects.create_user(
            username="other-parent",
            email="other-parent@example.com",
            password="password123",
            birth_date=date(1984, 1, 1),
            sex="female",
        )
        other_child = HouseholdDependent.objects.create(
            guardian=other,
            first_name="Bea",
            last_name="Other",
            birth_date=date(2017, 1, 1),
            sex="female",
        )
        self.client.force_authenticate(other)
        full = self.client.post(
            reverse("activity-rsvp", args=[created.data["id"]]),
            {"include_self": False, "dependent_ids": [other_child.id]},
            format="json",
        )
        self.assertEqual(full.status_code, status.HTTP_400_BAD_REQUEST)

    def test_platform_fee_is_zero_and_gift_has_no_ticket(self):
        self.host.stripe_connect_account_id = "acct_person"
        self.host.stripe_connect_payouts_enabled = True
        self.host.save(update_fields=["stripe_connect_account_id", "stripe_connect_payouts_enabled"])
        created = self._create(self.host, donation_enabled=True, suggested_donation="15.00")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        activity = Activity.objects.get(id=created.data["id"])
        self.assertEqual(activity.platform_fee_percent, Decimal("0"))
        self.assertFalse(activity.is_ticketed)

        church, _created = Church.objects.get_or_create(
            name="Franconia Mennonite Church",
            defaults={"is_verified": True},
        )
        church.stripe_connect_account_id = "acct_church"
        church.stripe_connect_payouts_enabled = True
        church.is_verified = True
        church.save()
        church_event = self._create(
            self.admin,
            host_kind="church",
            donation_enabled=True,
            suggested_donation="20.00",
            title="Church supper",
        )
        self.assertEqual(church_event.status_code, status.HTTP_201_CREATED)
        self.assertEqual(church_event.data["host_kind"], "church")
        self.assertEqual(Activity.objects.get(id=church_event.data["id"]).church_id, church.id)

        self.client.force_authenticate(self.member)
        with patch("users.stripe_connect.create_foyer_gift_checkout_session") as mocked:
            mocked.return_value = {"id": "cs_gift", "url": "https://checkout.stripe.com/c/pay/cs_gift"}
            gift = self.client.post(
                reverse("activity-give", args=[church_event.data["id"]]),
                {"amount": "20.00"},
                format="json",
            )
        self.assertEqual(gift.status_code, status.HTTP_201_CREATED)
        self.assertEqual(gift.data["application_fee_amount"], 0)
        self.assertIn("Franconia Mennonite Church", gift.data["gift_notice"])
        self.assertEqual(mocked.call_args.kwargs["destination_account_id"], "acct_church")
        self.assertEqual(Ticket.objects.count(), 0)
        self.assertEqual(Donation.objects.count(), 1)

    def test_chat_forbidden_until_going(self):
        created = self._create(self.host, title="Porch conversation")
        activity_id = created.data["id"]
        self.client.force_authenticate(self.member)
        blocked = self.client.get(reverse("activity-chat", args=[activity_id]))
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)

        rsvp = self.client.post(
            reverse("activity-rsvp", args=[activity_id]),
            {"include_self": True, "dependent_ids": []},
            format="json",
        )
        self.assertEqual(rsvp.status_code, status.HTTP_201_CREATED)
        opened = self.client.get(reverse("activity-chat", args=[activity_id]))
        self.assertEqual(opened.status_code, status.HTTP_200_OK)

    def test_public_calendar_omits_private_fields(self):
        secret_child = "SecretChildNameZed"
        HouseholdDependent.objects.create(
            guardian=self.member,
            first_name=secret_child,
            last_name="Member",
            birth_date=date(2015, 2, 2),
            sex="male",
        )
        hidden = self._create(
            self.member,
            list_on_church_calendar=True,
            title="Home Bible study",
            description="Members only until approved.",
        )
        self.assertEqual(hidden.status_code, status.HTTP_201_CREATED)
        self.assertFalse(hidden.data["calendar_approved"])
        self.assertIn("church website", hidden.data["public_location_warning"])

        self.client.force_authenticate(None)
        before = self.client.get(reverse("public-calendar"))
        self.assertEqual(before.status_code, status.HTTP_200_OK)
        self.assertEqual(before.data, [])

        self.client.force_authenticate(self.admin)
        approved = self.client.post(reverse("activity-calendar-approve", args=[hidden.data["id"]]))
        self.assertEqual(approved.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(None)
        calendar = self.client.get(reverse("public-calendar"))
        self.assertEqual(calendar.status_code, status.HTTP_200_OK)
        self.assertEqual(len(calendar.data), 1)
        event = calendar.data[0]
        self.assertEqual(
            set(event),
            {
                "title",
                "start",
                "end",
                "location",
                "host_name",
                "audience",
                "description",
                "cover_photo_url",
            },
        )
        raw = str(calendar.data)
        self.assertNotIn(self.member.email, raw)
        self.assertNotIn(self.member.birth_date.isoformat(), raw)
        self.assertNotIn(secret_child, raw)

        ics = self.client.get(reverse("public-calendar-ics"))
        self.assertEqual(ics.status_code, status.HTTP_200_OK)
        body = ics.content.decode()
        self.assertIn(ICS_PRODID, body)
        self.assertNotIn(self.member.email, body)
        self.assertNotIn(secret_child, body)
        self.assertNotIn(self.member.birth_date.isoformat(), body)

    def test_church_site_origin_is_allowed(self):
        self.assertIn("https://franconiamennonite.org", settings.CORS_ALLOWED_ORIGINS)

    def test_teen_with_an_account_cannot_be_a_dependent(self):
        teen_birthday = date(2012, 4, 4)
        User.objects.create_user(
            username="ada-account",
            email="ada-account@example.com",
            password="password123",
            first_name="Ada",
            last_name="Member",
            birth_date=teen_birthday,
            sex="female",
        )
        self.member.birth_date = date(1980, 1, 1)
        self.member.save(update_fields=["birth_date"])
        self.client.force_authenticate(self.member)
        response = self.client.post(
            reverse("household-dependents"),
            {
                "first_name": "Ada",
                "last_name": "Member",
                "birth_date": teen_birthday.isoformat(),
                "sex": "female",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(HouseholdDependent.objects.filter(first_name="Ada").exists())

    def test_parent_can_remove_a_household_child(self):
        self.member.birth_date = date(1988, 3, 3)
        self.member.save(update_fields=["birth_date"])
        self.client.force_authenticate(self.member)
        created = self.client.post(
            reverse("household-dependents"),
            {
                "first_name": "Sam",
                "last_name": "Member",
                "birth_date": "2016-05-05",
                "sex": "male",
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        removed = self.client.delete(reverse("household-dependent-detail", args=[created.data["id"]]))
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(HouseholdDependent.objects.filter(pk=created.data["id"]).exists())


@override_settings(FOYER_MODE=True, GOOGLE_OAUTH_CLIENT_IDS=["google-client-id"])
class SocialSignupGateTests(APITestCase):
    def setUp(self):
        self.google_url = reverse("google_mobile_login")

    def _google(self, *, sub, email, birth_date=None):
        payload = {"id_token": "aaa.bbb.ccc"}
        if birth_date:
            payload["birth_date"] = birth_date
        with patch("users.oauth_views.verify_google_identity_token") as verify:
            verify.return_value = {
                "sub": sub,
                "email": email,
                "email_verified": True,
                "given_name": "New",
                "family_name": "Person",
            }
            return self.client.post(self.google_url, payload, format="json")

    def test_google_signup_without_birth_date_creates_no_account(self):
        response = self._google(sub="google-new", email="new-person@example.com")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(response.data["birth_date_required"])
        self.assertFalse(User.objects.filter(email="new-person@example.com").exists())

    def test_google_signup_under_13_creates_no_account(self):
        response = self._google(
            sub="google-child",
            email="child-person@example.com",
            birth_date="2020-01-01",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("under 13", response.data["error"])
        self.assertFalse(User.objects.filter(email="child-person@example.com").exists())

    def test_google_signup_with_adult_birth_date_can_use_the_foyer(self):
        response = self._google(
            sub="google-adult",
            email="adult-person@example.com",
            birth_date="1991-04-04",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user = User.objects.get(email="adult-person@example.com")
        self.assertEqual(user.birth_date, date(1991, 4, 4))
        self.assertIn("access", response.data["tokens"])

    def test_existing_social_account_without_birth_date_gets_no_session(self):
        user = User.objects.create_user(
            username="shell",
            email="shell@example.com",
            password="password123",
        )
        response = self._google(sub="google-shell", email="shell@example.com")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(response.data["birth_date_required"])
        self.assertNotIn("tokens", response.data)
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertIsNone(user.birth_date)

        under = self._google(sub="google-shell", email="shell@example.com", birth_date="2018-06-01")
        self.assertEqual(under.status_code, status.HTTP_400_BAD_REQUEST)
        user.refresh_from_db()
        self.assertFalse(user.is_active)
        self.assertIsNone(user.birth_date)

    @override_settings(
        TWITTER_CLIENT_ID="twitter-client-id",
        TWITTER_CLIENT_SECRET="twitter-client-secret",
    )
    @patch("users.oauth_views.requests.get")
    @patch("users.oauth_views.exchange_twitter_token")
    def test_twitter_signup_waits_for_birth_date_and_rejects_under_13(
        self, mock_exchange, mock_get
    ):
        cache.set(
            "twitter_oauth_pending-state",
            {
                "code_verifier": "test-verifier",
                "redirect_uri": "http://testserver/api/auth/twitter/callback/",
                "mobile_redirect_uri": None,
            },
            timeout=600,
        )
        mock_exchange.return_value = type(
            "Response",
            (),
            {
                "status_code": 200,
                "json": lambda self: {"access_token": "twitter-access-token"},
                "text": "{}",
                "headers": {},
            },
        )()
        mock_get.return_value = type(
            "Response",
            (),
            {
                "status_code": 200,
                "json": lambda self: {
                    "data": {"id": "twitter-pending", "username": "pending", "name": "Pending Person"}
                },
            },
        )()

        pending = self.client.get(
            reverse("twitter_oauth_callback"),
            {"code": "oauth-code", "state": "pending-state"},
        )
        self.assertEqual(pending.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(pending.data["birth_date_required"])
        signup_token = pending.data["signup_token"]
        self.assertFalse(User.objects.filter(oauth_id="twitter-pending").exists())

        too_young = self.client.post(
            reverse("social-signup-complete"),
            {"signup_token": signup_token, "birth_date": "2019-02-02"},
            format="json",
        )
        self.assertEqual(too_young.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(oauth_id="twitter-pending").exists())

        adult = self.client.post(
            reverse("social-signup-complete"),
            {"signup_token": signup_token, "birth_date": "1989-02-02"},
            format="json",
        )
        self.assertEqual(adult.status_code, status.HTTP_200_OK)
        created = User.objects.get(oauth_id="twitter-pending")
        self.assertEqual(created.birth_date, date(1989, 2, 2))
        self.assertTrue(created.is_active)
