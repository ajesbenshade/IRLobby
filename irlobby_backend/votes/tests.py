"""Voting ballots: audience, one cast, and who may see results.

``voting_member_attested_at`` is the gate. These tests attest 18+ accounts so
the same cases pass. Age 18 in America/New_York is covered only by patching the
column absent.
"""

from datetime import timedelta
from unittest.mock import patch

from django.conf import settings
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.eligibility import age_on, ny_today
from activities.models import Church, HouseholdDependent
from moderation.models import BlockedUser
from prayers.models import Circle, CircleMembership
from users.models import User
from votes.eligibility import (
    ATTESTED_GATE_DETAIL,
    VOTING_MEMBER_FIELD,
    is_voting_member,
    model_has_voting_member_field,
    not_voting_member_detail,
)
from votes.models import Ballot, BallotVote

CHURCH_ADMIN_EMAIL = "churchadmin@example.com"


def years_ago(years: int):
    today = ny_today()
    try:
        return today.replace(year=today.year - years)
    except ValueError:
        return today.replace(year=today.year - years, day=28)


def make_user(name, church=None, *, dob=True, first_name=None):
    user = User.objects.create_user(
        username=name,
        email=f"{name}@example.com",
        password="Passw0rd-123",
        first_name=first_name if first_name is not None else name.capitalize(),
        last_name="Lee",
    )
    user.church = church
    if dob is True:
        user.date_of_birth = years_ago(30)
    elif dob is False:
        user.date_of_birth = None
    else:
        user.date_of_birth = dob
    user.save()
    if (
        model_has_voting_member_field()
        and user.date_of_birth is not None
        and (age_on(user.date_of_birth, ny_today()) or 0) >= 18
    ):
        setattr(user, VOTING_MEMBER_FIELD, timezone.now())
        user.save(update_fields=[VOTING_MEMBER_FIELD])
    return user


def set_attested(user, value):
    setattr(user, VOTING_MEMBER_FIELD, value)
    if model_has_voting_member_field():
        user.save(update_fields=[VOTING_MEMBER_FIELD])
    return user


def flat(value) -> str:
    if isinstance(value, (list, tuple)):
        return " ".join(flat(item) for item in value)
    return str(value)


def future():
    return timezone.now() + timedelta(days=7)


