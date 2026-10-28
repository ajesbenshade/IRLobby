from django.urls import path

from . import circle_views as views

urlpatterns = [
    path("", views.CircleListCreateView.as_view(), name="circle-list"),
    path("invites/", views.my_circle_invites, name="circle-invite-inbox"),
    path(
        "invites/<int:invite_id>/accept/",
        views.accept_circle_invite,
        name="circle-invite-accept",
    ),
    path(
        "invites/<int:invite_id>/decline/",
        views.decline_circle_invite,
        name="circle-invite-decline",
    ),
    path("<int:pk>/", views.CircleDetailView.as_view(), name="circle-detail"),
    path("<int:pk>/join/", views.join_circle, name="circle-join"),
    path("<int:pk>/leave/", views.leave_circle_view, name="circle-leave"),
    path("<int:pk>/join-requests/", views.circle_join_requests, name="circle-join-requests"),
    path(
        "<int:pk>/join-requests/<int:request_id>/approve/",
        views.approve_circle_join_request,
        name="circle-join-request-approve",
    ),
    path(
        "<int:pk>/join-requests/<int:request_id>/decline/",
        views.decline_circle_join_request,
        name="circle-join-request-decline",
    ),
    path("<int:pk>/invites/", views.circle_invites, name="circle-invites"),
    path("<int:pk>/members/", views.circle_members, name="circle-members"),
    path(
        "<int:pk>/members/<int:user_id>/remove/",
        views.remove_circle_member,
        name="circle-member-remove",
    ),
    path(
        "<int:pk>/members/<int:user_id>/make-admin/",
        views.make_circle_admin,
        name="circle-member-make-admin",
    ),
    path(
        "<int:pk>/members/<int:user_id>/remove-admin/",
        views.remove_circle_admin,
        name="circle-member-remove-admin",
    ),
    path("<int:pk>/people/", views.circle_people, name="circle-people"),
    path("<int:pk>/report/", views.report_circle, name="circle-report"),
]
