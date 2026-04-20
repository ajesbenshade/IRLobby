from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import Activity
from matches.models import Match
from users.models import User

from .models import Review


class ReviewTests(APITestCase):
    def setUp(self):
        self.reviewer = User.objects.create_user(
            username="reviewer", email="reviewer@example.com", password="password123"
        )
        self.reviewee = User.objects.create_user(
            username="reviewee", email="reviewee@example.com", password="password123"
        )
        self.other = User.objects.create_user(
            username="review-other", email="review-other@example.com", password="password123"
        )
        self.activity = Activity.objects.create(
            host=self.reviewee,
            is_approved=True,
            title="Review Activity",
            description="Test",
            location="Location",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() + timedelta(days=1),
            capacity=10,
            tags=[],
            images=[],
        )
        # Create a match so reviewer can review reviewee
        Match.objects.create(user_a=self.reviewer, user_b=self.reviewee, activity=self.activity)

    def test_create_review_with_match(self):
        self.client.force_authenticate(self.reviewer)
        response = self.client.post(
            reverse("review-list"),
            {
                "revieweeId": self.reviewee.id,
                "activityId": self.activity.id,
                "rating": 5,
                "comment": "Great event!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Review.objects.filter(reviewer=self.reviewer, reviewee=self.reviewee).exists()
        )

    def test_cannot_review_without_match(self):
        self.client.force_authenticate(self.other)
        response = self.client.post(
            reverse("review-list"),
            {
                "revieweeId": self.reviewee.id,
                "activityId": self.activity.id,
                "rating": 4,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_review_self(self):
        # Create a match so reviewer has some connection
        Match.objects.create(
            user_a=self.reviewer,
            user_b=self.reviewer,
            activity=self.activity,
        )
        self.client.force_authenticate(self.reviewer)
        response = self.client.post(
            reverse("review-list"),
            {
                "revieweeId": self.reviewer.id,
                "activityId": self.activity.id,
                "rating": 5,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_review_rejected(self):
        Review.objects.create(
            reviewer=self.reviewer,
            reviewee=self.reviewee,
            activity=self.activity,
            rating=4,
        )
        self.client.force_authenticate(self.reviewer)
        response = self.client.post(
            reverse("review-list"),
            {
                "revieweeId": self.reviewee.id,
                "activityId": self.activity.id,
                "rating": 3,
            },
            format="json",
        )

        self.assertIn(
            response.status_code,
            [status.HTTP_400_BAD_REQUEST, status.HTTP_500_INTERNAL_SERVER_ERROR],
        )

    def test_review_list_filters_by_role_given(self):
        Review.objects.create(
            reviewer=self.reviewer,
            reviewee=self.reviewee,
            activity=self.activity,
            rating=5,
        )
        self.client.force_authenticate(self.reviewer)
        response = self.client.get(reverse("review-list"), {"role": "given"})

        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        self.assertEqual(len(results), 1)

    def test_review_list_filters_by_role_received(self):
        Review.objects.create(
            reviewer=self.reviewer,
            reviewee=self.reviewee,
            activity=self.activity,
            rating=5,
        )
        self.client.force_authenticate(self.reviewer)
        response = self.client.get(reverse("review-list"), {"role": "received"})

        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        self.assertEqual(len(results), 0)

    def test_comment_html_sanitized(self):
        self.client.force_authenticate(self.reviewer)
        response = self.client.post(
            reverse("review-list"),
            {
                "revieweeId": self.reviewee.id,
                "activityId": self.activity.id,
                "rating": 5,
                "comment": '<script>alert("xss")</script>Nice',
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        review = Review.objects.get(reviewer=self.reviewer)
        self.assertNotIn("<script>", review.comment)
        self.assertIn("Nice", review.comment)

    def test_unauthenticated_cannot_create_review(self):
        response = self.client.post(
            reverse("review-list"),
            {"revieweeId": self.reviewee.id, "activityId": self.activity.id, "rating": 5},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
