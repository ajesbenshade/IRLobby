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
        return Review.objects.filter(
            Q(reviewer=user) | Q(reviewee=user)
        ).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(reviewer=self.request.user)
