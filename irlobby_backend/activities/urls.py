from django.urls import path
from . import views
from users.views import populate_test_data_api

urlpatterns = [
    path('', views.ActivityListCreateView.as_view(), name='activity-list'),
    path('<int:pk>/', views.ActivityDetailView.as_view(), name='activity-detail'),
    path('hosted/', views.HostedActivitiesView.as_view(), name='hosted-activities'),
    path('<int:pk>/join/', views.join_activity, name='join-activity'),
    path('<int:pk>/leave/', views.leave_activity, name='leave-activity'),
    path('<int:pk>/chat/', views.activity_chat, name='activity-chat'),
    path('<int:pk>/swipe/', views.swipe_activity, name='swipe-activity'),
    path('discover/', views.discover_activities, name='discover-activities'),
    # Temporary populate endpoint
    path('populate-test-data/', populate_test_data_api, name='populate-test-data'),
]
