import stripe
from django.conf import settings
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.core.signing import BadSignature
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from matches.models import Match
from moderation.models import BlockedUser
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView
from waffle import flag_is_active

from .models import Activity, ActivityParticipant, Ticket, TicketRedemptionLog
from .permissions import IsHostOrReadOnly
from .serializers import (
    ActivitySerializer,
    TicketPurchaseSerializer,
    TicketSerializer,
    TicketValidationSerializer,
)


def ticketing_enabled(request):
    return flag_is_active(request, "ticketed_events_enabled") or settings.ENABLE_TICKETING


class ActivityListCreateView(generics.ListCreateAPIView):
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
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

        # Filter by location if provided
        latitude = self.request.query_params.get("latitude")
        longitude = self.request.query_params.get("longitude")
        radius = self.request.query_params.get("radius", 10)  # Default 10km radius

        ordered_by_distance = False

        if latitude and longitude:
            try:
                radius_km = float(radius)
                point = Point(float(longitude), float(latitude), srid=4326)
            except (TypeError, ValueError):
                radius_km = None
                point = None

            if point and radius_km is not None:
                queryset = queryset.filter(location_point__isnull=False)
                queryset = queryset.annotate(distance=Distance("location_point", point))
                queryset = queryset.filter(
                    location_point__distance_lte=(point, D(km=radius_km))
                ).order_by("distance", "-created_at")
                ordered_by_distance = True

        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category__icontains=category)

        location = self.request.query_params.get("location")
        if location:
            queryset = queryset.filter(location__icontains=location)

        skill_level = self.request.query_params.get("skill_level")
        if skill_level:
            queryset = queryset.filter(skill_level__icontains=skill_level)

        age_restriction = self.request.query_params.get("age_restriction")
        if age_restriction:
            queryset = queryset.filter(age_restriction__icontains=age_restriction)

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

        success_url = serializer.validated_data.get("successUrl") or settings.STRIPE_SUCCESS_URL
        cancel_url = serializer.validated_data.get("cancelUrl") or settings.STRIPE_CANCEL_URL

        stripe.api_key = settings.STRIPE_API_KEY
        try:
            ticket = Ticket.objects.create(
                buyer=request.user,
                activity=activity,
                status="pending",
            )

            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                mode="payment",
                line_items=[
                    {
                        "price_data": {
                            "currency": activity.currency.lower(),
                            "product_data": {
                                "name": f"Ticket for {activity.title}",
                                "description": activity.description[:200],
                            },
                            "unit_amount": int(activity.ticket_price * 100),
                        },
                        "quantity": 1,
                    }
                ],
                metadata={
                    "ticket_id": str(ticket.ticket_id),
                    "activity_id": str(activity.id),
                },
                success_url=success_url,
                cancel_url=cancel_url,
            )
            ticket.stripe_session_id = session["id"]
            ticket.save(update_fields=["stripe_session_id"])

            return Response({"session_id": session["id"]}, status=status.HTTP_201_CREATED)
        except stripe.error.StripeError as exc:
            ticket.status = "cancelled"
            ticket.save(update_fields=["status"])  # Keep the pending record for audit.
            return Response({"message": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


class StripeWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.body
        signature = request.headers.get("Stripe-Signature", "")
        stripe.api_key = settings.STRIPE_API_KEY

        try:
            event = stripe.Webhook.construct_event(
                payload, signature, settings.STRIPE_WEBHOOK_SECRET
            )
        except (ValueError, stripe.error.SignatureVerificationError):
            return Response(
                {"message": "Invalid webhook payload."}, status=status.HTTP_400_BAD_REQUEST
            )

        if event["type"] == "checkout.session.completed":
            session_data = event["data"]["object"]
            stripe_session_id = session_data.get("id")
            ticket = Ticket.objects.filter(stripe_session_id=stripe_session_id).first()
            if not ticket:
                metadata = session_data.get("metadata", {}) or {}
                ticket_id = metadata.get("ticket_id")
                if ticket_id:
                    ticket = Ticket.objects.filter(ticket_id=ticket_id).first()

            if ticket and ticket.status != "paid":
                ticket.status = "paid"
                ticket.purchased_at = timezone.now()
                ticket.stripe_payment_intent_id = session_data.get("payment_intent")
                ticket.save(update_fields=["status", "purchased_at", "stripe_payment_intent_id"])
                Activity.objects.filter(pk=ticket.activity_id).update(
                    tickets_sold=F("tickets_sold") + 1
                )
                from .tasks import generate_ticket_qr_code

                generate_ticket_qr_code.delay(ticket.id)

        return Response({"success": True})


class UserTicketListView(generics.ListAPIView):
    serializer_class = TicketSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Ticket.objects.filter(buyer=self.request.user).order_by("-created_at")


class ValidateTicketView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [TicketThrottle]

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

        ticket = get_object_or_404(Ticket, ticket_id=ticket_uuid, activity_id=activity_id)

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

    existing_participant = ActivityParticipant.objects.filter(activity=activity, user=user).first()
    if existing_participant:
        return Response(
            {"message": "Already requested to join"}, status=status.HTTP_400_BAD_REQUEST
        )

    confirmed_count = ActivityParticipant.objects.filter(
        activity=activity, status="confirmed"
    ).count()
    if confirmed_count >= activity.capacity:
        return Response({"message": "Activity is full"}, status=status.HTTP_400_BAD_REQUEST)

    ActivityParticipant.objects.create(activity=activity, user=user, status="pending")

    return Response({"message": "Join request sent"}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def leave_activity(request, pk):
    activity = get_object_or_404(Activity, pk=pk)
    user = request.user

    try:
        participant = ActivityParticipant.objects.get(activity=activity, user=user)
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

    # Check if user is a participant
    if not ActivityParticipant.objects.filter(activity=activity, user=user).exists():
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
