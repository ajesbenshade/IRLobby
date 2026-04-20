from django.db.models import Q
from moderation.models import BlockedUser
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Match
from .serializers import MatchSerializer


class MatchListView(generics.ListAPIView):
    serializer_class = MatchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        blocked_ids = BlockedUser.objects.filter(blocker=user).values_list("blocked_id", flat=True)
        blocked_by_ids = BlockedUser.objects.filter(blocked=user).values_list(
            "blocker_id", flat=True
        )
        exclude_ids = set(blocked_ids) | set(blocked_by_ids)

        return (
            Match.objects.filter(Q(user_a=user) | Q(user_b=user))
            .exclude(user_a_id__in=exclude_ids)
            .exclude(user_b_id__in=exclude_ids)
            .order_by("-created_at")
        )
