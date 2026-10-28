from django.urls import path

from . import views

urlpatterns = [
    path("", views.PrayerListCreateView.as_view(), name="prayer-list"),
    path("active/", views.ActivePrayerListView.as_view(), name="prayer-active"),
    path("mine/", views.MinePrayerListView.as_view(), name="prayer-mine"),
    path("<int:pk>/", views.PrayerDetailView.as_view(), name="prayer-detail"),
    path("<int:pk>/pray/", views.pray, name="prayer-pray"),
    path("<int:pk>/stop/", views.stop, name="prayer-stop"),
    path("<int:pk>/pass/", views.pass_on_prayer, name="prayer-pass"),
    path("<int:pk>/chat/", views.prayer_chat, name="prayer-chat"),
    path("<int:pk>/report/", views.report_prayer, name="prayer-report"),
    path(
        "<int:pk>/chat/<int:message_id>/report/",
        views.report_prayer_message,
        name="prayer-chat-report",
    ),
]
