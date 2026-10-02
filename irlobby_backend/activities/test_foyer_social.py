"""Family members, host/attendee lists, photo downloads, hidden addresses, RSVP cancel."""

from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.signing import TimestampSigner
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from activities.eligibility import ny_today
from activities.models import ActivityParticipant, EventPhoto, HouseholdDependent
from activities.photos import PHOTO_DOWNLOAD_SALT
from activities.public_calendar import event_ics, event_ics_token
from moderation.models import BlockedUser
from swipes.models import Swipe
from users.models import Friendship, User

from .test_foyer import _activity, _safe_birthdate


def _user(name, age=40, **extra):
    return User.objects.create_user(
        username=name,
        email=f"{name}@example.com",
        password="Passw0rd-123",
        first_name=name.capitalize(),
        last_name="Smith",
        date_of_birth=_safe_birthdate(age),
        sex=extra.pop("sex", "female"),
        **extra,
    )


def _past(**kw):
    return dict(time=timezone.now() - timedelta(hours=2), **kw)


class FamilyMemberTests(APITestCase):
    def setUp(self):
        self.parent = _user("parent")
        self.client.force_authenticate(self.parent)

    def test_add_spouse_has_no_age_or_birth_data(self):
        resp = self.client.post(
            reverse("household"),
            {
                "name": "Pat",
                "relationship": "spouse",
                "sex": "male",
                "birth_year": 1980,
                "birth_month": 3,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        spouse = [m for m in resp.data["members"] if m["relationship"] == "spouse"][0]
        self.assertEqual(
            set(spouse), {"id", "name", "relationship", "sex", "birth_month", "birth_year", "age"}
        )
        self.assertIsNone(spouse["age"])
        self.assertIsNone(spouse["birth_month"])
        self.assertIsNone(HouseholdDependent.objects.get(pk=spouse["id"]).birth_year)

    def test_only_one_spouse(self):
        self.client.post(
            reverse("household"), {"name": "A", "relationship": "spouse"}, format="json"
        )
        resp = self.client.post(
            reverse("household"), {"name": "B", "relationship": "spouse"}, format="json"
        )
        self.assertEqual(resp.status_code, 400)

    def test_relationship_must_be_spouse_or_child(self):
        resp = self.client.post(
            reverse("household"), {"name": "Bo", "relationship": "cousin"}, format="json"
        )
        self.assertEqual(resp.status_code, 400)

    def test_child_with_month_year_only(self):
        year = ny_today().year - 6
        resp = self.client.post(
            reverse("household"),
            {"name": "Kid", "birth_month": 5, "birth_year": year, "sex": "male"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        member = [m for m in resp.data["members"] if m["name"] == "Kid"][0]
        self.assertEqual((member["birth_month"], member["birth_year"]), (5, year))
        self.assertIn(member["age"], (5, 6))
        self.assertNotIn("date_of_birth", member)
        # legacy fields stay on the top-level response for builds 88/89
        self.assertIn("date_of_birth", resp.data)
        self.assertEqual(resp.data["relationship"], "child")

    def test_child_requires_birth_data_and_must_be_under_18(self):
        resp = self.client.post(reverse("household"), {"name": "Kid"}, format="json")
        self.assertEqual(resp.status_code, 400)
        resp = self.client.post(
            reverse("household"),
            {"name": "Big", "birth_month": 1, "birth_year": ny_today().year - 30},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        resp = self.client.post(
            reverse("household"),
            {"name": "Bad", "birth_month": 13, "birth_year": 2020},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_legacy_date_of_birth_post_still_works(self):
        dob = _safe_birthdate(8).isoformat()
        resp = self.client.post(
            reverse("household"), {"name": "Old", "date_of_birth": dob}, format="json"
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["date_of_birth"], dob)
        listing = self.client.get(reverse("household"))
        self.assertEqual(len(listing.data["children"]), 1)
        self.assertEqual(len(listing.data["members"]), 1)

    def test_delete_member(self):
        resp = self.client.post(
            reverse("household"), {"name": "A", "relationship": "spouse"}, format="json"
        )
        mid = resp.data["id"]
        self.assertEqual(
            self.client.delete(reverse("household-delete", args=[mid])).status_code, 204
        )
        self.assertEqual(
            self.client.delete(reverse("household-delete", args=[mid])).status_code, 404
        )

    def test_rsvp_with_member_ids_and_spouse_eligible_for_adult_range(self):
        spouse = HouseholdDependent.objects.create(
            parent=self.parent, name="Pat", relationship="spouse"
        )
        activity = _activity(_user("host"), age_min=25, age_max=60, capacity=5)
        resp = self.client.post(
            reverse("activity-rsvp", args=[activity.id]),
            {"include_self": True, "member_ids": [spouse.id]},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["people_count"], 2)
        self.assertEqual(resp.data["dependent_ids"], [spouse.id])
        self.assertEqual(resp.data["member_ids"], [spouse.id])
        mine = self.client.get(reverse("activity-detail", args=[activity.id])).data["my_rsvp"]
        self.assertEqual(mine["member_ids"], [spouse.id])

    def test_spouse_blocked_from_under_18_event_and_sex_rules_apply(self):
        spouse = HouseholdDependent.objects.create(
            parent=self.parent, name="Pat", relationship="spouse", sex="male"
        )
        teens = _activity(_user("host"), age_max=17)
        resp = self.client.post(
            reverse("activity-rsvp", args=[teens.id]),
            {"include_self": False, "member_ids": [spouse.id]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        women = _activity(_user("host2"), audience_gender="women")
        resp = self.client.post(
            reverse("activity-rsvp", args=[women.id]),
            {"include_self": False, "dependent_ids": [spouse.id]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_cannot_rsvp_for_someone_elses_member(self):
        other = HouseholdDependent.objects.create(
            parent=_user("other"), name="X", relationship="spouse"
        )
        activity = _activity(_user("host"))
        resp = self.client.post(
            reverse("activity-rsvp", args=[activity.id]), {"member_ids": [other.id]}, format="json"
        )
        self.assertEqual(resp.status_code, 400)

    def test_whos_coming_has_dependents_and_members(self):
        HouseholdDependent.objects.create(parent=self.parent, name="Pat", relationship="spouse")
        activity = _activity(_user("host"))
        data = self.client.get(reverse("activity-whos-coming", args=[activity.id])).data
        self.assertEqual(data["dependents"], data["members"])
        self.assertEqual(data["members"][0]["relationship"], "spouse")
        self.assertIsNone(data["members"][0]["age"])
        self.assertTrue(data["members"][0]["eligible"])

    def test_months_only_child_blocks_matching_teen_signup(self):
        from activities.household_rules import dependent_blocks_minor_account

        teen = _safe_birthdate(15)
        HouseholdDependent.objects.create(
            parent=self.parent, name="Teen Tom", birth_month=teen.month, birth_year=teen.year
        )
        self.assertTrue(
            dependent_blocks_minor_account(first_name="Teen", last_name="Tom", date_of_birth=teen)
        )


class HostAttendeesTests(APITestCase):
    def setUp(self):
        self.host = _user("host")
        self.guest = _user("guest")
        self.activity = _activity(self.host, capacity=20)
        spouse = HouseholdDependent.objects.create(
            parent=self.guest, name="Pat", relationship="spouse"
        )
        kid = HouseholdDependent.objects.create(
            parent=self.guest, name="Kid", birth_month=1, birth_year=ny_today().year - 5
        )
        teen = HouseholdDependent.objects.create(
            parent=self.guest, name="Teen", birth_month=1, birth_year=ny_today().year - 15
        )
        part = ActivityParticipant.objects.create(
            activity=self.activity, user=self.guest, status="confirmed", include_self=True
        )
        part.dependents.set([spouse, kid, teen])

    def test_host_sees_households_without_private_data(self):
        self.client.force_authenticate(self.host)
        resp = self.client.get(reverse("activity-attendees", args=[self.activity.id]))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["going_count"], 4)
        household = resp.data["households"][0]
        self.assertEqual(household["name"], "Guest Smith")
        people = {p["name"]: p for p in household["people"]}
        self.assertEqual(
            people["Guest Smith"],
            {"name": "Guest Smith", "relationship": "self", "age_band": "adult"},
        )
        self.assertEqual(people["Pat"]["relationship"], "spouse")
        self.assertEqual(people["Pat"]["age_band"], "adult")
        self.assertEqual(people["Kid"]["age_band"], "under 13")
        self.assertEqual(people["Teen"]["age_band"], "13-17")
        body = str(resp.data).lower()
        for leak in (
            "guest@example.com",
            "birth",
            "username",
            "latitude",
            "location",
            "'id'",
            "phone",
        ):
            self.assertNotIn(leak, body)

    def test_staff_can_see(self):
        staff = _user("staff", is_staff=True)
        self.client.force_authenticate(staff)
        self.assertEqual(
            self.client.get(reverse("activity-attendees", args=[self.activity.id])).status_code, 200
        )

    def test_non_host_forbidden_before_event(self):
        for user in (self.guest, _user("stranger")):
            self.client.force_authenticate(user)
            resp = self.client.get(reverse("activity-attendees", args=[self.activity.id]))
            self.assertEqual(resp.status_code, 403)

    def test_requires_auth_and_404(self):
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.get(reverse("activity-attendees", args=[self.activity.id])).status_code, 401
        )
        self.client.force_authenticate(self.host)
        self.assertEqual(
            self.client.get(reverse("activity-attendees", args=[99999])).status_code, 404
        )


class PastAttendeesTests(APITestCase):
    def setUp(self):
        self.host = _user("host")
        self.activity = _activity(self.host, **_past())
        self.me = _user("me")
        self.adult = _user("adult")
        self.teen = _user("teen", age=15)
        self.blocked = _user("blocked")
        self.hidden_by = _user("hiddenby")
        self.outsider = _user("outsider")
        for u in (self.me, self.adult, self.teen, self.blocked, self.hidden_by):
            ActivityParticipant.objects.create(
                activity=self.activity, user=u, status="confirmed", include_self=True
            )
        # a family member of someone going is never listed
        kid = HouseholdDependent.objects.create(
            parent=self.adult, name="SecretKid", birth_month=2, birth_year=ny_today().year - 4
        )
        ActivityParticipant.objects.get(user=self.adult).dependents.set([kid])
        BlockedUser.objects.create(blocker=self.me, blocked=self.blocked)
        BlockedUser.objects.create(blocker=self.hidden_by, blocked=self.me)
        self.client.force_authenticate(self.me)
        self.url = reverse("activity-attendees", args=[self.activity.id])

    def test_names_only_with_blocks_and_minor_privacy(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("households", resp.data)
        by_name = {a["name"]: a for a in resp.data["attendees"]}
        self.assertEqual(set(by_name), {"Adult S.", "Teen S."})
        self.assertEqual(by_name["Adult S."]["user_id"], self.adult.id)
        self.assertIsNone(by_name["Teen S."]["user_id"])
        self.assertEqual(set(by_name["Adult S."]), {"user_id", "name"})
        self.assertNotIn("SecretKid", str(resp.data))
        self.assertNotIn("example.com", str(resp.data))

    def test_friend_minor_has_user_id(self):
        Friendship.objects.create(requester=self.me, recipient=self.teen, status="accepted")
        by_name = {a["name"]: a for a in self.client.get(self.url).data["attendees"]}
        self.assertEqual(by_name["Teen S."]["user_id"], self.teen.id)

    def test_outsider_and_pending_rsvp_forbidden(self):
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        ActivityParticipant.objects.create(
            activity=self.activity, user=self.outsider, status="pending"
        )
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_before_event_start_attendee_forbidden(self):
        future = _activity(self.host)
        ActivityParticipant.objects.create(activity=future, user=self.me, status="confirmed")
        resp = self.client.get(reverse("activity-attendees", args=[future.id]))
        self.assertEqual(resp.status_code, 403)


class CancelRsvpTests(APITestCase):
    def setUp(self):
        self.host = _user("host")
        self.user = _user("user")
        self.other = _user("other")
        self.activity = _activity(self.host, capacity=2)
        self.client.force_authenticate(self.user)

    def _rsvp(self, user, **extra):
        self.client.force_authenticate(user)
        return self.client.post(
            reverse("activity-rsvp", args=[self.activity.id]), extra or {}, format="json"
        )

    def test_cancel_frees_capacity_deletes_swipe_and_drops_from_lists(self):
        Swipe.objects.create(user=self.user, activity=self.activity, direction="right")
        self.assertEqual(self._rsvp(self.user).status_code, 200)
        self.assertEqual(self._rsvp(self.other).status_code, 200)
        full = self._rsvp(_user("third"))
        self.assertEqual(full.status_code, 400)

        self.client.force_authenticate(self.user)
        resp = self.client.delete(reverse("activity-rsvp-cancel", args=[self.activity.id]))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["going_count"], 1)
        self.assertFalse(Swipe.objects.filter(user=self.user, activity=self.activity).exists())

        self.assertEqual(self._rsvp(_user("fourth")).status_code, 200)  # capacity freed
        self.client.force_authenticate(self.host)
        names = [
            p["name"]
            for h in self.client.get(reverse("activity-attendees", args=[self.activity.id])).data[
                "households"
            ]
            for p in h["people"]
        ]
        self.assertNotIn("User Smith", names)
        self.assertEqual(len(names), 2)

    def test_cancel_without_rsvp_is_400(self):
        resp = self.client.delete(reverse("activity-rsvp-cancel", args=[self.activity.id]))
        self.assertEqual(resp.status_code, 400)

    def test_host_cannot_cancel(self):
        self.client.force_authenticate(self.host)
        ActivityParticipant.objects.create(
            activity=self.activity, user=self.host, status="confirmed"
        )
        resp = self.client.delete(reverse("activity-rsvp-cancel", args=[self.activity.id]))
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(ActivityParticipant.objects.filter(user=self.host).exists())

    def test_cancel_after_start_is_400(self):
        started = _activity(self.host, **_past())
        ActivityParticipant.objects.create(activity=started, user=self.user, status="confirmed")
        resp = self.client.delete(reverse("activity-rsvp-cancel", args=[started.id]))
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(
            ActivityParticipant.objects.filter(activity=started, user=self.user).exists()
        )


class SwipeClearTests(APITestCase):
    def setUp(self):
        self.user = _user("user")
        self.activity = _activity(_user("host"))
        self.url = reverse("swipe-activity", args=[self.activity.id])

    def test_requires_auth(self):
        self.assertEqual(self.client.delete(self.url).status_code, 401)

    def test_clear_pass_is_idempotent_and_card_returns(self):
        self.client.force_authenticate(self.user)
        self.client.post(self.url, {"direction": "left"}, format="json")
        self.assertEqual(
            self.client.post(self.url, {"direction": "left"}, format="json").status_code, 400
        )
        first = self.client.delete(self.url)
        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.data["deleted"])
        second = self.client.delete(self.url)
        self.assertEqual(second.status_code, 200)
        self.assertFalse(second.data["deleted"])
        self.assertEqual(
            self.client.post(self.url, {"direction": "right"}, format="json").status_code, 201
        )

    def test_only_clears_own_swipe_and_404_for_missing_activity(self):
        other = _user("other")
        Swipe.objects.create(user=other, activity=self.activity, direction="left")
        self.client.force_authenticate(self.user)
        self.client.delete(self.url)
        self.assertTrue(Swipe.objects.filter(user=other).exists())
        self.assertEqual(
            self.client.delete(reverse("swipe-activity", args=[99999])).status_code, 404
        )


def _jpeg():
    buf = BytesIO()
    Image.new("RGB", (16, 16), "blue").save(buf, format="JPEG")
    return SimpleUploadedFile("p.jpg", buf.getvalue(), content_type="image/jpeg")


class PhotoDownloadTests(APITestCase):
    def setUp(self):
        self.host = _user("host")
        self.guest = _user("guest")
        self.stranger = _user("stranger")

    def _event(self, **kw):
        activity = _activity(self.host, **kw)
        photo = EventPhoto(activity=activity)
        photo.image.save("a.jpg", _jpeg(), save=True)
        return activity, photo

    def test_requires_auth(self):
        activity, _ = self._event(**_past())
        self.assertEqual(
            self.client.get(reverse("activity-photo-downloads", args=[activity.id])).status_code,
            401,
        )

    def test_attendee_after_start_gets_signed_attachment(self):
        activity, photo = self._event(**_past())
        ActivityParticipant.objects.create(activity=activity, user=self.guest, status="confirmed")
        self.client.force_authenticate(self.guest)
        resp = self.client.get(reverse("activity-photo-downloads", args=[activity.id]))
        self.assertEqual(resp.status_code, 200)
        item = resp.data["photos"][0]
        self.assertEqual(set(item), {"id", "filename", "url", "expires_at"})
        self.assertEqual(item["id"], photo.id)
        self.client.force_authenticate(None)  # link works without a header
        file_resp = self.client.get(item["url"])
        self.assertEqual(file_resp.status_code, 200)
        self.assertIn("attachment", file_resp["Content-Disposition"])
        self.assertTrue(file_resp["Cache-Control"].startswith("private"))

    def test_forbidden_cases(self):
        activity, _ = self._event(**_past())
        self.client.force_authenticate(self.stranger)
        self.assertEqual(
            self.client.get(reverse("activity-photo-downloads", args=[activity.id])).status_code,
            403,
        )
        pending = _user("pending")
        ActivityParticipant.objects.create(activity=activity, user=pending, status="pending")
        self.client.force_authenticate(pending)
        self.assertEqual(
            self.client.get(reverse("activity-photo-downloads", args=[activity.id])).status_code,
            403,
        )

    def test_attendee_before_start_forbidden_but_host_and_staff_allowed(self):
        activity, _ = self._event()
        ActivityParticipant.objects.create(activity=activity, user=self.guest, status="confirmed")
        url = reverse("activity-photo-downloads", args=[activity.id])
        self.client.force_authenticate(self.guest)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(self.host)
        self.assertEqual(self.client.get(url).status_code, 200)
        self.client.force_authenticate(_user("staff", is_staff=True))
        self.assertEqual(self.client.get(url).status_code, 200)

    def test_public_calendar_event_open_to_any_logged_in_user(self):
        activity, _ = self._event(list_on_church_calendar=True, calendar_approved=True)
        self.client.force_authenticate(self.stranger)
        resp = self.client.get(reverse("activity-photo-downloads", args=[activity.id]))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["photos"]), 1)

    def test_bad_expired_or_wrong_salt_token_rejected(self):
        activity, photo = self._event(**_past())
        base = reverse("activity-photo-download-file", args=[activity.id, photo.id])
        self.assertEqual(self.client.get(base).status_code, 403)
        self.assertEqual(self.client.get(base + "?t=junk").status_code, 403)
        view_token = TimestampSigner(salt="foyer-event-photo").sign(f"{activity.id}:{photo.id}")
        self.assertEqual(self.client.get(base + f"?t={view_token}").status_code, 403)
        good = TimestampSigner(salt=PHOTO_DOWNLOAD_SALT).sign(f"{activity.id}:{photo.id}")
        self.assertEqual(self.client.get(base + f"?t={good}").status_code, 200)
        with patch("django.core.signing.time.time", return_value=timezone.now().timestamp() + 3700):
            self.assertEqual(self.client.get(base + f"?t={good}").status_code, 403)
        wrong_photo = TimestampSigner(salt=PHOTO_DOWNLOAD_SALT).sign(
            f"{activity.id}:{photo.id + 1}"
        )
        self.assertEqual(self.client.get(base + f"?t={wrong_photo}").status_code, 403)


class HiddenAddressTests(APITestCase):
    def setUp(self):
        self.host = _user("host")
        self.guest = _user("guest")
        self.stranger = _user("stranger")
        self.member_event = _activity(self.host, location="12 Secret Ln")
        ActivityParticipant.objects.create(
            activity=self.member_event, user=self.guest, status="confirmed"
        )

    def _detail(self, user, activity=None):
        self.client.force_authenticate(user)
        return self.client.get(
            reverse("activity-detail", args=[(activity or self.member_event).id])
        )

    def test_hidden_from_non_going_viewers(self):
        data = self._detail(self.stranger).data
        for field in ("location", "latitude", "longitude"):
            self.assertIsNone(data[field])
        self.assertNotIn("Secret", str(data))

    def test_visible_to_host_going_and_staff(self):
        for user in (self.host, self.guest, _user("staff", is_staff=True)):
            data = self._detail(user).data
            self.assertEqual(data["location"], "12 Secret Ln")
            self.assertEqual(data["latitude"], 40.31)

    def test_pending_rsvp_does_not_reveal(self):
        pending = _user("pending")
        ActivityParticipant.objects.create(
            activity=self.member_event, user=pending, status="pending"
        )
        self.assertIsNone(self._detail(pending).data["location"])

    def test_list_endpoint_hides_too(self):
        self.client.force_authenticate(self.stranger)
        resp = self.client.get(reverse("activity-list"))
        results = resp.data["results"] if isinstance(resp.data, dict) else resp.data
        row = [r for r in results if r["id"] == self.member_event.id][0]
        self.assertIsNone(row["location"])

    def test_church_hosted_and_public_calendar_unaffected(self):
        church = _activity(self.host, host_kind="church", location="Church Hall")
        public = _activity(
            self.host, list_on_church_calendar=True, calendar_approved=True, location="Public Hall"
        )
        self.assertEqual(self._detail(self.stranger, church).data["location"], "Church Hall")
        self.assertEqual(self._detail(self.stranger, public).data["location"], "Public Hall")

    def test_calendar_links_for_hidden_viewer_have_no_address(self):
        from urllib.parse import parse_qs, urlparse

        links = self._detail(self.stranger).data["calendar_links"]
        self.assertNotIn("Secret", links["google_url"])
        self.assertNotIn("Secret", links["outlook_url"])
        token = parse_qs(urlparse(links["ics_url"]).query)["token"][0]
        self.client.force_authenticate(None)
        ics = self.client.get("/api/public/event.ics", {"token": token}).content.decode()
        self.assertNotIn("Secret", ics)
        self.assertIn("LOCATION:\r\n", ics)
        # viewers who may see the address get the normal link
        links = self._detail(self.guest).data["calendar_links"]
        self.assertIn("Secret", links["google_url"].replace("%20", " "))
        token = parse_qs(urlparse(links["ics_url"]).query)["token"][0]
        ics = self.client.get("/api/public/event.ics", {"token": token}).content.decode()
        self.assertIn("12 Secret Ln", ics)

    def test_hidden_token_for_church_event_still_shows_location(self):
        church = _activity(self.host, host_kind="church", location="Church Hall")
        resp = self.client.get(
            "/api/public/event.ics", {"token": event_ics_token(church.id, hide_location=True)}
        )
        self.assertIn("Church Hall", resp.content.decode())

    def test_event_ics_helper_default_unchanged(self):
        self.assertIn("12 Secret Ln", event_ics(self.member_event))


class ChatEmailLeakTests(APITestCase):
    def test_message_serializer_has_no_email(self):
        from chat.models import Conversation, Message
        from chat.serializers import MessageSerializer
        from matches.models import Match

        a, b = _user("aa"), _user("bb")
        convo = Conversation.objects.create(match=Match.objects.create(user_a=a, user_b=b))
        msg = Message.objects.create(conversation=convo, sender=a, text="hi")
        data = MessageSerializer(msg).data
        self.assertEqual(data["user"], {"id": a.id, "firstName": "Aa"})
        self.assertNotIn("example.com", str(data))
