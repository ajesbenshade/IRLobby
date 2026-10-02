"""The second App Review account: friend, 1:1 chat, and join requests on both sides."""

import os
from unittest.mock import patch

from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import Activity, ActivityParticipant
from chat.models import Conversation, ConversationUserState
from matches.models import Match
from users.models import Friendship, User

PW = "Review-pass-123"


def seed(**options):
    call_command("seed_review_account", password=PW, **options)


class SeedSecondReviewAccountTests(APITestCase):
    def accounts(self):
        return (
            User.objects.get(email="app-review@irlobby.com"),
            User.objects.get(email="app-review2@irlobby.com"),
        )

    def test_second_account_shares_the_first_password_by_default(self):
        seed()
        one, two = self.accounts()
        self.assertEqual(two.username, "app_review2")
        self.assertTrue(two.check_password(PW))
        self.assertTrue(two.is_active)
        self.assertTrue(two.preferences["app_review_account"])
        self.assertTrue(two.preferences["onboarding_completed"])
        self.assertIsNotNone(two.terms_accepted_at)
        self.assertIsNotNone(two.privacy_accepted_at)
        self.assertTrue(one.preferences["app_review_account"])

    def test_password2_option_and_env_var(self):
        seed(password2="Second-pass-456")
        one, two = self.accounts()
        self.assertTrue(one.check_password(PW))
        self.assertTrue(two.check_password("Second-pass-456"))
        with patch.dict(os.environ, {"REVIEW_ACCOUNT_PASSWORD2": "Env-pass-789"}):
            seed()
        one, two = self.accounts()
        self.assertTrue(two.check_password("Env-pass-789"))
        # The option wins over the environment.
        with patch.dict(os.environ, {"REVIEW_ACCOUNT_PASSWORD2": "Env-pass-789"}):
            seed(password2="Option-pass-1")
        self.assertTrue(self.accounts()[1].check_password("Option-pass-1"))

    def test_accepted_friendship_and_direct_chat(self):
        seed()
        one, two = self.accounts()
        friendship = Friendship.objects.get()
        self.assertEqual(friendship.status, "accepted")
        self.assertEqual({friendship.requester_id, friendship.recipient_id}, {one.id, two.id})

        match = Match.objects.get(activity__isnull=True)
        self.assertEqual({match.user_a_id, match.user_b_id}, {one.id, two.id})
        self.assertLess(match.user_a_id, match.user_b_id)
        conversation = Conversation.objects.get(match=match)
        senders = set(conversation.messages.values_list("sender_id", flat=True))
        self.assertEqual(senders, {one.id, two.id})
        self.assertGreaterEqual(conversation.messages.count(), 3)

        for user in (one, two):
            self.client.force_authenticate(user)
            response = self.client.get(reverse("direct-conversations"))
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(len(response.data["conversations"]), 1)
            row = response.data["conversations"][0]
            self.assertTrue(row["can_send"])
            self.assertIsNotNone(row["last_message"])

    def test_pending_requests_on_both_sides(self):
        seed()
        one, two = self.accounts()
        theirs = Activity.objects.get(requires_approval=True, host__username="review_sam")
        mine = Activity.objects.get(requires_approval=True, host=one)
        for activity in (theirs, mine):
            self.assertTrue(activity.is_approved)
            self.assertFalse(activity.is_cancelled)

        request_two = ActivityParticipant.objects.get(activity=theirs, user=two)
        self.assertEqual(request_two.status, "pending")
        self.assertIsNone(request_two.decided_at)

        pending_for_one = ActivityParticipant.objects.filter(activity=mine, status="pending")
        self.assertEqual([p.user.username for p in pending_for_one], ["review_priya"])
        self.assertIsNone(pending_for_one.get().decided_at)

        # The host really sees the request in the host list.
        self.client.force_authenticate(one)
        response = self.client.get(reverse("activity-requests", args=[mine.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["requests"]), 1)
        # And review account 2 can see it is waiting.
        self.client.force_authenticate(two)
        detail = self.client.get(reverse("activity-detail", args=[theirs.id]))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["my_request_status"], "pending")

    def test_rerun_is_idempotent_and_keeps_everything(self):
        seed()
        counts = lambda: (  # noqa: E731
            User.objects.count(),
            Activity.objects.count(),
            ActivityParticipant.objects.count(),
            ActivityParticipant.objects.filter(status="pending").count(),
            Friendship.objects.count(),
            Match.objects.count(),
            Match.objects.filter(activity__isnull=True).count(),
            Conversation.objects.count(),
            sum(c.messages.count() for c in Conversation.objects.all()),
            ConversationUserState.objects.count(),
        )
        first = counts()
        seed()
        seed(password2="Another-pass-1")
        self.assertEqual(counts(), first)
        one, two = self.accounts()
        self.assertTrue(two.check_password("Another-pass-1"))
        self.assertEqual(Friendship.objects.get().status, "accepted")
        self.assertEqual(Match.objects.filter(activity__isnull=True).count(), 1)
        # Every seeded gathering is still in the future after a re-run.
        self.assertFalse(Activity.objects.filter(time__lte=one.date_joined).exists())

    def test_reruns_survive_existing_direct_chat_and_friendship_rows(self):
        seed()
        one, two = self.accounts()
        # Someone flips the friendship around in the meantime; seeding restores it.
        Friendship.objects.all().delete()
        Friendship.objects.create(requester=two, recipient=one, status="declined")
        seed()
        friendship = Friendship.objects.get()
        self.assertEqual(friendship.status, "accepted")
