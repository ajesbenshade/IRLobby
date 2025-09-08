from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('profile/', views.UserProfileView.as_view(), name='user-profile'),
    path('register/', views.register, name='user-register'),
    path('login/', views.login, name='user-login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('<int:pk>/', views.UserDetailView.as_view(), name='user-detail'),
    path('<int:pk>/attended-activities/', views.user_attended_activities, name='user-attended-activities'),
    path('search/', views.user_search, name='user-search'),
    path('logout/', views.logout_view, name='user-logout'),
    # Temporary notifications endpoints
    path('notifications/', views.notifications_list, name='notifications-list'),
    path('notifications/<int:pk>/', views.notification_detail, name='notification-detail'),
    path('notifications/mark-all-read/', views.mark_all_notifications_read, name='mark-all-read'),
    path('notifications/unread-count/', views.notifications_unread_count, name='unread-count'),
    # Temporary friends endpoints
    path('friends/', views.friends_list, name='friends-list'),
    path('friends/requests/', views.friend_requests, name='friend-requests'),
    path('friends/request/', views.send_friend_request, name='send-friend-request'),
    # Temporary activity templates endpoint
    path('activity-templates/', views.activity_templates, name='activity-templates'),
]
