from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest import skipUnless
from unittest.mock import patch

from django.core.cache import cache
from django.db import close_old_connections, connection, connections
from django.shortcuts import get_object_or_404
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase, APITransactionTestCase

from activities.models import Activity, Ticket, TicketRedemptionLog
from users.models import User


class TicketFixture:
    def setUp(self):
        super().setUp()
        cache.clear()
        self.host = User.objects.create_user(
            username="integrity-host",
            email="integrity-host@example.com",
            password="test-password",
            stripe_connect_account_id="acct_integrity_host",
            stripe_connect_payouts_enabled=True,
            stripe_connect_details_submitted=True,
        )
        self.buyer = User.objects.create_user(
            username="integrity-buyer",
            email="integrity-buyer@example.com",
            password="test-password",
        )
        self.activity = Activity.objects.create(
            host=self.host,
            title="Ticket integrity event",
            description="A ticketed activity.",
            location="Community Center",
            latitude=40.0,
            longitude=-74.0,
            time=timezone.now() + timedelta(days=3),
            capacity=5,
            is_approved=True,
            is_ticketed=True,
            ticket_price=25,
            max_tickets=5,
        )
        self.ticket = Ticket.objects.create(
            buyer=self.buyer,
            activity=self.activity,
            stripe_session_id="cs_integrity",
            status="pending",
        )
        self.scan_url = reverse("ticket-validate", args=[self.ticket.ticket_id])
        self.scan_payload = {"ticketToken": self.ticket.get_qr_token()}


