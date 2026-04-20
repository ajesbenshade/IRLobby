from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import Activity
from users.models import User

from .models import AbuseReport, BlockedUser


class BlockUserTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="blocker", email="blocker@example.com", password="password123"
        )
        self.target = User.objects.create_user(
            username="target", email="target@example.com", password="password123"
        )

    def test_block_user(self):
        self.client.force_authenticate(self.user)
        url = reverse("block-user", args=[self.target.id])
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(BlockedUser.objects.filter(blocker=self.user, blocked=self.target).exists())

    def test_cannot_block_self(self):
        self.client.force_authenticate(self.user)
        url = reverse("block-user", args=[self.user.id])
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_block_returns_200(self):
        BlockedUser.objects.create(blocker=self.user, blocked=self.target)

        self.client.force_authenticate(self.user)
        url = reverse("block-user", args=[self.target.id])
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unblock_user(self):
        BlockedUser.objects.create(blocker=self.user, blocked=self.target)

        self.client.force_authenticate(self.user)
        url = reverse("unblock-user", args=[self.target.id])
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            BlockedUser.objects.filter(blocker=self.user, blocked=self.target).exists()
        )

    def test_unblock_nonexistent_returns_404(self):
        self.client.force_authenticate(self.user)
        url = reverse("unblock-user", args=[self.target.id])
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_blocked_list_returns_only_own_blocks(self):
        BlockedUser.objects.create(blocker=self.user, blocked=self.target)

        other = User.objects.create_user(
            username="other-blocker", email="ob@example.com", password="password123"
        )
        third = User.objects.create_user(
            username="third", email="third@example.com", password="password123"
        )
        BlockedUser.objects.create(blocker=other, blocked=third)

        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("blocked-list"))

        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        self.assertEqual(len(results), 1)

    def test_block_nonexistent_user_returns_404(self):
        self.client.force_authenticate(self.user)
        url = reverse("block-user", args=[99999])
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class AbuseReportTests(APITestCase):
    def setUp(self):
        self.reporter = User.objects.create_user(
            username="reporter", email="reporter@example.com", password="password123"
        )
        self.reported = User.objects.create_user(
            username="reported", email="reported@example.com", password="password123"
        )

    def test_create_abuse_report(self):
        self.client.force_authenticate(self.reporter)
        response = self.client.post(
            reverse("abuse-report"),
            {
                "reported_user": self.reported.id,
                "reason": "harassment",
                "description": "Sent threatening messages",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        report = AbuseReport.objects.get(reporter=self.reporter)
        self.assertEqual(report.reason, "harassment")
        self.assertEqual(report.status, "pending")

    def test_abuse_report_description_sanitized(self):
        self.client.force_authenticate(self.reporter)
        response = self.client.post(
            reverse("abuse-report"),
            {
                "reported_user": self.reported.id,
                "reason": "spam",
                "description": '<script>alert("xss")</script>Bad behavior',
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        report = AbuseReport.objects.get(reporter=self.reporter)
        self.assertNotIn("<script>", report.description)
        self.assertIn("Bad behavior", report.description)

    def test_unauthenticated_cannot_report(self):
        response = self.client.post(
            reverse("abuse-report"),
            {
                "reported_user": self.reported.id,
                "reason": "spam",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class BlockedUserActivityFilterTests(APITestCase):
    """Integration test: blocked users' activities are excluded from discovery."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="discover-user", email="discover@example.com", password="password123"
        )
        self.blocked_host = User.objects.create_user(
            username="blocked-host", email="blocked-host@example.com", password="password123"
        )
        self.normal_host = User.objects.create_user(
            username="normal-host", email="normal-host@example.com", password="password123"
        )
        Activity.objects.create(
            host=self.blocked_host,
            is_approved=True,
            title="Blocked Activity",
            description="Should be hidden",
            location="Location",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() + timedelta(days=1),
            capacity=10,
            tags=[],
            images=[],
        )
        Activity.objects.create(
            host=self.normal_host,
            is_approved=True,
            title="Normal Activity",
            description="Should be visible",
            location="Location",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() + timedelta(days=1),
            capacity=10,
            tags=[],
            images=[],
        )
        BlockedUser.objects.create(blocker=self.user, blocked=self.blocked_host)

    def test_blocked_host_activities_hidden_from_list(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("activity-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        titles = [a["title"] for a in results]
        self.assertNotIn("Blocked Activity", titles)
        self.assertIn("Normal Activity", titles)