@override_settings(FOYER_CHURCH_ADMIN_EMAILS=[CHURCH_ADMIN_EMAIL])
class BallotApiTests(APITestCase):
    def setUp(self):
        rates = dict(settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"])
        rates["ballot_create"] = "1000/hour"
        framework = {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": rates}
        self.rate = override_settings(REST_FRAMEWORK=framework)
        self.rate.enable()
        self.addCleanup(self.rate.disable)
        self.church = Church.objects.create(name="Franconia")
        self.other_church = Church.objects.create(name="Souderton")
        self.circle_admin = make_user("sarah", self.church, first_name="Sarah")
        self.member = make_user("anna", self.church, first_name="Anna")
        self.peer = make_user("ben", self.church, first_name="Ben")
        self.parents_member = make_user("mia", self.church, first_name="Mia")
        self.parents_admin = make_user("priya", self.church, first_name="Priya")
        self.outsider = make_user("daniel", self.church, first_name="Daniel")
        self.other = make_user("noah", self.other_church, first_name="Noah")
        self.youth = make_user("teen", self.church, dob=years_ago(16), first_name="Teen")
        self.no_dob = make_user("nodob", self.church, dob=False, first_name="NoDob")
        self.church_admin = make_user("churchadmin", self.church, first_name="Church")
        self.unchurched = make_user("pat", None, first_name="Pat")
        self.elders_admin = make_user("ruth", self.church, first_name="Ruth")

        self.parents = Circle.objects.create(
            church=self.church, name="Parents", created_by=self.circle_admin
        )
        self.young = Circle.objects.create(
            church=self.church, name="Young Adults", created_by=self.circle_admin
        )
        self.elders = Circle.objects.create(
            church=self.church, name="Elders", created_by=self.elders_admin
        )
        CircleMembership.objects.create(circle=self.parents, user=self.circle_admin, is_admin=True)
        CircleMembership.objects.create(circle=self.young, user=self.circle_admin, is_admin=True)
        CircleMembership.objects.create(circle=self.young, user=self.member)
        CircleMembership.objects.create(circle=self.young, user=self.peer)
        CircleMembership.objects.create(circle=self.young, user=self.youth)
        CircleMembership.objects.create(circle=self.young, user=self.no_dob)
        CircleMembership.objects.create(circle=self.parents, user=self.parents_member)
        CircleMembership.objects.create(circle=self.parents, user=self.parents_admin, is_admin=True)
        CircleMembership.objects.create(circle=self.elders, user=self.elders_admin, is_admin=True)
        HouseholdDependent.objects.create(
            parent=self.member,
            name="Kid",
            relationship="child",
            date_of_birth=years_ago(8),
        )

    def create(self, user, **extra):
        self.client.force_authenticate(user)
        body = {"title": "Approve the budget", "closes_at": future().isoformat()}
        body.update(extra)
        return self.client.post(reverse("ballot-list"), body, format="json")

    def _ids(self, rows):
        return [row["id"] for row in rows]

    def test_auth_required_on_every_route(self):
        ballot = self.create(self.circle_admin, circle_ids=[self.young.id])
        self.client.force_authenticate(user=None)
        routes = [
            self.client.get(reverse("ballot-list")),
            self.client.post(reverse("ballot-list"), {}, format="json"),
            self.client.get(reverse("ballot-detail", args=[ballot.data["id"]])),
            self.client.post(reverse("ballot-vote", args=[ballot.data["id"]]), {}, format="json"),
            self.client.post(reverse("ballot-close", args=[ballot.data["id"]]), {}, format="json"),
        ]
        self.assertTrue(
            all(response.status_code == status.HTTP_401_UNAUTHORIZED for response in routes)
        )

    def test_create_defaults_to_yes_no_and_the_first_admin_circle(self):
        created = self.create(self.circle_admin, title="  <b>Approve the budget</b>  ")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["title"], "Approve the budget")
        self.assertEqual(created.data["description"], "")
        self.assertEqual(created.data["results_mode"], "after_close")
        self.assertFalse(created.data["whole_church"])
        self.assertEqual(created.data["circles"], [{"id": self.parents.id, "name": "Parents"}])
        self.assertEqual(created.data["visibility_summary"], "Parents")
        self.assertEqual([row["label"] for row in created.data["choices"]], ["Yes", "No"])
        self.assertEqual([row["position"] for row in created.data["choices"]], [0, 1])
        self.assertTrue(created.data["is_open"])
        self.assertTrue(created.data["can_close"])
        self.assertTrue(created.data["can_vote"])
        self.assertTrue(created.data["results_visible"])
        self.assertEqual(created.data["total_votes"], 0)
        self.assertEqual([row["vote_count"] for row in created.data["choices"]], [0, 0])
        self.assertFalse(set(created.data) & {"url", "public_url", "share_url", "token", "link"})
        self.assertEqual(created.data["author"]["display_name"], "Sarah L.")

    def test_church_admin_default_is_still_a_circle_not_whole_church(self):
        CircleMembership.objects.create(circle=self.young, user=self.church_admin, is_admin=True)
        created = self.create(self.church_admin)
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertFalse(created.data["whole_church"])
        self.assertEqual(created.data["circles"][0]["id"], self.young.id)

    def test_church_admin_must_opt_in_to_whole_church(self):
        missing = self.create(self.church_admin)
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("whole church", flat(missing.data["circle_ids"]))
        self.assertEqual(Ballot.objects.count(), 0)

        created = self.create(self.church_admin, whole_church=True, description="  <i>Note</i> ")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertTrue(created.data["whole_church"])
        self.assertEqual(created.data["circles"], [])
        self.assertEqual(created.data["visibility_summary"], "Whole church")
        self.assertEqual(created.data["description"], "Note")
        self.assertTrue(created.data["can_vote"])

        self.client.force_authenticate(self.outsider)
        listing = self.client.get(reverse("ballot-list"))
        self.assertEqual(self._ids(listing.data["open"]), [created.data["id"]])
        self.assertEqual(listing.data["closed"], [])

    def test_circle_admin_cannot_open_whole_church_or_another_admins_circle(self):
        whole = self.create(self.circle_admin, whole_church=True, circle_ids=[self.young.id])
        self.assertEqual(whole.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("church admin", flat(whole.data["whole_church"]))

        elders = self.create(self.circle_admin, circle_ids=[self.elders.id])
        self.assertEqual(elders.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("circles you admin", flat(elders.data["circle_ids"]))

        foreign = Circle.objects.create(
            church=self.other_church, name="Elsewhere", created_by=self.other
        )
        other_church = self.create(self.circle_admin, circle_ids=[foreign.id])
        self.assertEqual(other_church.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("your church", flat(other_church.data["circle_ids"]))

        member = self.create(self.member, circle_ids=[self.young.id])
        self.assertEqual(member.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("circles you admin", flat(member.data["circle_ids"]))
        omitted = self.create(self.member)
        self.assertEqual(omitted.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("circle admin", flat(omitted.data["circle_ids"]))

        no_church = self.create(self.unchurched)
        self.assertEqual(no_church.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Join a church", flat(no_church.data["church"]))

    def test_church_admin_can_create_for_any_circle_in_the_church(self):
        created = self.create(
            self.church_admin,
            circle_ids=[self.elders.id, self.elders.id],
            choices=["No", "Yes"],
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["circles"], [{"id": self.elders.id, "name": "Elders"}])
        self.assertEqual([row["label"] for row in created.data["choices"]], ["No", "Yes"])
        self.assertFalse(created.data["can_vote"])
        self.assertTrue(created.data["can_close"])
        self.assertTrue(created.data["results_visible"])

    def test_choice_and_schedule_validation(self):
        past = self.create(
            self.circle_admin,
            circle_ids=[self.young.id],
            closes_at=(timezone.now() - timedelta(minutes=1)).isoformat(),
        )
        self.assertEqual(past.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("future", flat(past.data["closes_at"]))

        blank = self.create(self.circle_admin, title="  <b></b> ", circle_ids=[self.young.id])
        self.assertIn("Title is required.", flat(blank.data["title"]))

        long_title = self.create(self.circle_admin, title="a" * 141, circle_ids=[self.young.id])
        self.assertEqual(long_title.status_code, status.HTTP_400_BAD_REQUEST)

        long_description = self.create(
            self.circle_admin, circle_ids=[self.young.id], description="a" * 2001
        )
        self.assertEqual(long_description.status_code, status.HTTP_400_BAD_REQUEST)

        mode = self.create(self.circle_admin, circle_ids=[self.young.id], results_mode="now")
        self.assertEqual(mode.status_code, status.HTTP_400_BAD_REQUEST)

        one = self.create(self.circle_admin, circle_ids=[self.young.id], choices=["Only"])
        self.assertIn("2 to 6", flat(one.data["choices"]))
        seven = self.create(
            self.circle_admin,
            circle_ids=[self.young.id],
            choices=[f"Option {index}" for index in range(7)],
        )
        self.assertEqual(seven.status_code, status.HTTP_400_BAD_REQUEST)
        duplicate = self.create(
            self.circle_admin, circle_ids=[self.young.id], choices=["Yes", " yes "]
        )
        self.assertIn("different", flat(duplicate.data["choices"]))
        empty = self.create(self.circle_admin, circle_ids=[self.young.id], choices=["Yes", "  "])
        self.assertIn("label", flat(empty.data["choices"]))

        created = self.create(
            self.circle_admin,
            circle_ids=[self.young.id],
            choices=[" <b>Stay</b> ", "Go"],
            results_mode="live",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual([row["label"] for row in created.data["choices"]], ["Stay", "Go"])
        self.assertEqual(created.data["results_mode"], "live")
        six = self.create(
            self.circle_admin,
            circle_ids=[self.young.id],
            choices=[f"Option {index}" for index in range(6)],
        )
        self.assertEqual(six.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(six.data["choices"]), 6)

    def test_member_casts_one_vote_and_does_not_see_counts_until_close(self):
        created = self.create(self.circle_admin, circle_ids=[self.young.id])
        ballot_id = created.data["id"]
        yes_id = created.data["choices"][0]["id"]
        no_id = created.data["choices"][1]["id"]

        self.client.force_authenticate(self.member)
        detail = self.client.get(reverse("ballot-detail", args=[ballot_id]))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertTrue(detail.data["can_vote"])
        self.assertFalse(detail.data["can_close"])
        self.assertFalse(detail.data["results_visible"])
        self.assertIsNone(detail.data["total_votes"])
        self.assertIsNone(detail.data["my_choice_id"])
        self.assertTrue(all(row["vote_count"] is None for row in detail.data["choices"]))
        self.assertEqual(set(detail.data["choices"][0]), {"id", "label", "position", "vote_count"})

        missing = self.client.post(reverse("ballot-vote", args=[ballot_id]), {}, format="json")
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("choice_id", missing.data)

        other = self.create(self.circle_admin, circle_ids=[self.young.id], title="Other")
        self.client.force_authenticate(self.member)
        wrong = self.client.post(
            reverse("ballot-vote", args=[ballot_id]),
            {"choice_id": other.data["choices"][0]["id"], "household_member_id": 1},
            format="json",
        )
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("this ballot", flat(wrong.data["choice_id"]))
        self.assertEqual(BallotVote.objects.filter(ballot_id=ballot_id).count(), 0)

        voted = self.client.post(
            reverse("ballot-vote", args=[ballot_id]),
            {
                "choice_id": yes_id,
                "household_member_id": self.member.household_dependents.first().id,
            },
            format="json",
        )
        self.assertEqual(voted.status_code, status.HTTP_201_CREATED)
        self.assertTrue(voted.data["has_voted"])
        self.assertEqual(voted.data["my_choice_id"], yes_id)
        self.assertFalse(voted.data["can_vote"])
        self.assertIsNone(voted.data["total_votes"])
        self.assertEqual(BallotVote.objects.get(ballot_id=ballot_id).user_id, self.member.id)

        changed = self.client.post(
            reverse("ballot-vote", args=[ballot_id]), {"choice_id": no_id}, format="json"
        )
        self.assertEqual(changed.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(changed.data["code"], "already_voted")
        self.assertEqual(BallotVote.objects.get(ballot_id=ballot_id).choice_id, yes_id)

        self.client.force_authenticate(self.peer)
        peer = self.client.post(
            reverse("ballot-vote", args=[ballot_id]), {"choice_id": no_id}, format="json"
        )
        self.assertEqual(peer.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(self.circle_admin)
        admin_view = self.client.get(reverse("ballot-detail", args=[ballot_id]))
        counts = {row["label"]: row["vote_count"] for row in admin_view.data["choices"]}
        self.assertEqual(counts, {"Yes": 1, "No": 1})
        self.assertEqual(admin_view.data["total_votes"], 2)
        self.assertIsNone(admin_view.data["my_choice_id"])

    def test_live_results_are_visible_to_voters_while_open(self):
        created = self.create(self.circle_admin, circle_ids=[self.young.id], results_mode="live")
        ballot_id = created.data["id"]
        yes_id = created.data["choices"][0]["id"]
        self.client.force_authenticate(self.member)
        before = self.client.get(reverse("ballot-detail", args=[ballot_id]))
        self.assertTrue(before.data["results_visible"])
        self.assertEqual(before.data["total_votes"], 0)
        self.client.post(
            reverse("ballot-vote", args=[ballot_id]), {"choice_id": yes_id}, format="json"
        )
        after = self.client.get(reverse("ballot-detail", args=[ballot_id]))
        self.assertEqual(after.data["total_votes"], 1)
        self.assertEqual(after.data["choices"][0]["vote_count"], 1)
        self.assertEqual(after.data["choices"][1]["vote_count"], 0)

    def test_close_early_moves_the_ballot_and_reveals_results(self):
        created = self.create(self.circle_admin, circle_ids=[self.young.id, self.parents.id])
        ballot_id = created.data["id"]
        self.assertEqual(created.data["visibility_summary"], "Parents, Young Adults")

        self.client.force_authenticate(self.member)
        denied = self.client.post(reverse("ballot-close", args=[ballot_id]), {}, format="json")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(denied.data["code"], "not_ballot_admin")

        self.client.force_authenticate(self.parents_admin)
        closed = self.client.post(reverse("ballot-close", args=[ballot_id]), {}, format="json")
        self.assertEqual(closed.status_code, status.HTTP_200_OK)
        self.assertFalse(closed.data["is_open"])
        self.assertFalse(closed.data["can_close"])
        self.assertIsNotNone(closed.data["closed_at"])
        self.assertTrue(closed.data["results_visible"])
        again = self.client.post(reverse("ballot-close", args=[ballot_id]), {}, format="json")
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(again.data["closed_at"], closed.data["closed_at"])

        self.client.force_authenticate(self.member)
        detail = self.client.get(reverse("ballot-detail", args=[ballot_id]))
        self.assertFalse(detail.data["is_open"])
        self.assertTrue(detail.data["results_visible"])
        self.assertEqual(detail.data["total_votes"], 0)
        vote = self.client.post(
            reverse("ballot-vote", args=[ballot_id]),
            {"choice_id": detail.data["choices"][0]["id"]},
            format="json",
        )
        self.assertEqual(vote.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(vote.data["code"], "ballot_closed")

        listing = self.client.get(reverse("ballot-list"))
        self.assertEqual(listing.data["open"], [])
        self.assertEqual(self._ids(listing.data["closed"]), [ballot_id])
        self.assertNotIn("results", listing.data)

    def test_reaching_closes_at_closes_without_an_early_close_stamp(self):
        created = self.create(self.circle_admin, circle_ids=[self.young.id])
        ballot_id = created.data["id"]
        Ballot.objects.filter(pk=ballot_id).update(closes_at=timezone.now() - timedelta(minutes=1))
        self.client.force_authenticate(self.member)
        detail = self.client.get(reverse("ballot-detail", args=[ballot_id]))
        self.assertFalse(detail.data["is_open"])
        self.assertIsNone(detail.data["closed_at"])
        self.assertTrue(detail.data["results_visible"])
        listing = self.client.get(reverse("ballot-list"))
        self.assertEqual(self._ids(listing.data["closed"]), [ballot_id])
        self.assertEqual(listing.data["open"], [])

    def test_open_and_closed_sections_are_newest_first(self):
        older = self.create(self.circle_admin, circle_ids=[self.young.id], title="Older")
        newer = self.create(self.circle_admin, circle_ids=[self.young.id], title="Newer")
        closed = self.create(self.circle_admin, circle_ids=[self.young.id], title="Closed")
        now = timezone.now()
        Ballot.objects.filter(pk=older.data["id"]).update(created_at=now - timedelta(days=3))
        Ballot.objects.filter(pk=newer.data["id"]).update(created_at=now - timedelta(days=1))
        Ballot.objects.filter(pk=closed.data["id"]).update(
            created_at=now, closed_at=now, closes_at=now + timedelta(days=2)
        )
        self.client.force_authenticate(self.member)
        listing = self.client.get(reverse("ballot-list"))
        self.assertEqual(self._ids(listing.data["open"]), [newer.data["id"], older.data["id"]])
        self.assertEqual(self._ids(listing.data["closed"]), [closed.data["id"]])

    def test_outsiders_youth_and_household_children_never_see_or_vote(self):
        created = self.create(self.circle_admin, circle_ids=[self.young.id])
        ballot_id = created.data["id"]
        choice_id = created.data["choices"][0]["id"]
        hidden_from = [self.outsider, self.other, self.youth, self.no_dob, self.unchurched]
        for user in hidden_from:
            self.client.force_authenticate(user)
            listing = self.client.get(reverse("ballot-list"))
            self.assertEqual(listing.status_code, status.HTTP_200_OK)
            self.assertEqual(listing.data, {"open": [], "closed": []})
            self.assertEqual(
                self.client.get(reverse("ballot-detail", args=[ballot_id])).status_code,
                status.HTTP_404_NOT_FOUND,
            )
            self.assertEqual(
                self.client.post(
                    reverse("ballot-vote", args=[ballot_id]),
                    {"choice_id": choice_id},
                    format="json",
                ).status_code,
                status.HTTP_404_NOT_FOUND,
            )
            self.assertEqual(
                self.client.post(reverse("ballot-close", args=[ballot_id])).status_code,
                status.HTTP_404_NOT_FOUND,
            )

        youth_create = self.create(self.youth, circle_ids=[self.young.id])
        self.assertEqual(youth_create.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(youth_create.data["code"], "not_voting_member")
        self.assertEqual(youth_create.data["detail"], not_voting_member_detail())
        self.assertEqual(
            self.create(self.no_dob, circle_ids=[self.young.id]).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.get(reverse("ballot-detail", args=[999999])).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_church_admin_sees_circle_ballots_but_cannot_vote_from_outside(self):
        created = self.create(self.circle_admin, circle_ids=[self.young.id])
        ballot_id = created.data["id"]
        self.client.force_authenticate(self.church_admin)
        detail = self.client.get(reverse("ballot-detail", args=[ballot_id]))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertFalse(detail.data["can_vote"])
        self.assertTrue(detail.data["can_close"])
        self.assertEqual(detail.data["total_votes"], 0)
        vote = self.client.post(
            reverse("ballot-vote", args=[ballot_id]),
            {"choice_id": detail.data["choices"][0]["id"]},
            format="json",
        )
        self.assertEqual(vote.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(vote.data["code"], "not_eligible")
        self.assertEqual(BallotVote.objects.filter(ballot_id=ballot_id).count(), 0)

        self.client.force_authenticate(self.other)
        self.assertEqual(
            self.client.get(reverse("ballot-detail", args=[ballot_id])).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_one_vote_across_circles_and_blocks_do_not_hide_ballots(self):
        created = self.create(self.circle_admin, circle_ids=[self.young.id, self.parents.id])
        ballot_id = created.data["id"]
        choice_id = created.data["choices"][0]["id"]
        BlockedUser.objects.create(blocker=self.member, blocked=self.circle_admin)
        self.client.force_authenticate(self.member)
        self.assertEqual(
            self.client.post(
                reverse("ballot-vote", args=[ballot_id]), {"choice_id": choice_id}, format="json"
            ).status_code,
            status.HTTP_201_CREATED,
        )
        self.client.force_authenticate(self.parents_member)
        second = self.client.post(
            reverse("ballot-vote", args=[ballot_id]), {"choice_id": choice_id}, format="json"
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(BallotVote.objects.filter(ballot_id=ballot_id).count(), 2)
        CircleMembership.objects.filter(circle=self.young, user=self.member).delete()
        self.client.force_authenticate(self.member)
        self.assertEqual(
            self.client.get(reverse("ballot-detail", args=[ballot_id])).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            BallotVote.objects.filter(ballot_id=ballot_id, user=self.member).count(), 1
        )

    def test_author_who_loses_admin_can_see_but_not_close_or_vote_once_they_leave(self):
        created = self.create(self.circle_admin, circle_ids=[self.parents.id])
        ballot_id = created.data["id"]
        CircleMembership.objects.filter(circle=self.parents, user=self.circle_admin).update(
            is_admin=False
        )
        self.client.force_authenticate(self.circle_admin)
        demoted = self.client.post(reverse("ballot-close", args=[ballot_id]), {}, format="json")
        self.assertEqual(demoted.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(demoted.data["code"], "not_ballot_admin")
        CircleMembership.objects.filter(circle=self.parents, user=self.circle_admin).delete()
        detail = self.client.get(reverse("ballot-detail", args=[ballot_id]))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertFalse(detail.data["can_vote"])
        self.assertFalse(detail.data["can_close"])
        vote = self.client.post(
            reverse("ballot-vote", args=[ballot_id]),
            {"choice_id": detail.data["choices"][0]["id"]},
            format="json",
        )
        self.assertEqual(vote.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(vote.data["code"], "not_eligible")

    def test_null_author_still_lists_for_the_circle(self):
        created = self.create(self.circle_admin, circle_ids=[self.young.id])
        Ballot.objects.filter(pk=created.data["id"]).update(author=None)
        self.client.force_authenticate(self.member)
        detail = self.client.get(reverse("ballot-detail", args=[created.data["id"]]))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertIsNone(detail.data["author"])

    def test_attested_column_replaces_the_age_gate(self):
        with patch("votes.eligibility.model_has_voting_member_field", return_value=True):
            set_attested(self.member, None)
            set_attested(self.circle_admin, None)
            self.assertFalse(is_voting_member(self.member))
            self.assertEqual(not_voting_member_detail(), ATTESTED_GATE_DETAIL)
            denied = self.create(self.circle_admin, circle_ids=[self.young.id])
            self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(denied.data["detail"], ATTESTED_GATE_DETAIL)
            listing = self.client.get(reverse("ballot-list"))
            self.assertEqual(listing.data, {"open": [], "closed": []})

            set_attested(self.circle_admin, timezone.now())
            set_attested(self.member, timezone.now())
            set_attested(self.youth, timezone.now())
            self.assertTrue(is_voting_member(self.youth))
            created = self.create(self.circle_admin, circle_ids=[self.young.id])
            self.assertEqual(created.status_code, status.HTTP_201_CREATED)
            self.client.force_authenticate(self.member)
            voted = self.client.post(
                reverse("ballot-vote", args=[created.data["id"]]),
                {"choice_id": created.data["choices"][0]["id"]},
                format="json",
            )
            self.assertEqual(voted.status_code, status.HTTP_201_CREATED)

    def test_age_gate_is_only_the_fallback_when_the_column_is_absent(self):
        with patch("votes.eligibility.model_has_voting_member_field", return_value=False):
            self.assertEqual(not_voting_member_detail(), "Voting is for adults 18 and older.")
            set_attested(self.circle_admin, None)
            set_attested(self.member, None)
            self.assertTrue(is_voting_member(self.member))
            self.assertFalse(is_voting_member(self.youth))
            self.assertFalse(is_voting_member(self.no_dob))
            birthday = make_user("eighteen", self.church, dob=years_ago(18), first_name="Eighteen")
            set_attested(birthday, None)
            self.assertTrue(is_voting_member(birthday))
            denied = self.create(self.youth, circle_ids=[self.young.id])
            self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(denied.data["detail"], "Voting is for adults 18 and older.")
            created = self.create(self.circle_admin, circle_ids=[self.young.id])
            self.assertEqual(created.status_code, status.HTTP_201_CREATED)

    @override_settings(REST_FRAMEWORK={"DEFAULT_THROTTLE_RATES": {"ballot_create": "2/min"}})
    def test_creating_ballots_is_rate_limited(self):
        cache.clear()
        codes = [
            self.create(
                self.circle_admin, circle_ids=[self.young.id], title=f"Budget {index}"
            ).status_code
            for index in range(3)
        ]
        self.assertEqual(codes, [201, 201, 429])
        self.assertEqual(self.client.get(reverse("ballot-list")).status_code, status.HTTP_200_OK)
