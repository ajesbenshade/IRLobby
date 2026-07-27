from datetime import timedelta
from unittest import skipUnless
from unittest.mock import patch

from django.db import connection
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import Activity, ActivityParticipant, Ticket, TicketRedemptionLog
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


@skipUnless(connection.vendor == "postgresql", "PostGIS distance lookups require PostgreSQL")
class ActivityLocationQueryTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="location-user",
            email="location-user@example.com",
            password="password123",
        )
        self.host = User.objects.create_user(
            username="location-host",
            email="location-host@example.com",
            password="password123",
        )
        self.nearest = Activity.objects.create(
            host=self.host,
            is_approved=True,
            title="Nearest Rooftop",
            description="Close to the search origin.",
            location="Lower Manhattan",
            latitude=40.7130,
            longitude=-74.0062,
            time=timezone.now() + timedelta(days=1),
            capacity=5,
            tags=["rooftop"],
            images=[],
        )
        self.nearby = Activity.objects.create(
            host=self.host,
            is_approved=True,
            title="Nearby Gallery Walk",
            description="Still inside the search radius.",
            location="Brooklyn",
            latitude=40.6782,
            longitude=-73.9442,
            time=timezone.now() + timedelta(days=1),
            capacity=5,
            tags=["art"],
            images=[],
        )
        self.far = Activity.objects.create(
            host=self.host,
            is_approved=True,
            title="Far Beach Day",
            description="Outside the search radius.",
            location="Los Angeles",
            latitude=34.0522,
            longitude=-118.2437,
            time=timezone.now() + timedelta(days=1),
            capacity=5,
            tags=["outdoors"],
            images=[],
        )

    def _result_ids(self, response):
        results = response.data if isinstance(response.data, list) else response.data["results"]
        return [item["id"] for item in results]

    def test_location_query_returns_nearby_activities_in_distance_order(self):
        self.client.force_authenticate(self.user)

        response = self.client.get(
            reverse("activity-list"),
            {"latitude": 40.7128, "longitude": -74.0060, "radius": 10},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = self._result_ids(response)
        self.assertEqual(ids[:2], [self.nearest.id, self.nearby.id])
        self.assertNotIn(self.far.id, ids)

    def test_location_query_cache_does_not_change_results(self):
        self.client.force_authenticate(self.user)
        params = {"latitude": 40.7128, "longitude": -74.0060, "radius": 10}

        first_response = self.client.get(reverse("activity-list"), params)
        second_response = self.client.get(reverse("activity-list"), params)

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._result_ids(first_response), self._result_ids(second_response))

    def test_invalid_location_query_falls_back_to_standard_results(self):
        self.client.force_authenticate(self.user)

        response = self.client.get(
            reverse("activity-list"),
            {"latitude": "not-a-lat", "longitude": -74.0060, "radius": "nearby"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = self._result_ids(response)
        self.assertIn(self.nearest.id, ids)
        self.assertIn(self.far.id, ids)


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
            platform_fee_percent=10,
        )
        self.host.stripe_connect_account_id = "acct_test_host"
        self.host.stripe_connect_payouts_enabled = True
        self.host.stripe_connect_details_submitted = True
        self.host.save(
            update_fields=[
                "stripe_connect_account_id",
                "stripe_connect_payouts_enabled",
                "stripe_connect_details_submitted",
            ]
        )

    @patch("activities.views.stripe.checkout.Session.create")
    def test_create_ticket_checkout_session(self, mock_session_create):
        mock_session_create.return_value = {
            "id": "cs_test_123",
            "url": "https://checkout.stripe.com/c/pay/cs_test_123",
        }

        self.client.force_authenticate(self.buyer)
        url = reverse("activity-ticket-buy", args=[self.activity.id])
        response = self.client.post(url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["session_id"], "cs_test_123")
        self.assertEqual(response.data["url"], "https://checkout.stripe.com/c/pay/cs_test_123")
        ticket = Ticket.objects.get(activity=self.activity, buyer=self.buyer)
        self.assertEqual(ticket.status, "pending")
        self.assertEqual(ticket.stripe_session_id, "cs_test_123")

        kwargs = mock_session_create.call_args.kwargs
        self.assertNotIn("payment_method_types", kwargs)
        self.assertEqual(
            kwargs["payment_intent_data"]["transfer_data"]["destination"],
            "acct_test_host",
        )
        # $25 ticket * 10% = $2.50 = 250 cents
        self.assertEqual(kwargs["payment_intent_data"]["application_fee_amount"], 250)

    def test_cannot_buy_when_host_not_connected(self):
        self.host.stripe_connect_payouts_enabled = False
        self.host.save(update_fields=["stripe_connect_payouts_enabled"])

        self.client.force_authenticate(self.buyer)
        response = self.client.post(reverse("activity-ticket-buy", args=[self.activity.id]))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("payout setup", response.data.get("message", "").lower())

    def test_cannot_buy_non_ticketed_activity(self):
        self.activity.is_ticketed = False
        self.activity.save()

        self.client.force_authenticate(self.buyer)
        url = reverse("activity-ticket-buy", args=[self.activity.id])
        response = self.client.post(url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("message"), "This activity is not ticketed.")

    def test_cannot_buy_sold_out_activity(self):
        self.activity.tickets_sold = self.activity.max_tickets
        self.activity.save(update_fields=["tickets_sold"])

        self.client.force_authenticate(self.buyer)
        response = self.client.post(reverse("activity-ticket-buy", args=[self.activity.id]))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("message"), "Tickets are sold out.")

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
        self.assertTrue(
            TicketRedemptionLog.objects.filter(
                ticket=ticket,
                host=self.host,
                successful=True,
                status="used",
            ).exists()
        )

    def test_validate_ticket_rejects_malformed_qr_token(self):
        ticket = Ticket.objects.create(
            buyer=self.buyer,
            activity=self.activity,
            status="paid",
            stripe_session_id="cs_test_123",
        )

        self.client.force_authenticate(self.host)
        response = self.client.post(
            reverse("ticket-validate", args=[ticket.ticket_id]),
            data={"ticketToken": "not-a-signed-ticket"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("message"), "Invalid ticket token.")
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, "paid")

    def test_validate_ticket_rejects_identifier_mismatch(self):
        first_ticket = Ticket.objects.create(
            buyer=self.buyer,
            activity=self.activity,
            status="paid",
            stripe_session_id="cs_test_123",
        )
        second_ticket = Ticket.objects.create(
            buyer=self.buyer,
            activity=self.activity,
            status="paid",
            stripe_session_id="cs_test_456",
        )

        self.client.force_authenticate(self.host)
        response = self.client.post(
            reverse("ticket-validate", args=[second_ticket.ticket_id]),
            data={"ticketToken": first_ticket.get_qr_token()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("message"), "Ticket identifier mismatch.")

    def test_validate_ticket_rejects_pending_ticket_and_logs_failure(self):
        ticket = Ticket.objects.create(
            buyer=self.buyer,
            activity=self.activity,
            status="pending",
            stripe_session_id="cs_test_123",
        )

        self.client.force_authenticate(self.host)
        response = self.client.post(
            reverse("ticket-validate", args=[ticket.ticket_id]),
            data={"ticketToken": ticket.get_qr_token()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("message"), "Ticket is not valid for redemption.")
        self.assertTrue(
            TicketRedemptionLog.objects.filter(
                ticket=ticket,
                host=self.host,
                successful=False,
                status="pending",
            ).exists()
        )

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
