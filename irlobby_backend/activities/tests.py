from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import Activity, ActivityParticipant, Ticket
from users.models import User


class ActivityPermissionsTests(APITestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            username="host-user",
            email="host@example.com",
            password="password123",
        )
        self.other = User.objects.create_user(
            username="other-user",
            email="other@example.com",
            password="password123",
        )
        self.activity = Activity.objects.create(
            host=self.host,
            is_approved=True,
            title="Board Game Night",
            description="Play all the games.",
            location="Community Center",
            latitude=10.0,
            longitude=20.0,
            time=timezone.now() + timedelta(days=1),
            capacity=5,
            tags=[],
            images=[],
        )
        self.url = reverse("activity-detail", args=[self.activity.id])

    def test_host_can_update_activity(self):
        self.client.force_authenticate(self.host)
        response = self.client.patch(self.url, {"title": "Updated Title"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.activity.refresh_from_db()
        self.assertEqual(self.activity.title, "Updated Title")

    def test_non_host_cannot_update_activity(self):
        self.client.force_authenticate(self.other)
        response = self.client.patch(self.url, {"title": "Hacked Title"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.activity.refresh_from_db()
        self.assertEqual(self.activity.title, "Board Game Night")

    def test_non_host_cannot_delete_activity(self):
        self.client.force_authenticate(self.other)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Activity.objects.filter(id=self.activity.id).exists())


class ActivityApprovalWorkflowTests(APITestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            username="approval-host",
            email="approval-host@example.com",
            password="password123",
        )
        self.other = User.objects.create_user(
            username="approval-other",
            email="approval-other@example.com",
            password="password123",
        )

    def test_new_activity_requires_approval_by_default(self):
        self.client.force_authenticate(self.host)
        url = reverse("activity-list")
        payload = {
            "title": "Pending Approval Event",
            "description": "Needs approval first.",
            "location": "Central Park",
            "latitude": 40.7812,
            "longitude": -73.9665,
            "time": (timezone.now() + timedelta(days=2)).isoformat(),
            "capacity": 10,
            "tags": [],
            "images": [],
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Activity.objects.get(id=response.data["id"])
        self.assertFalse(created.is_approved)

    def test_unapproved_activity_hidden_from_non_host(self):
        activity = Activity.objects.create(
            host=self.host,
            title="Hidden Pending Event",
            description="Pending moderation",
            location="Library",
            latitude=51.5,
            longitude=-0.1,
            time=timezone.now() + timedelta(days=1),
            capacity=4,
            tags=[],
            images=[],
        )

        self.client.force_authenticate(self.other)
        list_response = self.client.get(reverse("activity-list"))
        detail_response = self.client.get(reverse("activity-detail", args=[activity.id]))

        items = (
            list_response.data
            if isinstance(list_response.data, list)
            else list_response.data.get("results", [])
        )
        ids = [item["id"] for item in items]
        self.assertNotIn(activity.id, ids)
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_create_activity_with_capacity_above_ten(self):
        self.client.force_authenticate(self.host)
        url = reverse("activity-list")
        payload = {
            "title": "Too Large Event",
            "description": "Should fail validation.",
            "location": "Stadium",
            "latitude": 40.0,
            "longitude": -74.0,
            "time": (timezone.now() + timedelta(days=3)).isoformat(),
            "capacity": 11,
            "tags": [],
            "images": [],
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("capacity", response.data)

    def test_join_rejected_when_activity_full(self):
        activity = Activity.objects.create(
            host=self.host,
            is_approved=True,
            title="Full Event",
            description="Already at capacity",
            location="Cafe",
            latitude=35.0,
            longitude=-120.0,
            time=timezone.now() + timedelta(days=1),
            capacity=10,
            tags=[],
            images=[],
        )

        for index in range(10):
            participant_user = User.objects.create_user(
                username=f"confirmed-{index}",
                email=f"confirmed-{index}@example.com",
                password="password123",
            )
            ActivityParticipant.objects.create(
                activity=activity,
                user=participant_user,
                status="confirmed",
            )

        self.client.force_authenticate(self.other)
        response = self.client.post(reverse("join-activity", args=[activity.id]))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("message"), "Activity is full")


class TicketingTests(APITestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            username="ticket-host",
            email="ticket-host@example.com",
            password="password123",
        )
        self.buyer = User.objects.create_user(
            username="ticket-buyer",
            email="ticket-buyer@example.com",
            password="password123",
        )
        self.activity = Activity.objects.create(
            host=self.host,
            is_approved=True,
            title="Paid Event",
            description="Ticketed event.",
            location="Venue",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() + timedelta(days=3),
            capacity=10,
            tags=[],
            images=[],
            is_ticketed=True,
            ticket_price=25.00,
            max_tickets=3,
        )

    @patch("activities.views.stripe.checkout.Session.create")
    def test_create_ticket_checkout_session(self, mock_session_create):
        mock_session_create.return_value = {"id": "cs_test_123"}

        self.client.force_authenticate(self.buyer)
        url = reverse("activity-ticket-buy", args=[self.activity.id])
        response = self.client.post(url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["session_id"], "cs_test_123")
        ticket = Ticket.objects.get(activity=self.activity, buyer=self.buyer)
        self.assertEqual(ticket.status, "pending")
        self.assertEqual(ticket.stripe_session_id, "cs_test_123")

    def test_cannot_buy_non_ticketed_activity(self):
        self.activity.is_ticketed = False
        self.activity.save()

        self.client.force_authenticate(self.buyer)
        url = reverse("activity-ticket-buy", args=[self.activity.id])
        response = self.client.post(url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("message"), "This activity is not ticketed.")

    @patch("activities.views.stripe.Webhook.construct_event")
    def test_webhook_marks_ticket_paid_and_generates_qr(self, mock_construct_event):
        ticket = Ticket.objects.create(
            buyer=self.buyer,
            activity=self.activity,
            status="pending",
            stripe_session_id="cs_test_123",
        )

        mock_construct_event.return_value = {
            "type": "checkout.session.completed",
            "data": {"object": {"id": "cs_test_123"}},
        }

        response = self.client.post(
            reverse("stripe-webhook"),
            data={},
            format="json",
            HTTP_STRIPE_SIGNATURE="sig",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, "paid")
        self.assertIsNotNone(ticket.purchased_at)

    @patch("activities.views.stripe.Webhook.construct_event")
    def test_webhook_falls_back_to_ticket_id_metadata(self, mock_construct_event):
        ticket = Ticket.objects.create(
            buyer=self.buyer,
            activity=self.activity,
            status="pending",
            stripe_session_id=None,
        )

        mock_construct_event.return_value = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "missing_session",
                    "metadata": {"ticket_id": str(ticket.ticket_id)},
                    "payment_intent": "pi_test_456",
                }
            },
        }

        response = self.client.post(
            reverse("stripe-webhook"),
            data={},
            format="json",
            HTTP_STRIPE_SIGNATURE="sig",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, "paid")
        self.assertEqual(ticket.stripe_payment_intent_id, "pi_test_456")

    def test_my_tickets_returns_only_user_tickets(self):
        Ticket.objects.create(
            buyer=self.buyer,
            activity=self.activity,
            status="paid",
            stripe_session_id="cs_test_123",
        )
        Ticket.objects.create(
            buyer=self.host,
            activity=self.activity,
            status="paid",
            stripe_session_id="cs_test_456",
        )

        self.client.force_authenticate(self.buyer)
        response = self.client.get(reverse("ticket-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = (
            response.data if isinstance(response.data, list) else response.data.get("results", [])
        )
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["activityId"], self.activity.id)

    def test_validate_ticket_marks_used_and_reports_attendee(self):
        ticket = Ticket.objects.create(
            buyer=self.buyer,
            activity=self.activity,
            status="paid",
            stripe_session_id="cs_test_123",
        )
        token = ticket.get_qr_token()

        self.client.force_authenticate(self.host)
        response = self.client.post(
            reverse("ticket-validate", args=[ticket.ticket_id]),
            data={"ticketToken": token},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, "used")
        self.assertEqual(response.data["buyer_username"], self.buyer.username)

    def test_duplicate_validate_ticket_fails(self):
        ticket = Ticket.objects.create(
            buyer=self.buyer,
            activity=self.activity,
            status="used",
            stripe_session_id="cs_test_123",
        )
        token = ticket.get_qr_token()

        self.client.force_authenticate(self.host)
        response = self.client.post(
            reverse("ticket-validate", args=[ticket.ticket_id]),
            data={"ticketToken": token},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("message"), "Ticket has already been used.")

    def test_non_host_cannot_validate_ticket(self):
        ticket = Ticket.objects.create(
            buyer=self.buyer,
            activity=self.activity,
            status="paid",
            stripe_session_id="cs_test_123",
        )
        token = ticket.get_qr_token()

        self.client.force_authenticate(self.buyer)
        response = self.client.post(
            reverse("ticket-validate", args=[ticket.ticket_id]),
            data={"ticketToken": token},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
