import logging
import time

import stripe
from django.conf import settings
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.core.cache import cache
from django.core.signing import BadSignature
from django.db import transaction
from django.db.models import Case, F, IntegerField, Q, Value, When
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from matches.models import Match
from moderation.models import BlockedUser

from .models import Activity, ActivityParticipant, Ticket, TicketRedemptionLog
from .permissions import IsHostOrReadOnly
from .serializers import (
    ActivitySerializer,
    TicketPurchaseSerializer,
    TicketSerializer,
    TicketValidationSerializer,
)
from .ticketing import ticketing_enabled

logger = logging.getLogger(__name__)


class ActivityListCreateView(generics.ListCreateAPIView):
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        started_at = time.monotonic()
        blocked_ids = BlockedUser.objects.filter(blocker=self.request.user).values_list(
            "blocked_id", flat=True
        )
        blocked_by_ids = BlockedUser.objects.filter(blocked=self.request.user).values_list(
            "blocker_id", flat=True
        )
        exclude_ids = set(blocked_ids) | set(blocked_by_ids)

        queryset = (
            Activity.objects.filter(Q(is_approved=True) | Q(host=self.request.user))
            .exclude(host_id__in=exclude_ids)
            .distinct()
        )

        if self.request.user.is_staff:
            queryset = Activity.objects.all()

        # Cancelled gatherings never show in the browse/swipe deck (detail, hosted and going
        # lists still return them).
        queryset = queryset.filter(is_cancelled=False)

        if not ticketing_enabled(self.request):
            queryset = queryset.filter(Q(is_ticketed=False) | Q(host=self.request.user))

        # Filter by location if provided
        latitude = self.request.query_params.get("latitude")
        longitude = self.request.query_params.get("longitude")
        radius = self.request.query_params.get("radius", 10)  # Default 10km radius

        ordered_by_distance = False

        # App Review devices can be anywhere; anchor the review account to its seeded
        # location so reviewers always see the demo content (see seed_review_account).
        user = self.request.user
        if (
            latitude
            and longitude
            and (user.preferences or {}).get("app_review_account")
            and user.latitude is not None
            and user.longitude is not None
        ):
            latitude, longitude = str(user.latitude), str(user.longitude)

        if latitude and longitude:
            try:
                radius_km = float(radius)
                point = Point(float(longitude), float(latitude), srid=4326)
            except (TypeError, ValueError):
                radius_km = None
                point = None

            if point and radius_km is not None:
                cache_key = (
                    "activities:nearby:v1:"
                    f"user:{self.request.user.id}:staff:{int(self.request.user.is_staff)}:"
                    f"lat:{point.y:.4f}:lon:{point.x:.4f}:radius:{radius_km:.1f}"
                )
                cache_hit = False
                nearby_ids = None

                try:
                    nearby_ids = cache.get(cache_key)
                    cache_hit = nearby_ids is not None
                except Exception as exc:
                    logger.warning(
                        "activity.nearby_cache_read_failed",
                        extra={"cache_key": cache_key, "error": str(exc)},
                    )

                if nearby_ids is None:
                    nearby_queryset = (
                        queryset.filter(location_point__isnull=False)
                        .annotate(distance=Distance("location_point", point))
                        .filter(location_point__distance_lte=(point, D(km=radius_km)))
                        .order_by("distance", "-created_at")
                    )
                    nearby_ids = list(nearby_queryset.values_list("id", flat=True)[:250])
                    try:
                        cache.set(
                            cache_key,
                            nearby_ids,
                            timeout=settings.ACTIVITY_NEARBY_CACHE_TTL_SECONDS,
                        )
                    except Exception as exc:
                        logger.warning(
                            "activity.nearby_cache_write_failed",
                            extra={"cache_key": cache_key, "error": str(exc)},
                        )

                if nearby_ids:
                    ordering = Case(
                        *[
                            When(id=activity_id, then=Value(index))
                            for index, activity_id in enumerate(nearby_ids)
                        ],
                        output_field=IntegerField(),
                    )
                    queryset = queryset.filter(id__in=nearby_ids).order_by(ordering)
                else:
                    queryset = queryset.none()
                ordered_by_distance = True

                logger.info(
                    "activity.nearby_query",
                    extra={
                        "user_id": self.request.user.id,
                        "radius_km": radius_km,
                        "result_count": len(nearby_ids),
                        "cache_hit": cache_hit,
                        "duration_ms": round((time.monotonic() - started_at) * 1000, 2),
                    },
                )

        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category__icontains=category)

        location = self.request.query_params.get("location")
        if location:
            queryset = queryset.filter(location__icontains=location)

        skill_level = self.request.query_params.get("skill_level")
        if skill_level:
            queryset = queryset.filter(skill_level__icontains=skill_level)

        visibility = self.request.query_params.get("visibility")
        if visibility:
            queryset = queryset.filter(visibility__icontains=visibility)

        price_min = self.request.query_params.get("price_min")
        if price_min is not None:
            try:
                queryset = queryset.filter(price__gte=float(price_min))
            except (TypeError, ValueError):
                pass

        price_max = self.request.query_params.get("price_max")
        if price_max is not None:
            try:
                queryset = queryset.filter(price__lte=float(price_max))
            except (TypeError, ValueError):
                pass

        date_from = self.request.query_params.get("date_from")
        if date_from:
            parsed_date_from = parse_datetime(date_from)
            if parsed_date_from is not None:
                queryset = queryset.filter(time__gte=parsed_date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            parsed_date_to = parse_datetime(date_to)
            if parsed_date_to is not None:
                queryset = queryset.filter(time__lte=parsed_date_to)

        tags = self.request.query_params.get("tags")
        if tags:
            normalized_tags = [tag.strip() for tag in tags.split(",") if tag.strip()]
            for tag in normalized_tags:
                queryset = queryset.filter(tags__icontains=tag)

        if ordered_by_distance:
            return queryset

        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(host=self.request.user)


class ActivityDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated, IsHostOrReadOnly]

    def get_queryset(self):
        queryset = Activity.objects.filter(
            Q(is_approved=True) | Q(host=self.request.user)
        ).distinct()

        if self.request.user.is_staff:
            return Activity.objects.all()

        return queryset


