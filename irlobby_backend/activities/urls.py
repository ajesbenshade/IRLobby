from django.urls import path

from . import approval, foyer_views, views

urlpatterns = [
    path("", views.ActivityListCreateView.as_view(), name="activity-list"),
    path("hosted/", views.HostedActivitiesView.as_view(), name="hosted-activities"),
    path("going/", foyer_views.GoingActivitiesView.as_view(), name="going-activities"),
    path("<int:pk>/", views.ActivityDetailView.as_view(), name="activity-detail"),
    path("<int:pk>/join/", views.join_activity, name="join-activity"),
    path("<int:pk>/rsvp/", foyer_views.rsvp_activity, name="activity-rsvp"),
    path("<int:pk>/rsvp/cancel/", foyer_views.cancel_rsvp, name="activity-rsvp-cancel"),
    path("<int:pk>/cancel-event/", foyer_views.cancel_event, name="activity-cancel-event"),
    path("<int:pk>/requests/", approval.activity_requests, name="activity-requests"),
    path(
        "<int:pk>/requests/<int:participant_id>/approve/",
        approval.approve_request,
        name="activity-request-approve",
    ),
    path(
        "<int:pk>/requests/<int:participant_id>/decline/",
        approval.decline_request,
        name="activity-request-decline",
    ),
    path("<int:pk>/attendees/", foyer_views.activity_attendees, name="activity-attendees"),
    path("<int:pk>/whos-coming/", foyer_views.whos_coming, name="activity-whos-coming"),
    path(
        "<int:pk>/calendar/approve/",
        foyer_views.approve_church_calendar,
        name="activity-calendar-approve",
    ),
    path("<int:pk>/photos/", foyer_views.upload_event_photo, name="activity-photo-upload"),
    path("<int:pk>/photos/download/", foyer_views.photo_downloads, name="activity-photo-downloads"),
    path(
        "<int:pk>/photos/<int:photo_id>/download/",
        foyer_views.event_photo_download_file,
        name="activity-photo-download-file",
    ),
    path(
        "<int:pk>/photos/<int:photo_id>/",
        foyer_views.event_photo_file,
        name="activity-photo-file",
    ),
    path(
        "<int:pk>/photos/<int:photo_id>/delete/",
        foyer_views.delete_event_photo,
        name="activity-photo-delete",
    ),
    path("<int:pk>/leave/", views.leave_activity, name="leave-activity"),
    path(
        "<int:pk>/participants/<int:user_id>/",
        views.remove_activity_participant,
        name="remove-activity-participant",
    ),
    path("<int:pk>/chat/", views.activity_chat, name="activity-chat"),
    path(
        "<int:pk>/buy-ticket/",
        views.ActivityTicketPurchaseView.as_view(),
        name="activity-ticket-buy",
    ),
    path("tickets/my/", views.UserTicketListView.as_view(), name="ticket-list"),
    path(
        "tickets/<uuid:ticket_id>/validate/",
        views.ValidateTicketView.as_view(),
        name="ticket-validate",
    ),
    path("payments/webhook/", views.StripeWebhookView.as_view(), name="stripe-webhook"),
]
