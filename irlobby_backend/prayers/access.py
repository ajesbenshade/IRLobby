"""Who may see a prayer request, and who may open its chat.

Whole-church requests are visible to anyone whose user.church is that church.
Otherwise only members of the chosen circles, plus the author, can see it.
Nothing here is public. The author is always the signed-in user (never anonymous).
"""

from __future__ import annotations

from django.db.models import Count, Exists, OuterRef, Q

from users.social import blocked_user_ids, is_blocked_either_way

from .models import CircleMembership, PrayerParticipant, PrayerPass, PrayerRequest


def user_is_actively_praying(user, prayer_id) -> bool:
    return PrayerParticipant.objects.filter(
        prayer_request_id=prayer_id,
        user=user,
        status=PrayerParticipant.STATUS_PRAYING,
    ).exists()


def can_view_prayer(user, prayer) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if prayer.author_id == user.id:
        return True
    if is_blocked_either_way(user.id, prayer.author_id):
        return False
    if prayer.whole_church and user.church_id and user.church_id == prayer.church_id:
        return True
    return CircleMembership.objects.filter(user=user, circle__prayer_requests=prayer).exists()


def can_access_prayer_chat(user, prayer) -> bool:
    """I'm praying, and not blocked either way with the author."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if not user_is_actively_praying(user, prayer.id):
        return False
    if user.id != prayer.author_id and is_blocked_either_way(user.id, prayer.author_id):
        return False
    return True


def visible_prayer_ids(user):
    circle_ids = CircleMembership.objects.filter(user=user).values("circle_id")
    visibility = Q(author=user)
    if user.church_id:
        visibility |= Q(whole_church=True, church_id=user.church_id)
    visibility |= Q(whole_church=False, circles__in=circle_ids)
    blocked = blocked_user_ids(user)
    return (
        PrayerRequest.objects.filter(visibility)
        .exclude(author_id__in=blocked)
        .values("id")
        .distinct()
    )


def readable_prayer_ids(user):
    """Visible requests, plus ones you are still praying for after leaving a circle."""
    blocked = blocked_user_ids(user)
    praying = PrayerParticipant.objects.filter(
        user=user, status=PrayerParticipant.STATUS_PRAYING
    ).values("prayer_request_id")
    return (
        PrayerRequest.objects.filter(Q(id__in=visible_prayer_ids(user)) | Q(id__in=praying))
        .exclude(author_id__in=blocked)
        .values("id")
    )


def annotated_prayers(user):
    return (
        PrayerRequest.objects.filter(id__in=readable_prayer_ids(user))
        .select_related("author", "conversation")
        .prefetch_related("circles")
        .annotate(
            praying_count=Count(
                "participants",
                filter=Q(participants__status=PrayerParticipant.STATUS_PRAYING),
            ),
            viewer_is_praying=Exists(
                PrayerParticipant.objects.filter(
                    prayer_request=OuterRef("pk"),
                    user_id=user.id,
                    status=PrayerParticipant.STATUS_PRAYING,
                )
            ),
        )
    )


def discover_feed(user):
    """Cards for Discover: visible, not yours, not passed, not already praying."""
    passed = PrayerPass.objects.filter(user=user).values("prayer_request_id")
    return (
        annotated_prayers(user)
        .filter(id__in=visible_prayer_ids(user))
        .exclude(author=user)
        .exclude(id__in=passed)
        .exclude(viewer_is_praying=True)
        .order_by("-created_at", "-id")
    )


def active_feed(user):
    """Prayer tab, Active: requests you are currently praying for."""
    return annotated_prayers(user).filter(viewer_is_praying=True).order_by("-created_at", "-id")


def mine_feed(user):
    """Prayer tab, Mine: requests you authored."""
    return annotated_prayers(user).filter(author=user).order_by("-created_at", "-id")
