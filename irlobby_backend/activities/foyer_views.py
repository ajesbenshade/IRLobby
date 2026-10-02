"""Gathering endpoints for The Foyer: RSVP, household, churches, photos, calendar."""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from users.social import full_name, short_name

from .access import is_activity_host, is_church_admin, user_has_going_rsvp
from .eligibility import (
    age_band,
    age_on,
    confirmed_people_count,
    eligibility_for_person,
    event_local_date,
    ny_today,
)
from .household_rules import (
    dependent_create_errors,
    member_age,
    member_birth_date,
    parse_birth_month_year,
    spouse_create_errors,
)
from .models import Activity, ActivityParticipant, Church, EventPhoto, HouseholdDependent
from .photos import (
    PHOTO_DOWNLOAD_MAX_AGE_SECONDS,
    PhotoProcessingError,
    absolute_photo_download_url,
    absolute_photo_url,
    compress_uploaded_image,
    photo_download_token_valid,
    photo_token_valid,
)
from .public_calendar import (
    activity_id_from_ics_token,
    event_ics,
    ics_token_hides_location,
    is_public_calendar_event,
    public_calendar_ics,
    public_calendar_queryset,
    public_event_payload,
)
from .serializers import ActivitySerializer

MAX_EVENT_PHOTOS = 50


def _display_name(user) -> str:
    full = f"{user.first_name} {user.last_name}".strip()
    return full or user.username