class HostedActivitiesView(generics.ListAPIView):
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Activity.objects.filter(host=self.request.user)


class TicketThrottle(UserRateThrottle):
    scope = "ticket_ops"


class ActivityTicketPurchaseView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [TicketThrottle]

    def post(self, request, pk):
        if not ticketing_enabled(request):
            return Response(
                {"detail": "Ticketing is not enabled."}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        activity = get_object_or_404(
            Activity.objects.filter(Q(is_approved=True) | Q(host=request.user)),
            pk=pk,
        )

        if activity.is_cancelled:
            return Response(
                {"message": "This gathering was cancelled by the host."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not activity.is_ticketed:
            return Response(
                {"message": "This activity is not ticketed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if activity.is_sold_out:
            return Response(
                {"message": "Tickets are sold out."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TicketPurchaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        host = activity.host
        from users.stripe_connect import (
            StripeConnectError,
            create_destination_checkout_session,
            host_can_receive_payouts,
        )

        if not host_can_receive_payouts(host):
            return Response(
                {
                    "message": "This host has not finished payout setup, so tickets cannot be purchased yet."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        success_url = serializer.validated_data.get("successUrl") or settings.STRIPE_SUCCESS_URL
        cancel_url = serializer.validated_data.get("cancelUrl") or settings.STRIPE_CANCEL_URL

        unit_amount = int(activity.ticket_price * 100)
        # Gatherings no longer take a platform cut, including leftover ticket checkout.
        fee_percent = 0
        application_fee_amount = 0
        if application_fee_amount < 0 or application_fee_amount >= unit_amount:
            return Response(
                {"message": "Invalid platform fee configuration for this ticket."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        ticket = None
        try:
            ticket = Ticket.objects.create(
                buyer=request.user,
                activity=activity,
                status="pending",
            )

            session = create_destination_checkout_session(
                activity=activity,
                ticket=ticket,
                host=host,
                success_url=success_url,
                cancel_url=cancel_url,
                application_fee_amount=application_fee_amount,
                fee_percent=fee_percent,
            )
            ticket.stripe_session_id = session["id"]
            ticket.save(update_fields=["stripe_session_id"])

            return Response(
                {
                    "session_id": session["id"],
                    "sessionId": session["id"],
                    "url": session.get("url"),
                    "checkoutUrl": session.get("url"),
                    "platformFeePercent": float(fee_percent),
                    "platformFeeAmountCents": application_fee_amount,
                },
                status=status.HTTP_201_CREATED,
            )
        except StripeConnectError as exc:
            if ticket is not None:
                ticket.status = "cancelled"
                ticket.save(update_fields=["status"])
            return Response({"message": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except stripe.error.StripeError as exc:
            if ticket is not None:
                ticket.status = "cancelled"
                ticket.save(update_fields=["status"])  # Keep the pending record for audit.
            return Response({"message": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


def _stripe_object_id(value):
    if isinstance(value, str) and value:
        return value
    if isinstance(value, dict):
        object_id = value.get("id")
        return object_id if isinstance(object_id, str) else None
    object_id = getattr(value, "id", None)
    return object_id if isinstance(object_id, str) else None


def _checkout_session_is_paid(session_data) -> bool:
    payment_status = session_data.get("payment_status")
    return payment_status in (None, "", "paid", "no_payment_required")


def _fulfill_paid_checkout_session(session_data) -> None:
    if not _checkout_session_is_paid(session_data):
        return

    stripe_session_id = session_data.get("id")
    ticket = Ticket.objects.filter(stripe_session_id=stripe_session_id).first()
    if not ticket:
        metadata = session_data.get("metadata", {}) or {}
        ticket_id = metadata.get("ticket_id")
        if ticket_id:
            ticket = Ticket.objects.filter(ticket_id=ticket_id).first()

    if not ticket:
        return

    with transaction.atomic():
        ticket = Ticket.objects.select_for_update().get(pk=ticket.pk)
        # A retry must not reopen a redeemed ticket or count its sale twice.
        if ticket.status in {"paid", "used"}:
            return
        ticket.status = "paid"
        ticket.purchased_at = timezone.now()
        ticket.stripe_payment_intent_id = _stripe_object_id(session_data.get("payment_intent"))
        ticket.save(update_fields=["status", "purchased_at", "stripe_payment_intent_id"])
        Activity.objects.filter(pk=ticket.activity_id).update(tickets_sold=F("tickets_sold") + 1)

    from .tasks import generate_ticket_qr_code

    generate_ticket_qr_code.delay(ticket.id)


class StripeWebhookView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.body
        signature = request.headers.get("Stripe-Signature", "")

        secrets = [
            s.strip()
            for s in (
                getattr(settings, "STRIPE_WEBHOOK_SECRET", "") or "",
                getattr(settings, "STRIPE_CONNECT_WEBHOOK_SECRET", "") or "",
            )
            if s and s.strip()
        ]
        if not secrets:
            logger.error("stripe.webhook_unconfigured")
            return Response(
                {"message": "Webhook signing secret is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not signature:
            return Response(
                {"message": "Invalid webhook payload."}, status=status.HTTP_400_BAD_REQUEST
            )

        event = None
        last_error = None
        for secret in secrets:
            try:
                event = stripe.Webhook.construct_event(payload, signature, secret)
                break
            except ValueError as exc:
                last_error = exc
                break
            except stripe.error.SignatureVerificationError as exc:
                last_error = exc
                continue
        if event is None:
            logger.warning("stripe.webhook_signature_rejected: %s", last_error)
            return Response(
                {"message": "Invalid webhook payload."}, status=status.HTTP_400_BAD_REQUEST
            )

        event_type = event["type"]
        if event_type in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
            _fulfill_paid_checkout_session(event["data"]["object"])

        elif event_type in {
            "account.updated",
            "v2.core.account.updated",
            "account.application.authorized",
        }:
            account_data = event["data"]["object"]
            account_id = account_data.get("id")
            if account_id:
                from users.models import User
                from users.stripe_connect import sync_connect_account_status

                host = User.objects.filter(stripe_connect_account_id=account_id).first()
                if host:
                    try:
                        sync_connect_account_status(host)
                    except Exception:  # noqa: BLE001
                        logger.exception(
                            "stripe.connect_status_sync_failed account_id=%s", account_id
                        )

        return Response({"success": True})


class UserTicketListView(generics.ListAPIView):
    serializer_class = TicketSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Ticket.objects.filter(buyer=self.request.user).order_by("-created_at")


class ValidateTicketView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [TicketThrottle]

    @transaction.atomic
    def post(self, request, ticket_id):
        if not ticketing_enabled(request):
            return Response(
                {"detail": "Ticketing is not enabled."}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        serializer = TicketValidationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ticket_token = serializer.validated_data["ticketToken"]
        try:
            ticket_uuid, activity_id = Ticket.parse_qr_token(ticket_token)
        except (BadSignature, ValueError):
            return Response(
                {"message": "Invalid ticket token."}, status=status.HTTP_400_BAD_REQUEST
            )

        if str(ticket_uuid) != str(ticket_id):
            return Response(
                {"message": "Ticket identifier mismatch."}, status=status.HTTP_400_BAD_REQUEST
            )

        # Serialize scans of this ticket, including its audit log. A competing
        # scan must see the committed "used" status before deciding to admit.
        ticket = get_object_or_404(
            Ticket.objects.select_for_update(), ticket_id=ticket_uuid, activity_id=activity_id
        )

        if ticket.activity.host_id != request.user.id:
            return Response(
                {"message": "Forbidden to validate this ticket."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if ticket.status == "used":
            TicketRedemptionLog.objects.create(
                ticket=ticket,
                activity=ticket.activity,
                host=request.user,
                successful=False,
                status=ticket.status,
                message="Ticket already used.",
            )
            return Response(
                {"message": "Ticket has already been used."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if ticket.status != "paid":
            TicketRedemptionLog.objects.create(
                ticket=ticket,
                activity=ticket.activity,
                host=request.user,
                successful=False,
                status=ticket.status,
                message="Ticket is not in a valid state for redemption.",
            )
            return Response(
                {"message": "Ticket is not valid for redemption."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ticket.status = "used"
        ticket.redeemed_at = timezone.now()
        ticket.save(update_fields=["status", "redeemed_at"])

        TicketRedemptionLog.objects.create(
            ticket=ticket,
            activity=ticket.activity,
            host=request.user,
            successful=True,
            status=ticket.status,
            message="Validated successfully.",
        )

        return Response(
            {
                "ticket_id": str(ticket.ticket_id),
                "activity_id": ticket.activity_id,
                "buyer_username": ticket.buyer.username,
                "status": ticket.status,
                "redeemed_at": ticket.redeemed_at,
            }
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def join_activity(request, pk):
    activity = get_object_or_404(Activity, pk=pk)
    user = request.user

    if activity.is_cancelled:
        return Response(
            {"message": "This gathering was cancelled by the host."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    existing_participant = ActivityParticipant.objects.filter(activity=activity, user=user).first()
    if existing_participant:
        return Response(
            {"message": "Already requested to join"}, status=status.HTTP_400_BAD_REQUEST
        )

    from .eligibility import confirmed_people_count

    if activity.capacity is not None:
        confirmed_count = confirmed_people_count(activity)
        if confirmed_count >= activity.capacity:
            return Response({"message": "Activity is full"}, status=status.HTTP_400_BAD_REQUEST)

    ActivityParticipant.objects.create(activity=activity, user=user, status="pending")

    from users.push_notifications import send_activity_join_notification

    send_activity_join_notification(activity, user)

    return Response({"message": "Join request sent"}, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def remove_activity_participant(request, pk, user_id):
    """Allow the host to remove a participant from their activity."""
    activity = get_object_or_404(Activity, pk=pk)
    from .access import is_activity_host

    if not is_activity_host(request.user, activity):
        return Response(
            {"detail": "Only the host can remove participants."}, status=status.HTTP_403_FORBIDDEN
        )

    if int(user_id) == request.user.id:
        return Response(
            {
                "detail": "Hosts cannot remove themselves this way. Delete or leave the activity instead."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    deleted, _ = ActivityParticipant.objects.filter(activity=activity, user_id=user_id).delete()
    if not deleted:
        return Response({"detail": "Participant not found."}, status=status.HTTP_404_NOT_FOUND)

    return Response({"detail": "Participant removed."}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def leave_activity(request, pk):
    activity = get_object_or_404(Activity, pk=pk)
    user = request.user

    try:
        participant = ActivityParticipant.objects.get(activity=activity, user=user)
        if (
            participant.status == "declined"
            and activity.requires_approval
            and not activity.allow_rerequest
        ):
            # Deleting the row would let the guest ask again, which the host ruled out.
            return Response(
                {"detail": "The host declined your request."}, status=status.HTTP_400_BAD_REQUEST
            )
        participant.delete()
        return Response({"message": "Left activity successfully"})
    except ActivityParticipant.DoesNotExist:
        return Response({"message": "Not a participant"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def activity_chat(request, pk):
    """Get chat messages for an activity or send a message"""
    activity = get_object_or_404(Activity, pk=pk)
    user = request.user

    from .access import user_can_access_activity_chat

    if not user_can_access_activity_chat(user, activity):
        return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        # Get or create conversation for this activity
        participants = (
            ActivityParticipant.objects.filter(activity=activity, status="confirmed")
            .select_related("user")
            .order_by("joined_at", "id")
        )
        if participants.count() >= 2:
            user_a = participants.first().user
            user_b = participants.last().user

            match, created = Match.get_or_create_normalized(
                activity=activity,
                user_one=user_a,
                user_two=user_b,
            )

            from chat.models import Conversation

            conversation, created = Conversation.objects.get_or_create(match=match)

            messages = conversation.messages.all().order_by("created_at")
            from chat.serializers import MessageSerializer

            serializer = MessageSerializer(messages, many=True)
            return Response(serializer.data)

        return Response([])

    elif request.method == "POST":
        message_text = request.data.get("message")
        if not message_text:
            return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Get or create conversation for this activity
        participants = (
            ActivityParticipant.objects.filter(activity=activity, status="confirmed")
            .select_related("user")
            .order_by("joined_at", "id")
        )
        if participants.count() >= 2:
            user_a = participants.first().user
            user_b = participants.last().user

            match, created = Match.get_or_create_normalized(
                activity=activity,
                user_one=user_a,
                user_two=user_b,
            )

            from chat.models import Conversation, Message

            conversation, created = Conversation.objects.get_or_create(match=match)

            # Create the message
            message = Message.objects.create(
                conversation=conversation, sender=user, text=message_text
            )

            from chat.serializers import MessageSerializer

            serializer = MessageSerializer(message)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(
            {"error": "Not enough participants to start chat"}, status=status.HTTP_400_BAD_REQUEST
        )
