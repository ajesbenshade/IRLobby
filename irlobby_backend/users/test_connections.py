"""Profile → Connections: gathering peers and active pray-er rows."""

from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.eligibility import event_local_date
from activities.models import ActivityParticipant, Church, HouseholdDependent
from activities.test_foyer import _activity, _safe_birthdate
from moderation.models import BlockedUser
from prayers.models import PrayerParticipant, PrayerPass, PrayerRequest
from users.connections import RECENT_GATHERING_DAYS
from users.models import Friendship, User

GATHERING_KEYS = {
    "user_id",
    "first_name",
    "last_initial",
    "display_name",
    "avatar_url",
    "context_title",
    "context_kind",
    "context_id",
    "context_date",
}
PRAYER_KEYS = GATHERING_KEYS - {"context_date"}


def make_user(name, **extra):
    church = extra.pop("church", None)
    age = extra.pop("age", 36)
    return User.objects.create_user(
        username=name,
        email=f"{name}@example.com",
        password="Passw0rd-123",
        first_name=extra.pop("first_name", name.capitalize()),
        last_name=extra.pop("last_name", "Lee"),
        date_of_birth=_safe_birthdate(age),
        profile_visibility=extra.pop("profile_visibility", "public"),
        avatar_url=extra.pop("avatar_url", ""),
        church=church,
        **extra,
    )


def confirm(user, activity, *, include_self=True, dependents=()):
    row = ActivityParticipant.objects.create(
        activity=activity,
        user=user,
        status="confirmed",
        include_self=include_self,
    )
    if dependents:
        row.dependents.set(dependents)
    return row


