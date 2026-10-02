from django.urls import path

from . import social_views

urlpatterns = [
    path("", social_views.friend_list, name="friend-list"),
    path("birthdays/", social_views.friend_birthdays, name="friend-birthdays"),
    path("requests/", social_views.friend_requests, name="friend-requests"),
    path(
        "requests/<int:request_id>/accept/",
        social_views.accept_friend_request,
        name="friend-request-accept",
    ),
    path(
        "requests/<int:request_id>/decline/",
        social_views.decline_friend_request,
        name="friend-request-decline",
    ),
    path("<int:user_id>/", social_views.friend_remove, name="friend-remove"),
]
