from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from chat.models import Message
from moderation.reporting import file_report
from users.social import blocked_user_ids

from .access import (
    active_feed,
    annotated_prayers,
    can_access_prayer_chat,
    can_view_prayer,
    discover_feed,
    mine_feed,
    user_is_actively_praying,
)
from .models import PrayerParticipant, PrayerRequest
from .serializers import PrayerCreateSerializer, PrayerRequestSerializer
from .services import chat_payload, pass_prayer, post_message, start_praying, stop_praying


def _load_prayer(pk):
    prayer = (
        PrayerRequest.objects.select_related("author", "conversation")
        .prefetch_related("circles")
        .annotate(
            praying_count=Count(
                "participants",
                filter=Q(participants__status=PrayerParticipant.STATUS_PRAYING),
            )
        )
        .filter(pk=pk)
        .first()
    )
    if prayer is None:
        raise NotFound()
    return prayer


def _visible_prayer(user, pk):
    prayer = annotated_prayers(user).filter(pk=pk).first()
    if prayer is None:
        raise NotFound()
    return prayer


class PrayerListCreateView(generics.ListCreateAPIView):
    """Discover deck: gatherings stay on /api/activities/. This list is prayer only."""

    permission_classes = [IsAuthenticated]
    serializer_class = PrayerRequestSerializer

    def get_queryset(self):
        return discover_feed(self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = PrayerCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        prayer = serializer.save()
        output = PrayerRequestSerializer(
            _visible_prayer(request.user, prayer.pk), context={"request": request}
        )
        return Response(output.data, status=status.HTTP_201_CREATED)


class ActivePrayerListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PrayerRequestSerializer

    def get_queryset(self):
        return active_feed(self.request.user)


class MinePrayerListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PrayerRequestSerializer

    def get_queryset(self):
        return mine_feed(self.request.user)


class PrayerDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PrayerRequestSerializer

    def get_queryset(self):
        return annotated_prayers(self.request.user)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def pray(request, pk):
    prayer = _visible_prayer(request.user, pk)
    _conversation, changed = start_praying(request.user, prayer)
    output = PrayerRequestSerializer(
        _visible_prayer(request.user, prayer.pk), context={"request": request}
    )
    code = status.HTTP_201_CREATED if changed else status.HTTP_200_OK
    return Response(output.data, code)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def stop(request, pk):
    prayer = _load_prayer(pk)
    viewing = can_view_prayer(request.user, prayer)
    praying_now = user_is_actively_praying(request.user, prayer.id)
    if not viewing and not praying_now:
        raise NotFound()
    stop_praying(request.user, prayer)
    refreshed = annotated_prayers(request.user).filter(pk=prayer.pk).first()
    if refreshed is None:
        return Response({"id": prayer.id, "is_praying": False})
    output = PrayerRequestSerializer(refreshed, context={"request": request})
    return Response(output.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def pass_on_prayer(request, pk):
    prayer = _visible_prayer(request.user, pk)
    pass_prayer(request.user, prayer)
    return Response({"id": prayer.id, "passed": True})


def _chat_prayer(user, pk):
    prayer = _load_prayer(pk)
    if can_access_prayer_chat(user, prayer):
        return prayer
    if not can_view_prayer(user, prayer) and not user_is_actively_praying(user, prayer.id):
        raise NotFound()
    if user_is_actively_praying(user, prayer.id):
        raise PermissionDenied("You can't open this prayer chat.")
    raise PermissionDenied("Join this prayer to open the chat.")


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def prayer_chat(request, pk):
    prayer = _chat_prayer(request.user, pk)
    if request.method == "GET":
        return Response(chat_payload(prayer, request.user))
    message = post_message(request.user, prayer, request.data.get("message"))
    from chat.serializers import MessageSerializer

    return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def report_prayer(request, pk):
    prayer = _visible_prayer(request.user, pk)
    return file_report(
        request,
        target_type="prayer_request",
        target_id=prayer.id,
        reported_user=prayer.author,
        snapshot=f"{prayer.title}: {prayer.details}",
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def report_prayer_message(request, pk, message_id):
    prayer = _chat_prayer(request.user, pk)
    message = get_object_or_404(
        Message.objects.select_related("sender"),
        pk=message_id,
        conversation__prayer_request=prayer,
    )
    if message.sender_id in blocked_user_ids(request.user):
        raise NotFound()
    return file_report(
        request,
        target_type="prayer_message",
        target_id=message.id,
        reported_user=message.sender,
        snapshot=message.text,
    )
