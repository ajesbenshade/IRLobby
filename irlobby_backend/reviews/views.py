from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from .models import Review
from .serializers import ReviewSerializer

class ReviewListCreateView(generics.ListCreateAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Review.objects.filter(
            Q(reviewer=user) | Q(reviewee=user)
        )

        role = self.request.query_params.get('role')
        if role == 'given':
            queryset = queryset.filter(reviewer=user)
        elif role == 'received':
            queryset = queryset.filter(reviewee=user)

        activity_id = self.request.query_params.get('activityId')
        if activity_id:
            queryset = queryset.filter(activity_id=activity_id)

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(reviewer=self.request.user)