@override_settings(ENABLE_TICKETING=True, STRIPE_WEBHOOK_SECRET="whsec_integrity")
class TicketIntegrityTests(TicketFixture, APITestCase):
    def deliver_payment(self, event_type="checkout.session.completed", session_id="cs_integrity"):
        with patch("activities.views.stripe.Webhook.construct_event") as construct_event:
            construct_event.return_value = {
                "type": event_type,
                "data": {
                    "object": {
                        "id": session_id,
                        "payment_status": "paid",
                        "metadata": {"ticket_id": str(self.ticket.ticket_id)},
                        "payment_intent": "pi_integrity",
                    }
                },
            }
            return self.client.post(
                reverse("stripe-webhook"), {}, format="json", HTTP_STRIPE_SIGNATURE="sig"
            )

    @patch("activities.tasks.generate_ticket_qr_code.delay")
    def test_duplicate_payment_counts_sale_and_queues_qr_once(self, generate_qr):
        self.assertEqual(self.deliver_payment().status_code, 200)
        self.ticket.refresh_from_db()
        purchased_at = self.ticket.purchased_at
        self.assertEqual(
            self.deliver_payment("checkout.session.async_payment_succeeded").status_code, 200
        )
        self.ticket.refresh_from_db()
        self.activity.refresh_from_db()
        self.assertEqual(self.ticket.status, "paid")
        self.assertEqual(self.ticket.purchased_at, purchased_at)
        self.assertEqual(self.activity.tickets_sold, 1)
        generate_qr.assert_called_once_with(self.ticket.id)

    @patch("activities.tasks.generate_ticket_qr_code.delay")
    def test_payment_replays_cannot_reopen_redeemed_ticket(self, generate_qr):
        self.assertEqual(self.deliver_payment().status_code, 200)
        self.client.force_authenticate(self.host)
        self.assertEqual(self.client.post(self.scan_url, self.scan_payload).status_code, 200)
        self.ticket.refresh_from_db()
        purchased_at = self.ticket.purchased_at
        redeemed_at = self.ticket.redeemed_at

        for event_type in (
            "checkout.session.completed",
            "checkout.session.async_payment_succeeded",
        ):
            # Exercise both lookup by session ID and fallback to ticket metadata.
            for session_id in ("cs_integrity", "cs_metadata_fallback"):
                with self.subTest(event_type=event_type, session_id=session_id):
                    self.assertEqual(self.deliver_payment(event_type, session_id).status_code, 200)
                    self.ticket.refresh_from_db()
                    self.activity.refresh_from_db()
                    self.assertEqual(self.ticket.status, "used")
                    self.assertEqual(self.ticket.purchased_at, purchased_at)
                    self.assertEqual(self.ticket.redeemed_at, redeemed_at)
                    self.assertEqual(self.ticket.stripe_payment_intent_id, "pi_integrity")
                    self.assertEqual(self.activity.tickets_sold, 1)

        generate_qr.assert_called_once_with(self.ticket.id)
        response = self.client.post(self.scan_url, self.scan_payload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["message"], "Ticket has already been used.")
        self.assertEqual(
            TicketRedemptionLog.objects.filter(ticket=self.ticket, successful=True).count(), 1
        )

    def test_failed_audit_write_rolls_back_redemption(self):
        self.ticket.status = "paid"
        self.ticket.save(update_fields=["status"])
        self.client.force_authenticate(self.host)
        with patch(
            "activities.views.TicketRedemptionLog.objects.create",
            side_effect=RuntimeError("audit unavailable"),
        ):
            with self.assertRaisesMessage(RuntimeError, "audit unavailable"):
                self.client.post(self.scan_url, self.scan_payload)

        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, "paid")
        self.assertIsNone(self.ticket.redeemed_at)
        self.assertFalse(TicketRedemptionLog.objects.filter(ticket=self.ticket).exists())
        self.assertEqual(self.client.post(self.scan_url, self.scan_payload).status_code, 200)

    def test_host_cannot_override_sold_count_when_editing(self):
        self.activity.tickets_sold = 2
        self.activity.save(update_fields=["tickets_sold"])
        self.client.force_authenticate(self.host)
        for field in ("tickets_sold", "ticketsSold"):
            with self.subTest(field=field):
                response = self.client.patch(
                    reverse("activity-detail", args=[self.activity.id]),
                    {field: 0, "title": "Updated event"},
                    format="json",
                )
                self.assertEqual(response.status_code, 200)
                self.activity.refresh_from_db()
                self.assertEqual(self.activity.title, "Updated event")
                self.assertEqual(self.activity.tickets_sold, 2)
                self.assertEqual(response.data["tickets_sold"], 2)
                self.assertEqual(response.data["ticketsSold"], 2)
                self.assertEqual(response.data["ticketsAvailable"], 3)

    def test_host_cannot_seed_sold_count_when_creating(self):
        self.client.force_authenticate(self.host)
        response = self.client.post(
            reverse("activity-list"),
            {
                "title": "New ticketed event",
                "description": "A new event.",
                "location": "Community Center",
                "latitude": 40.0,
                "longitude": -74.0,
                "time": self.activity.time.isoformat(),
                "capacity": 5,
                "is_ticketed": True,
                "ticket_price": "25.00",
                "max_tickets": 5,
                "tickets_sold": 5,
                "ticketsSold": 5,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Activity.objects.get(pk=response.data["id"]).tickets_sold, 0)
        self.assertEqual(response.data["ticketsAvailable"], 5)


@skipUnless(connection.vendor == "postgresql", "Concurrent row locking requires PostgreSQL")
@override_settings(ENABLE_TICKETING=True)
class ConcurrentTicketRedemptionTests(TicketFixture, APITransactionTestCase):
    def test_simultaneous_scans_admit_only_once(self):
        self.ticket.status = "paid"
        self.ticket.save(update_fields=["status"])
        start = Barrier(2, timeout=10)

        def synchronized_lookup(*args, **kwargs):
            start.wait()
            return get_object_or_404(*args, **kwargs)

        def scan():
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(self.host)
                return client.post(self.scan_url, self.scan_payload)
            finally:
                connections.close_all()

        with patch("activities.views.get_object_or_404", side_effect=synchronized_lookup):
            with ThreadPoolExecutor(max_workers=2) as executor:
                responses = list(executor.map(lambda _: scan(), range(2)))

        self.assertEqual(sorted(response.status_code for response in responses), [200, 400])
        rejected = next(response for response in responses if response.status_code == 400)
        self.assertEqual(rejected.data["message"], "Ticket has already been used.")
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, "used")
        self.assertIsNotNone(self.ticket.redeemed_at)
        logs = TicketRedemptionLog.objects.filter(ticket=self.ticket)
        self.assertEqual(logs.filter(successful=True).count(), 1)
        self.assertEqual(logs.filter(successful=False).count(), 1)
