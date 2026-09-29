"""Gathering endpoints for The Foyer: RSVP, household, churches, photos, calendar."""

from __future__ import annotations

from django.db import transaction
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .access import is_activity_host, is_church_admin
from .eligibility import (
    age_on,
    confirmed_people_count,
    eligibility_for_person,
    event_local_date,
    ny_today,
)
from .household_rules import dependent_create_errors
from .models import Activity, ActivityParticipant, Church, EventPhoto, HouseholdDependent
from .photos import PhotoProcessingError, absolute_photo_url, compress_uploaded_image
from .public_calendar import public_calendar_ics, public_calendar_queryset, public_event_payload
from .serializers import ActivitySerializer

MAX_EVENT_PHOTOS = 8


def _display_name(user) -> str:
    full = f"{user.first_name} {user.last_name}".strip()
    return full or user.username


def _person_payload(*, name, sex, dob, on_date, activity, extra=None):
    eligible, reason = eligibility_for_person(activity=activity, sex=sex, dob=dob, on_date=on_date)
    payload = {
        "name": name,
        "sex": sex or "",
        "age": age_on(dob, on_date),
        "eligible": eligible,
        "reason": reason,
    }
    if extra:
        payload.update(extra)
    return payload


def church_payload(church) -> dict:
    return {
        "id": church.id,
        "name": church.name,
        "is_verified": church.is_verified,
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def church_list_create(request):
    if request.method == "GET":
        query = (request.query_params.get("q") or "").strip()
        churches = Church.objects.all()
        if query:
            churches = churches.filter(name__icontains=query)
        churches = churches.order_by("-is_verified", "name")[:20]
        return Response([church_payload(church) for church in churches])

    name = (request.data.get("name") or "").strip()
    if not name:
        return Response({"name": "Enter a church name."}, status=status.HTTP_400_BAD_REQUEST)
    if len(name) > 255:
        return Response({"name": "Church name is too long."}, status=status.HTTP_400_BAD_REQUEST)
    existing = Church.objects.filter(name__iexact=name).first()
    if existing:
        return Response(church_payload(existing), status=status.HTTP_200_OK)
    church = Church.objects.create(name=name, is_verified=False, created_by=request.user)
    return Response(church_payload(church), status=status.HTTP_201_CREATED)


def dependent_payload(dependent, *, today=None) -> dict:
    today = today or ny_today()
    return {
        "id": dependent.id,
        "name": dependent.name,
        "date_of_birth": dependent.date_of_birth.isoformat(),
        "sex": dependent.sex or "",
        "age": age_on(dependent.date_of_birth, today),
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def household_list_create(request):
    if request.method == "GET":
        children = request.user.household_dependents.all()
        return Response({"children": [dependent_payload(child) for child in children]})

    name = (request.data.get("name") or "").strip()
    dob = request.data.get("date_of_birth") or request.data.get("birth_date")
    sex = (request.data.get("sex") or "").strip().lower()
    if sex in {"m", "male"}:
        sex = "male"
    elif sex in {"f", "female"}:
        sex = "female"
    elif sex:
        return Response({"sex": "Sex must be male or female."}, status=status.HTTP_400_BAD_REQUEST)
    if not name:
        return Response({"name": "Enter the child's name."}, status=status.HTTP_400_BAD_REQUEST)
    from django.utils.dateparse import parse_date

    parsed = parse_date(dob) if isinstance(dob, str) else dob
    if parsed is None:
        return Response(
            {"date_of_birth": "Enter a birth date."}, status=status.HTTP_400_BAD_REQUEST
        )
    errors = dependent_create_errors(parent=request.user, name=name, date_of_birth=parsed)
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    child = HouseholdDependent.objects.create(
        parent=request.user, name=name, date_of_birth=parsed, sex=sex
    )
    return Response(dependent_payload(child), status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def household_delete(request, pk):
    deleted, _ = HouseholdDependent.objects.filter(parent=request.user, pk=pk).delete()
    if not deleted:
        return Response({"detail": "Child not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def whos_coming(request, pk):
    activity = get_object_or_404(Activity, pk=pk)
    on_date = event_local_date(activity)
    user = request.user
    me = _person_payload(
        name=_display_name(user),
        sex=user.sex,
        dob=user.date_of_birth,
        on_date=on_date,
        activity=activity,
    )
    dependents = [
        _person_payload(
            name=child.name,
            sex=child.sex,
            dob=child.date_of_birth,
            on_date=on_date,
            activity=activity,
            extra={"id": child.id},
        )
        for child in user.household_dependents.all()
    ]
    return Response(
        {
            "me": me,
            "dependents": dependents,
            "note": (
                "Only children in your household are listed. "
                "Teens with their own account RSVP for themselves."
            ),
        }
    )


def _rsvp_body(participant, activity):
    dependent_ids = list(participant.dependents.values_list("id", flat=True))
    people = (1 if participant.include_self else 0) + len(dependent_ids)
    return {
        "status": participant.status,
        "include_self": participant.include_self,
        "dependent_ids": dependent_ids,
        "people_count": people,
        "going_count": confirmed_people_count(activity),
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def rsvp_activity(request, pk):
    include_self = request.data.get("include_self", request.data.get("includeSelf", True))
    if isinstance(include_self, str):
        include_self = include_self.strip().lower() not in {"0", "false", "no"}
    else:
        include_self = bool(include_self)

    raw_ids = request.data.get("dependent_ids", request.data.get("dependentIds", []))
    if raw_ids is None:
        raw_ids = []
    if not isinstance(raw_ids, list):
        return Response(
            {"dependent_ids": "Send a list of child ids."}, status=status.HTTP_400_BAD_REQUEST
        )
    try:
        dependent_ids = [int(value) for value in raw_ids]
    except (TypeError, ValueError):
        return Response(
            {"dependent_ids": "Send a list of child ids."}, status=status.HTTP_400_BAD_REQUEST
        )

    dependents = list(HouseholdDependent.objects.filter(parent=request.user, id__in=dependent_ids))
    if len(dependents) != len(set(dependent_ids)):
        return Response(
            {"dependent_ids": "One or more children are not in your household."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not include_self and not dependents:
        return Response(
            {"detail": "Choose yourself or a child."}, status=status.HTTP_400_BAD_REQUEST
        )

    with transaction.atomic():
        activity = get_object_or_404(Activity.objects.select_for_update(), pk=pk)
        on_date = event_local_date(activity)
        problems = []
        if include_self:
            eligible, reason = eligibility_for_person(
                activity=activity,
                sex=request.user.sex,
                dob=request.user.date_of_birth,
                on_date=on_date,
            )
            if not eligible:
                problems.append({"who": "self", "eligible": False, "reason": reason})
        for child in dependents:
            eligible, reason = eligibility_for_person(
                activity=activity, sex=child.sex, dob=child.date_of_birth, on_date=on_date
            )
            if not eligible:
                problems.append(
                    {
                        "who": "dependent",
                        "id": child.id,
                        "name": child.name,
                        "eligible": False,
                        "reason": reason,
                    }
                )
        if problems:
            return Response(
                {
                    "detail": "Some people are not eligible for this gathering.",
                    "people": problems,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        people = (1 if include_self else 0) + len(dependents)
        already = confirmed_people_count(activity, exclude_user_id=request.user.id)
        if activity.capacity is not None and already + people > activity.capacity:
            return Response(
                {"detail": "This gathering is full.", "message": "Activity is full"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        participant, _created = ActivityParticipant.objects.get_or_create(
            activity=activity,
            user=request.user,
            defaults={"status": "confirmed", "include_self": include_self},
        )
        participant.status = "confirmed"
        participant.include_self = include_self
        participant.save(update_fields=["status", "include_self"])
        participant.dependents.set(dependents)

    participant = ActivityParticipant.objects.prefetch_related("dependents").get(
        activity_id=pk, user=request.user
    )
    return Response(_rsvp_body(participant, participant.activity), status=status.HTTP_200_OK)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def cancel_rsvp(request, pk):
    activity = get_object_or_404(Activity, pk=pk)
    deleted, _ = ActivityParticipant.objects.filter(activity=activity, user=request.user).delete()
    if not deleted:
        return Response({"detail": "You do not have an RSVP."}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"detail": "RSVP cancelled.", "going_count": confirmed_people_count(activity)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def approve_church_calendar(request, pk):
    if not is_church_admin(request.user):
        return Response(
            {"detail": "Only church admins can approve calendar listings."},
            status=status.HTTP_403_FORBIDDEN,
        )
    activity = get_object_or_404(Activity, pk=pk)
    if not activity.list_on_church_calendar:
        return Response(
            {"detail": "This gathering is not listed on the church calendar."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    activity.calendar_approved = True
    activity.save(update_fields=["calendar_approved"])
    return Response(
        {
            "id": activity.id,
            "list_on_church_calendar": activity.list_on_church_calendar,
            "calendar_approved": activity.calendar_approved,
        }
    )


class GoingActivitiesView(generics.ListAPIView):
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Activity.objects.filter(
                participants__user=self.request.user,
                participants__status="confirmed",
            )
            .select_related("host", "host_church")
            .prefetch_related("participants__dependents", "photos")
            .distinct()
            .order_by("time", "id")
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_event_photo(request, pk):
    activity = get_object_or_404(Activity, pk=pk)
    if not is_activity_host(request.user, activity):
        return Response(
            {"detail": "Only the host can add photos."}, status=status.HTTP_403_FORBIDDEN
        )
    if activity.photos.count() >= MAX_EVENT_PHOTOS:
        return Response(
            {"detail": "An event can have at most 8 photos."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    upload = request.FILES.get("image") or request.FILES.get("photo") or request.FILES.get("file")
    if upload is None:
        return Response(
            {"detail": "Send the photo as a file upload. Photos are served as URLs."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        compressed = compress_uploaded_image(upload)
    except PhotoProcessingError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    photo = EventPhoto(activity=activity)
    photo.image.save(f"activity-{activity.id}.jpg", compressed, save=True)
    return Response(
        {"id": photo.id, "url": absolute_photo_url(photo, request)},
        status=status.HTTP_201_CREATED,
    )


def _delete_event_photo(request, pk, photo_id):
    activity = get_object_or_404(Activity, pk=pk)
    if not is_activity_host(request.user, activity):
        return Response(
            {"detail": "Only the host can remove photos."}, status=status.HTTP_403_FORBIDDEN
        )
    photo = get_object_or_404(EventPhoto, pk=photo_id, activity=activity)
    photo.image.delete(save=False)
    photo.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_event_photo(request, pk, photo_id):
    return _delete_event_photo(request, pk, photo_id)


@api_view(["GET", "DELETE"])
@permission_classes([AllowAny])
def event_photo_file(request, pk, photo_id):
    if request.method == "DELETE":
        if not request.user or not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return _delete_event_photo(request, pk, photo_id)
    photo = get_object_or_404(EventPhoto, pk=photo_id, activity_id=pk)
    if not photo.image:
        return Response({"detail": "Photo not found."}, status=status.HTTP_404_NOT_FOUND)
    return FileResponse(photo.image.open("rb"), content_type="image/jpeg")


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def public_calendar(request):
    events = [public_event_payload(activity, request) for activity in public_calendar_queryset()]
    return Response({"events": events})


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def public_calendar_ics_view(request):
    body = public_calendar_ics(public_calendar_queryset())
    response = HttpResponse(body, content_type="text/calendar; charset=utf-8")
    response["Content-Disposition"] = 'inline; filename="calendar.ics"'
    return response