def _person_payload(*, name, sex, dob, on_date, activity, extra=None, spouse=False):
    eligible, reason = eligibility_for_person(
        activity=activity, sex=sex, dob=dob, on_date=on_date, assume_adult=spouse
    )
    payload = {
        "name": name,
        "sex": sex or "",
        "age": None if spouse else age_on(dob, on_date),
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
    """Legacy child shape (kept for builds 88/89), plus relationship and birth month/year."""
    today = today or ny_today()
    dob = member_birth_date(dependent)
    return {
        "id": dependent.id,
        "name": dependent.name,
        "date_of_birth": dob.isoformat() if dob else None,
        "sex": dependent.sex or "",
        "age": age_on(dob, today),
        "relationship": dependent.relationship,
        "birth_month": dob.month if dob else None,
        "birth_year": dob.year if dob else None,
    }


def member_payload(member, *, today=None) -> dict:
    """Family member shape: no exact birth date, and no age for a spouse."""
    today = today or ny_today()
    dob = member_birth_date(member) if member.relationship == "child" else None
    return {
        "id": member.id,
        "name": member.name,
        "relationship": member.relationship,
        "sex": member.sex or "",
        "birth_month": dob.month if dob else None,
        "birth_year": dob.year if dob else None,
        "age": member_age(member, today),
    }


def _household_members(user):
    return list(user.household_dependents.all())


def _household_created(user, member):
    body = dependent_payload(member)
    body["members"] = [member_payload(m) for m in _household_members(user)]
    return Response(body, status=status.HTTP_201_CREATED)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def household_list_create(request):
    if request.method == "GET":
        members = _household_members(request.user)
        children = [dependent_payload(m) for m in members if m.relationship == "child"]
        return Response({"children": children, "members": [member_payload(m) for m in members]})

    name = (request.data.get("name") or "").strip()
    relationship = (request.data.get("relationship") or "child").strip().lower()
    if relationship not in {"child", "spouse"}:
        return Response(
            {"relationship": "Relationship must be spouse or child."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    sex = (request.data.get("sex") or "").strip().lower()
    if sex in {"m", "male"}:
        sex = "male"
    elif sex in {"f", "female"}:
        sex = "female"
    elif sex:
        return Response({"sex": "Sex must be male or female."}, status=status.HTTP_400_BAD_REQUEST)
    if not name:
        who = "spouse" if relationship == "spouse" else "child"
        return Response({"name": f"Enter the {who}'s name."}, status=status.HTTP_400_BAD_REQUEST)
    if len(name) > 120:
        return Response({"name": "Name is too long."}, status=status.HTTP_400_BAD_REQUEST)

    if relationship == "spouse":
        # A spouse is an adult with no stored birth data; any that is sent is ignored.
        errors = spouse_create_errors(parent=request.user)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        member = HouseholdDependent.objects.create(
            parent=request.user, name=name, sex=sex, relationship="spouse"
        )
        return _household_created(request.user, member)

    from django.utils.dateparse import parse_date

    dob = request.data.get("date_of_birth") or request.data.get("birth_date")
    parsed = parse_date(dob) if isinstance(dob, str) else dob
    if parsed is not None:
        month, year, check_dob = parsed.month, parsed.year, parsed
    else:
        month, year, error = parse_birth_month_year(
            request.data.get("birth_month"), request.data.get("birth_year")
        )
        if error or month is None:
            return Response(
                {"birth_month": error or "Enter a birth month and year."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        check_dob = member_birth_date(
            HouseholdDependent(birth_month=month, birth_year=year, relationship="child")
        )
    errors = dependent_create_errors(
        parent=request.user, name=name, date_of_birth=check_dob, month_year_only=parsed is None
    )
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)
    child = HouseholdDependent.objects.create(
        parent=request.user,
        name=name,
        date_of_birth=parsed,
        birth_month=month,
        birth_year=year,
        sex=sex,
        relationship="child",
    )
    return _household_created(request.user, child)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def household_delete(request, pk):
    deleted, _ = HouseholdDependent.objects.filter(parent=request.user, pk=pk).delete()
    if not deleted:
        return Response({"detail": "Family member not found."}, status=status.HTTP_404_NOT_FOUND)
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
    dependents = []
    for member in _household_members(user):
        shape = member_payload(member)
        dependents.append(
            _person_payload(
                name=member.name,
                sex=member.sex,
                dob=member_birth_date(member),
                on_date=on_date,
                activity=activity,
                spouse=member.relationship == "spouse",
                extra={
                    "id": member.id,
                    "relationship": member.relationship,
                    "birth_month": shape["birth_month"],
                    "birth_year": shape["birth_year"],
                },
            )
        )
    return Response(
        {
            "me": me,
            "dependents": dependents,
            "members": dependents,
            "note": (
                "Only your spouse and children are listed. "
                "Teens with their own account RSVP for themselves."
            ),
        }
    )


def _going_participants(activity):
    return list(
        ActivityParticipant.objects.filter(activity=activity, status="confirmed")
        .select_related("user")
        .prefetch_related("dependents")
        .order_by("joined_at", "id")
    )


def _host_attendee_households(activity) -> list:
    """Host view: one entry per going household. Names, relationship and age band only."""
    on_date = event_local_date(activity)
    households = []
    for participant in _going_participants(activity):
        user = participant.user
        people = []
        if participant.include_self:
            people.append(
                {
                    "name": full_name(user),
                    "relationship": "self",
                    "age_band": age_band(age_on(user.date_of_birth, on_date)),
                }
            )
        for member in participant.dependents.all():
            people.append(
                {
                    "name": member.name,
                    "relationship": member.relationship,
                    "age_band": age_band(member_age(member, on_date)),
                }
            )
        if people:
            households.append({"name": full_name(user), "people": people})
    return households


def _past_attendee_names(activity, viewer) -> list:
    """Attendee view: one entry per other going account; household members are never listed.

    A minor's user_id is only given to accepted friends, so a stranger cannot open a minor's
    profile from here. Blocked users (either way) are left out.
    """
    from users.social import blocked_user_ids, friend_ids, is_minor

    excluded = blocked_user_ids(viewer) | {viewer.id}
    friends = friend_ids(viewer)
    attendees = []
    for participant in _going_participants(activity):
        user = participant.user
        if user.id in excluded:
            continue
        linkable = user.id in friends or not is_minor(user)
        attendees.append({"user_id": user.id if linkable else None, "name": short_name(user)})
    return attendees


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def activity_attendees(request, pk):
    """Host/staff get family detail; going attendees of a started event get names only."""
    activity = get_object_or_404(Activity, pk=pk)
    user = request.user
    going = confirmed_people_count(activity)
    if user.is_staff or is_activity_host(user, activity):
        return Response({"going_count": going, "households": _host_attendee_households(activity)})
    if activity.time <= timezone.now() and user_has_going_rsvp(user, activity):
        return Response({"going_count": going, "attendees": _past_attendee_names(activity, user)})
    return Response(
        {"detail": "Only the host can see who is coming."}, status=status.HTTP_403_FORBIDDEN
    )


def _rsvp_body(participant, activity):
    dependent_ids = list(participant.dependents.values_list("id", flat=True))
    people = (1 if participant.include_self else 0) + len(dependent_ids)
    return {
        "status": participant.status,
        "include_self": participant.include_self,
        "dependent_ids": dependent_ids,
        "member_ids": dependent_ids,
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

    # `member_ids` is the new name for `dependent_ids`; if both are sent they are merged.
    ids_error = {"dependent_ids": "Send a list of family member ids."}
    dependent_ids = []
    for key in ("dependent_ids", "dependentIds", "member_ids", "memberIds"):
        raw_ids = request.data.get(key)
        if raw_ids is None:
            continue
        if not isinstance(raw_ids, list):
            return Response(ids_error, status=status.HTTP_400_BAD_REQUEST)
        try:
            dependent_ids.extend(int(value) for value in raw_ids)
        except (TypeError, ValueError):
            return Response(ids_error, status=status.HTTP_400_BAD_REQUEST)

    dependents = list(HouseholdDependent.objects.filter(parent=request.user, id__in=dependent_ids))
    if len(dependents) != len(set(dependent_ids)):
        return Response(
            {"dependent_ids": "One or more family members are not in your household."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not include_self and not dependents:
        return Response(
            {"detail": "Choose yourself or a family member."}, status=status.HTTP_400_BAD_REQUEST
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
                activity=activity,
                sex=child.sex,
                dob=member_birth_date(child),
                on_date=on_date,
                assume_adult=child.relationship == "spouse",
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
    from swipes.models import Swipe

    activity = get_object_or_404(Activity, pk=pk)
    if is_activity_host(request.user, activity):
        return Response(
            {"detail": "Hosts cannot cancel their own gathering this way."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if activity.time <= timezone.now():
        return Response(
            {"detail": "This gathering has already started."}, status=status.HTTP_400_BAD_REQUEST
        )
    with transaction.atomic():
        deleted, _ = ActivityParticipant.objects.filter(
            activity=activity, user=request.user
        ).delete()
        if not deleted:
            return Response(
                {"detail": "You do not have an RSVP."}, status=status.HTTP_400_BAD_REQUEST
            )
        # The card goes back into the deck.
        Swipe.objects.filter(user=request.user, activity=activity).delete()
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
            {"detail": "An event can have at most 50 photos."},
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
    photo = get_object_or_404(EventPhoto.objects.select_related("activity"), pk=photo_id, activity_id=pk)
    if not photo.image:
        return Response({"detail": "Photo not found."}, status=status.HTTP_404_NOT_FOUND)
    activity = photo.activity
    if not is_public_calendar_event(activity):
        user = request.user
        allowed = False
        if user and user.is_authenticated:
            allowed = bool(activity.is_approved or activity.host_id == user.id or user.is_staff)
        if not allowed:
            token = request.query_params.get("t", "")
            allowed = bool(token) and photo_token_valid(token, activity.id, photo.id)
        if not allowed:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
    response = FileResponse(photo.image.open("rb"), content_type="image/jpeg")
    response["Cache-Control"] = "public, max-age=300" if is_public_calendar_event(activity) else "private, max-age=300"
    return response


def _can_download_photos(user, activity) -> bool:
    """Public-calendar events: any logged-in user. Others: host, staff, or a going attendee,
    and only once the gathering has started."""
    if is_public_calendar_event(activity):
        return True
    if user.is_staff or is_activity_host(user, activity):
        return True
    return activity.time <= timezone.now() and user_has_going_rsvp(user, activity)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def photo_downloads(request, pk):
    activity = get_object_or_404(Activity, pk=pk)
    if not _can_download_photos(request.user, activity):
        return Response(
            {"detail": "Photos can be downloaded by people who attended, after it starts."},
            status=status.HTTP_403_FORBIDDEN,
        )
    expires_at = timezone.now() + timedelta(seconds=PHOTO_DOWNLOAD_MAX_AGE_SECONDS)
    photos = [
        {
            "id": photo.id,
            "filename": f"foyer-{activity.id}-{photo.id}.jpg",
            "url": absolute_photo_download_url(photo, request),
            "expires_at": expires_at.isoformat(),
        }
        for photo in activity.photos.all()
        if photo.image
    ]
    return Response({"photos": photos})


@api_view(["GET"])
@permission_classes([AllowAny])
def event_photo_download_file(request, pk, photo_id):
    """Signed (about one hour) original file, sent as an attachment."""
    photo = get_object_or_404(EventPhoto, pk=photo_id, activity_id=pk)
    token = request.query_params.get("t", "")
    if not photo.image or not token or not photo_download_token_valid(token, int(pk), photo.id):
        return Response(
            {"detail": "This download link is invalid or has expired."},
            status=status.HTTP_403_FORBIDDEN,
        )
    response = FileResponse(
        photo.image.open("rb"),
        content_type="image/jpeg",
        as_attachment=True,
        filename=f"foyer-{pk}-{photo.id}.jpg",
    )
    response["Cache-Control"] = "private, max-age=300"
    return response


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def public_calendar(request):
    events = [public_event_payload(activity, request) for activity in public_calendar_queryset()]
    return Response({"events": events})


def _is_open_address(activity) -> bool:
    return activity.host_kind == "church" or is_public_calendar_event(activity)


def _calendar_ics_response(body: str, filename: str, *, private: bool) -> HttpResponse:
    response = HttpResponse(body, content_type="text/calendar; charset=utf-8")
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    response["Cache-Control"] = "private, max-age=300" if private else "public, max-age=300"
    return response


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def public_calendar_ics_view(request):
    body = public_calendar_ics(public_calendar_queryset())
    return _calendar_ics_response(body, "calendar.ics", private=False)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def public_event_ics_view(request, pk):
    activity = (
        Activity.objects.filter(pk=pk, list_on_church_calendar=True, calendar_approved=True)
        .select_related("host", "host_church")
        .first()
    )
    if activity is None:
        return HttpResponse(status=404)
    return _calendar_ics_response(event_ics(activity), "event.ics", private=False)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def private_event_ics_view(request):
    token = request.query_params.get("token") or ""
    activity_id = activity_id_from_ics_token(token)
    if activity_id is None:
        return HttpResponse(status=404)
    activity = Activity.objects.filter(pk=activity_id).select_related("host", "host_church").first()
    if activity is None:
        return HttpResponse(status=404)
    hide = ics_token_hides_location(token) and not _is_open_address(activity)
    return _calendar_ics_response(event_ics(activity, hide_location=hide), "event.ics", private=True)
