from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from users.models import User

from .models import BlockedUser
from .serializers import AbuseReportSerializer, BlockedUserSerializer


class BlockedUserListView(generics.ListAPIView):
    serializer_class = BlockedUserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BlockedUser.objects.filter(blocker=self.request.user)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def block_user(request, user_id):
    target = get_object_or_404(User, pk=user_id)
    if target == request.user:
        return Response(
            {"detail": "You cannot block yourself."}, status=status.HTTP_400_BAD_REQUEST
        )
    _, created = BlockedUser.objects.get_or_create(blocker=request.user, blocked=target)
    if not created:
        return Response({"detail": "User already blocked."}, status=status.HTTP_200_OK)
    return Response({"detail": "User blocked."}, status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def unblock_user(request, user_id):
    deleted, _ = BlockedUser.objects.filter(blocker=request.user, blocked_id=user_id).delete()
    if not deleted:
        return Response({"detail": "User was not blocked."}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


class AbuseReportCreateView(generics.CreateAPIView):
    serializer_class = AbuseReportSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user)
