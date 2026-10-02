from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from activities.models import Activity
from chat.models import Conversation
from matches.models import Match
from moderation.models import BlockedUser
from users.push_notifications import send_new_match_notifications

from .models import Swipe
from .serializers import SwipeSerializer
from .throttles import SwipeRateThrottle, check_swipe_daily_limit


class SwipeListView(generics.ListCreateAPIView):
    serializer_class = SwipeSerializer
    permission_classes = [IsAuthenticated]
    throttle_classes = [SwipeRateThrottle]

    def get_queryset(self):
        return Swipe.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        activity = serializer.validated_data.get("activity")
        if activity is not None and activity.is_cancelled:
            raise ValidationError({"activity": "This gathering was cancelled by the host."})
        if Swipe.objects.filter(user=self.request.user, activity=activity).exists():
            raise ValidationError({"activity": "Already swiped on this activity"})
        check_swipe_daily_limit(self.request.user)
        serializer.save(user=self.request.user)


def _clear_swipe(request, pk):
    """Undo a pass (or like) so the card returns to the deck. Safe to repeat."""
    get_object_or_404(Activity, pk=pk)
    deleted, _ = Swipe.objects.filter(user=request.user, activity_id=pk).delete()
    return Response({"deleted": bool(deleted)}, status=status.HTTP_200_OK)


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
@throttle_classes([SwipeRateThrottle])
def swipe_activity(request, pk):
    if request.method == "DELETE":
        return _clear_swipe(request, pk)
    activity = get_object_or_404(Activity, pk=pk)
    user = request.user
    direction = request.data.get("direction")

    if activity.is_cancelled:
        return Response(
            {"error": "This gathering was cancelled by the host."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if direction not in ["left", "right"]:
        return Response({"error": "Invalid direction"}, status=status.HTTP_400_BAD_REQUEST)

    # Prevent swiping on activities from/by blocked users
    if (
        BlockedUser.objects.filter(blocker=user, blocked=activity.host).exists()
        or BlockedUser.objects.filter(blocker=activity.host, blocked=user).exists()
    ):
        return Response(
            {"error": "Cannot interact with this user"}, status=status.HTTP_403_FORBIDDEN
        )

    # Check if user already swiped on this activity
    existing_swipe = Swipe.objects.filter(user=user, activity=activity).first()
    if existing_swipe:
        return Response(
            {"error": "Already swiped on this activity"}, status=status.HTTP_400_BAD_REQUEST
        )

    check_swipe_daily_limit(user)

    with transaction.atomic():
        # Create the swipe
        _ = Swipe.objects.create(user=user, activity=activity, direction=direction)
        created_match = None
        created_conversation = None

        matched = False
        # If it's a right swipe, check for matches
        if direction == "right":
            # Check if the activity host swiped right on any activity by this user
            # This is a simplified matching logic - you might want to implement more complex logic
            host_right_swipes = Swipe.objects.filter(
                user=activity.host, direction="right"
            ).values_list("activity", flat=True)

            user_activities = Activity.objects.filter(host=user)

            for user_activity in user_activities:
                if user_activity.id in host_right_swipes:
                    # Create a match with deterministic user ordering
                    match_obj, created = Match.get_or_create_normalized(
                        activity=activity,
                        user_one=user,
                        user_two=activity.host,
                    )
                    matched = created  # Only consider it a new match if it was just created
                    if created:
                        created_match = match_obj
                        created_conversation, _ = Conversation.objects.get_or_create(
                            match=match_obj
                        )
                    break

    if created_match is not None:
        send_new_match_notifications(created_match)

    response_payload = {"message": f"Swiped {direction}", "matched": matched}
    if created_match is not None:
        response_payload["matchId"] = created_match.id
    if created_conversation is not None:
        response_payload["conversationId"] = created_conversation.id

    return Response(response_payload, status=status.HTTP_201_CREATED)
