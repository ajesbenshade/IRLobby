from django.urls import path
from . import views

urlpatterns = [
    path('', views.ReviewListCreateView.as_view(), name='review-list'),
    path('activity/<int:activity_id>/', views.activity_reviews, name='activity-reviews'),
]
