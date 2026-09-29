from django.urls import path

from . import foyer_views, views

urlpatterns = [
    path("", views.ActivityListCreateView.as_view(), name="activity-list"),
    path("<int:pk>/", views.ActivityDetailView.as_view(), name="activity-detail"),
    path("hosted/", views.HostedActivitiesView.as_view(), name="hosted-activities"),
    path("gatherings/", views.GatheringsView.as_view(), name="activity-gatherings"),
    path("<int:pk>/rsvp/", foyer_views.rsvp_activity, name="activity-rsvp"),
    path("<int:pk>/give/", foyer_views.ActivityGiftView.as_view(), name="activity-give"),
    path("<int:pk>/photos/", foyer_views.upload_event_photo, name="activity-photos"),
    path(
        "<int:pk>/calendar/approve/",
        foyer_views.approve_church_calendar,
        name="activity-calendar-approve",
    ),
    path("<int:pk>/join/", views.join_activity, name="join-activity"),
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
