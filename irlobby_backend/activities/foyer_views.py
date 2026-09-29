"""RSVP, household, church search, event photos, and optional giving."""

from decimal import Decimal, InvalidOperation

import stripe
from django.conf import settings
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .foyer import (
    PUBLIC_LOCATION_WARNING,
    VERIFIED_CHURCHES,
    apply_rsvp,
    foyer_mode,
    gift_destination_account_id,
    gift_notice,
    going_headcount,
    is_congregational_admin,
    user_can_add_event_photo,
    validate_dependent,
)
from .models import Activity, Church, Donation, HouseholdDependent
from .photos import save_uploaded_photo


def _activity_for_member(request, pk):
    queryset = Activity.objects.filter(Q(is_approved=True) | Q(host=request.user))
    if request.user.is_staff or is_congregational_admin(request.user):
        queryset = Activity.objects.all()
    return get_object_or_404(queryset, pk=pk)


class ChurchListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = (request.query_params.get("q") or request.query_params.get("search") or "").strip()
        churches = Church.objects.all()
        if query:
            churches = churches.filter(name__icontains=query)
        return Response(
            [
                {"id": church.id, "name": church.name, "is_verified": church.is_verified}
                for church in churches[:50]
            ]
        )

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response({"name": "Type the church name."}, status=status.HTTP_400_BAD_REQUEST)
        church, created = Church.objects.get_or_create(
            name=name,
            defaults={"is_verified": name in VERIFIED_CHURCHES},
        )
        return Response(
            {"id": church.id, "name": church.name, "is_verified": church.is_verified},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class HouseholdDependentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        dependents = HouseholdDependent.objects.filter(guardian=request.user)
        return Response([_dependent_payload(item) for item in dependents])

    def post(self, request):
        first_name = (request.data.get("first_name") or request.data.get("firstName") or "").strip()
        last_name = (request.data.get("last_name") or request.data.get("lastName") or "").strip()
        birth_date = request.data.get("birth_date") or request.data.get("birthDate")
        sex = (request.data.get("sex") or "").strip().lower()
        if not first_name or not birth_date:
            return Response(
                {"detail": "A child needs a name and birth date."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.utils.dateparse import parse_date

        parsed = parse_date(str(birth_date))
        if parsed is None:
            return Response(
                {"birth_date": "Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_dependent(
                request.user,
                first_name=first_name,
                last_name=last_name,
                birth_date=parsed,
                sex=sex,
            )
        except serializers.ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        dependent = HouseholdDependent.objects.create(
            guardian=request.user,
            first_name=first_name,
            last_name=last_name,
            birth_date=parsed,
            sex=sex,
        )
        return Response(_dependent_payload(dependent), status=status.HTTP_201_CREATED)


class HouseholdDependentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        dependent = get_object_or_404(HouseholdDependent, pk=pk, guardian=request.user)
        dependent.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _dependent_payload(dependent):
    return {
        "id": dependent.id,
        "first_name": dependent.first_name,
        "last_name": dependent.last_name,
        "firstName": dependent.first_name,
        "lastName": dependent.last_name,
        "birth_date": dependent.birth_date.isoformat(),
        "birthDate": dependent.birth_date.isoformat(),
        "sex": dependent.sex,
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def rsvp_activity(request, pk):
    activity = _activity_for_member(request, pk)
    include_self = request.data.get("include_self", request.data.get("includeSelf", True))
    if isinstance(include_self, str):
        include_self = include_self.lower() not in {"false", "0", "no"}
    raw_ids = request.data.get("dependent_ids", request.data.get("dependentIds", [])) or []
    try:
        dependent_ids = [int(item) for item in raw_ids]
    except (TypeError, ValueError):
        return Response(
            {"dependent_ids": "Dependent ids must be numbers."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        participant = apply_rsvp(
            activity,
            request.user,
            include_self=bool(include_self),
            dependent_ids=dependent_ids,
        )
    except serializers.ValidationError as exc:
        return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            "status": participant.status,
            "include_self": participant.include_self,
            "includeSelf": participant.include_self,
            "dependent_ids": list(participant.dependents.values_list("id", flat=True)),
            "headcount": going_headcount(activity),
            "chat_open": True,
            "gift_notice": gift_notice(activity) if activity.donation_enabled else "",
            "donation_enabled": activity.donation_enabled,
            "suggested_donation": str(activity.suggested_donation),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def approve_church_calendar(request, pk):
    if not is_congregational_admin(request.user):
        return Response({"detail": "Only congregational admins can approve the public calendar."}, status=403)
    activity = get_object_or_404(Activity, pk=pk)
    if not activity.list_on_church_calendar:
        return Response(
            {"detail": "The host did not ask for the public calendar."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    activity.calendar_approved = True
    activity.save(update_fields=["calendar_approved"])
    return Response({"id": activity.id, "calendar_approved": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_event_photo(request, pk):
    activity = _activity_for_member(request, pk)
    if not user_can_add_event_photo(request.user, activity):
        return Response(
            {"detail": "Join this gathering before adding photos."},
            status=status.HTTP_403_FORBIDDEN,
        )
    uploaded = request.FILES.get("image") or request.FILES.get("photo")
    if uploaded is None:
        return Response({"image": "Choose a photo."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        photo = save_uploaded_photo(activity, request.user, uploaded)
    except serializers.ValidationError as exc:
        return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
    return Response(
        {"id": photo.id, "url": photo.public_url(request)},
        status=status.HTTP_201_CREATED,
    )


class ActivityGiftView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not foyer_mode():
            return Response(
                {"detail": "Giving is part of The Foyer."},
                status=status.HTTP_404_NOT_FOUND,
            )
        activity = _activity_for_member(request, pk)
        if not activity.donation_enabled:
            return Response(
                {"detail": "This gathering is not accepting gifts."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        raw_amount = request.data.get("amount", activity.suggested_donation)
        try:
            amount = Decimal(str(raw_amount))
        except (InvalidOperation, TypeError):
            return Response({"amount": "Enter a dollar amount."}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return Response({"amount": "Enter a dollar amount."}, status=status.HTTP_400_BAD_REQUEST)

        destination = gift_destination_account_id(activity)
        if not destination:
            return Response(
                {"detail": "The host has not finished payout setup, so gifts cannot be sent yet."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from users.stripe_connect import StripeConnectError, create_foyer_gift_checkout_session

        success_url = request.data.get("successUrl") or settings.STRIPE_SUCCESS_URL
        cancel_url = request.data.get("cancelUrl") or settings.STRIPE_CANCEL_URL
        donation = Donation.objects.create(
            donor=request.user,
            activity=activity,
            amount=amount,
            status="pending",
        )
        try:
            session = create_foyer_gift_checkout_session(
                activity=activity,
                donation=donation,
                destination_account_id=destination,
                success_url=success_url,
                cancel_url=cancel_url,
            )
        except StripeConnectError as exc:
            donation.status = "cancelled"
            donation.save(update_fields=["status"])
            return Response({"message": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except stripe.error.StripeError as exc:
            donation.status = "cancelled"
            donation.save(update_fields=["status"])
            return Response({"message": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        session_id = session["id"] if isinstance(session, dict) else session.id
        checkout_url = session.get("url") if isinstance(session, dict) else getattr(session, "url", None)
        donation.stripe_session_id = session_id
        donation.save(update_fields=["stripe_session_id"])
        return Response(
            {
                "session_id": session_id,
                "url": checkout_url,
                "application_fee_amount": 0,
                "gift_notice": gift_notice(activity),
                "public_location_warning": PUBLIC_LOCATION_WARNING
                if activity.list_on_church_calendar
                else "",
            },
            status=status.HTTP_201_CREATED,
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def foyer_mode_status(_request):
    return Response(
        {
            "product": "The Foyer" if foyer_mode() else "IRLobby",
            "church": "Franconia Mennonite Church",
            "foyerMode": foyer_mode(),
            "platformFeePercent": 0 if foyer_mode() else settings.STRIPE_PLATFORM_FEE_PERCENT,
        }
    )