class ConnectionsApiTests(APITestCase):
    def setUp(self):
        self.church = Church.objects.create(name="Franconia")
        self.other_church = Church.objects.create(name="Souderton")
        self.viewer = make_user("viewer", church=self.church, first_name="Alex", last_name="Kim")
        self.url = reverse("user-connections")

    def connections(self, user=None):
        self.client.force_authenticate(user or self.viewer)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data

    def test_auth_required_and_empty_lists(self):
        anonymous = self.client.get(self.url)
        self.assertEqual(anonymous.status_code, status.HTTP_401_UNAUTHORIZED)

        body = self.connections()
        self.assertEqual(body, {"gathering": [], "praying": []})

    def test_gathering_list(self):
        host = make_user("hostonly", first_name="Host", last_name="Only")
        maria = make_user(
            "maria",
            first_name="Maria",
            last_name="garcia",
            avatar_url="https://cdn.example/maria.png",
        )
        elena = make_user(
            "elena",
            first_name="Elena",
            last_name="Nguyen",
            church=self.church,
            profile_visibility="church",
        )
        sam = make_user("sam", first_name="Sam", last_name="Ortiz")
        hidden = make_user("hiddenpal", profile_visibility="only_me")
        outsider = make_user(
            "outsider",
            church=self.other_church,
            profile_visibility="church",
            first_name="Omar",
        )
        pending = make_user("pendingpal", first_name="Pending")
        declined = make_user("declinedpal", first_name="Declined")
        old_pal = make_user("oldpal", first_name="Old")
        cancelled_pal = make_user("cancelledpal", first_name="Cancelled")
        empty_party = make_user("emptyparty", first_name="Empty")
        private_friend = make_user("privatefriend", profile_visibility="only_me", first_name="Pat")
        teen_friend = make_user(
            "teenfriend", age=15, profile_visibility="only_me", first_name="Teen", last_name="Park"
        )
        teen_stranger = make_user(
            "teenstranger", age=15, profile_visibility="public", first_name="Sky", last_name="Young"
        )
        Friendship.objects.create(
            requester=self.viewer,
            recipient=teen_friend,
            status="accepted",
            responded_at=timezone.now(),
        )
        Friendship.objects.create(
            requester=self.viewer,
            recipient=private_friend,
            status="accepted",
            responded_at=timezone.now(),
        )
        child = HouseholdDependent.objects.create(
            parent=maria,
            name="Noah Kid",
            relationship="child",
            birth_month=3,
            birth_year=_safe_birthdate(8).year,
        )
        spouse = HouseholdDependent.objects.create(
            parent=maria, name="Pat Spouse", relationship="spouse"
        )
        sam_child = HouseholdDependent.objects.create(
            parent=sam,
            name="Toddler Kim",
            relationship="child",
            birth_month=6,
            birth_year=_safe_birthdate(4).year,
        )

        now = timezone.now()
        potluck = _activity(host, title="Saturday potluck", time=now + timedelta(days=2))
        retreat = _activity(host, title="Fall retreat", time=now + timedelta(days=10))
        recent = _activity(host, title="Recent supper", time=now - timedelta(days=2))
        stale = _activity(
            host,
            title="Old supper",
            time=now - timedelta(days=RECENT_GATHERING_DAYS + 3),
        )
        cancelled = _activity(
            host, title="Cancelled picnic", time=now + timedelta(days=3), is_cancelled=True
        )
        long_event = _activity(
            host,
            title="Long retreat",
            time=now - timedelta(days=RECENT_GATHERING_DAYS + 5),
            end_time=now + timedelta(days=1),
        )
        long_guest = make_user("longguest", first_name="Long", last_name="Guest")

        for activity in (potluck, retreat, recent, stale, cancelled, long_event):
            confirm(self.viewer, activity)
        confirm(maria, potluck, dependents=(child, spouse))
        confirm(maria, retreat)
        confirm(elena, retreat)
        confirm(sam, recent, include_self=False, dependents=(sam_child,))
        confirm(hidden, potluck)
        confirm(outsider, potluck)
        confirm(teen_friend, potluck)
        confirm(teen_stranger, potluck)
        confirm(private_friend, potluck)
        confirm(old_pal, stale)
        confirm(cancelled_pal, cancelled)
        confirm(long_guest, long_event)
        confirm(empty_party, potluck, include_self=False)
        ActivityParticipant.objects.create(activity=potluck, user=pending, status="pending")
        ActivityParticipant.objects.create(activity=potluck, user=declined, status="declined")

        gathering = self.connections()["gathering"]
        pairs = [(row["user_id"], row["context_id"]) for row in gathering]

        self.assertIn((maria.id, potluck.id), pairs)
        self.assertIn((maria.id, retreat.id), pairs)
        self.assertIn((elena.id, retreat.id), pairs)
        self.assertIn((sam.id, recent.id), pairs)
        self.assertIn((teen_friend.id, potluck.id), pairs)
        self.assertIn((long_guest.id, long_event.id), pairs)

        omitted = [
            host.id,
            hidden.id,
            outsider.id,
            pending.id,
            declined.id,
            old_pal.id,
            cancelled_pal.id,
            empty_party.id,
            private_friend.id,
            teen_stranger.id,
            self.viewer.id,
        ]
        listed_ids = {user_id for user_id, _activity_id in pairs}
        for user_id in omitted:
            self.assertNotIn(user_id, listed_ids)

        blob = str(gathering)
        self.assertNotIn("Noah Kid", blob)
        self.assertNotIn("Pat Spouse", blob)
        self.assertNotIn("Toddler Kim", blob)
        self.assertNotIn("@example.com", blob)

        maria_potluck = next(
            row
            for row in gathering
            if row["user_id"] == maria.id and row["context_id"] == potluck.id
        )
        self.assertEqual(set(maria_potluck), GATHERING_KEYS)
        self.assertEqual(maria_potluck["first_name"], "Maria")
        self.assertEqual(maria_potluck["last_initial"], "G")
        self.assertEqual(maria_potluck["display_name"], "Maria G.")
        self.assertEqual(maria_potluck["avatar_url"], "https://cdn.example/maria.png")
        self.assertEqual(maria_potluck["context_title"], "Saturday potluck")
        self.assertEqual(maria_potluck["context_kind"], "gathering")
        self.assertEqual(maria_potluck["context_date"], event_local_date(potluck).isoformat())

        def index(user_id, activity_id):
            return next(
                i
                for i, row in enumerate(gathering)
                if row["user_id"] == user_id and row["context_id"] == activity_id
            )

        self.assertLess(index(maria.id, potluck.id), index(elena.id, retreat.id))
        self.assertLess(index(elena.id, retreat.id), index(maria.id, retreat.id))
        self.assertLess(index(maria.id, retreat.id), index(sam.id, recent.id))

    def _prayer(self, author, title):
        return PrayerRequest.objects.create(
            author=author, church=self.church, title=title, whole_church=True
        )

    def test_praying_list(self):
        visible = make_user(
            "sarah",
            first_name="Sarah",
            last_name="Lee",
            avatar_url="https://cdn.example/sarah.png",
        )
        hidden = make_user(
            "quiet",
            first_name="Quiet",
            last_name="Ng",
            profile_visibility="only_me",
            church=self.other_church,
            avatar_url="https://cdn.example/quiet.png",
        )
        stopped_author = make_user("stopped", first_name="Stopped", last_name="Ray")
        passed_author = make_user("passed", first_name="Passed", last_name="Ray")
        co_prayer = make_user("coprayer", first_name="Co", last_name="Pray")

        open_prayer = self._prayer(visible, "Dad's surgery")
        hidden_prayer = self._prayer(hidden, "A quiet request")
        stopped = self._prayer(stopped_author, "Already stopped")
        passed = self._prayer(passed_author, "Just passed")
        own = self._prayer(self.viewer, "My own request")

        PrayerParticipant.objects.create(
            prayer_request=open_prayer, user=self.viewer, status=PrayerParticipant.STATUS_PRAYING
        )
        PrayerParticipant.objects.create(
            prayer_request=open_prayer, user=co_prayer, status=PrayerParticipant.STATUS_PRAYING
        )
        PrayerParticipant.objects.create(
            prayer_request=hidden_prayer, user=self.viewer, status=PrayerParticipant.STATUS_PRAYING
        )
        PrayerParticipant.objects.create(
            prayer_request=stopped, user=self.viewer, status=PrayerParticipant.STATUS_STOPPED
        )
        PrayerParticipant.objects.create(
            prayer_request=own, user=self.viewer, status=PrayerParticipant.STATUS_PRAYING
        )
        # Pass does not join. No participant row.
        PrayerPass.objects.create(prayer_request=passed, user=self.viewer)

        # Older prayer first in the table, so the newer one (hidden) sorts first.
        open_prayer.created_at = timezone.now() - timedelta(days=2)
        open_prayer.save(update_fields=["created_at"])

        praying = self.connections()["praying"]
        self.assertEqual([row["context_id"] for row in praying], [hidden_prayer.id, open_prayer.id])

        hidden_row, open_row = praying
        self.assertEqual(set(hidden_row), PRAYER_KEYS)
        self.assertIsNone(hidden_row["user_id"])
        self.assertEqual(hidden_row["avatar_url"], "")
        self.assertEqual(hidden_row["first_name"], "Quiet")
        self.assertEqual(hidden_row["last_initial"], "N")
        self.assertEqual(hidden_row["display_name"], "Quiet N.")
        self.assertEqual(hidden_row["context_title"], "A quiet request")
        self.assertEqual(hidden_row["context_kind"], "prayer")
        self.assertNotIn("context_date", hidden_row)

        self.assertEqual(open_row["user_id"], visible.id)
        self.assertEqual(open_row["avatar_url"], "https://cdn.example/sarah.png")
        self.assertEqual(open_row["display_name"], "Sarah L.")
        self.assertEqual(open_row["context_title"], "Dad's surgery")
        self.assertNotIn(co_prayer.id, [row["user_id"] for row in praying])
        self.assertNotIn(self.viewer.id, [row["user_id"] for row in praying])
        self.assertNotIn(stopped.id, [row["context_id"] for row in praying])
        self.assertNotIn(passed.id, [row["context_id"] for row in praying])
        self.assertNotIn(own.id, [row["context_id"] for row in praying])

    def test_stop_praying_removes_the_row(self):
        kept = make_user("kept", first_name="Kept", last_name="One")
        leaving = make_user("leaving", first_name="Leaving", last_name="Two")
        keep_prayer = self._prayer(kept, "Keep praying")
        leave_prayer = self._prayer(leaving, "Stop this one")
        for prayer in (keep_prayer, leave_prayer):
            PrayerParticipant.objects.create(
                prayer_request=prayer, user=self.viewer, status=PrayerParticipant.STATUS_PRAYING
            )

        self.client.force_authenticate(self.viewer)
        stopped = self.client.post(reverse("prayer-stop", args=[leave_prayer.id]))
        self.assertEqual(stopped.status_code, status.HTTP_200_OK)
        self.assertFalse(stopped.data["is_praying"])

        praying = self.connections()["praying"]
        self.assertEqual([row["context_id"] for row in praying], [keep_prayer.id])
        self.assertEqual(
            PrayerParticipant.objects.get(prayer_request=leave_prayer, user=self.viewer).status,
            PrayerParticipant.STATUS_STOPPED,
        )

    def test_blocks_omit_both_lists(self):
        blocked_by_me = make_user("blockedbyme", first_name="Blocked", last_name="Me")
        blocked_me = make_user("blockedme", first_name="Blocked", last_name="Them")
        allowed = make_user("allowed", first_name="Allowed", last_name="Stay")
        host = make_user("blockhost")
        gathering = _activity(host, title="Shared table", time=timezone.now() + timedelta(days=1))
        confirm(self.viewer, gathering)
        for person in (blocked_by_me, blocked_me, allowed):
            confirm(person, gathering)
            prayer = self._prayer(person, f"Pray {person.first_name}")
            PrayerParticipant.objects.create(
                prayer_request=prayer, user=self.viewer, status=PrayerParticipant.STATUS_PRAYING
            )

        BlockedUser.objects.create(blocker=self.viewer, blocked=blocked_by_me)
        BlockedUser.objects.create(blocker=blocked_me, blocked=self.viewer)

        body = self.connections()
        gathering_ids = {row["user_id"] for row in body["gathering"]}
        praying_ids = {row["user_id"] for row in body["praying"]}
        self.assertEqual(gathering_ids, {allowed.id})
        self.assertEqual(praying_ids, {allowed.id})
        self.assertNotIn(blocked_by_me.id, gathering_ids | praying_ids)
        self.assertNotIn(blocked_me.id, gathering_ids | praying_ids)
