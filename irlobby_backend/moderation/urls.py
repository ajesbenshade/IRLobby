from django.urls import path

from . import views

urlpatterns = [
    path("blocked/", views.BlockedUserListView.as_view(), name="blocked-list"),
    path("block/<int:user_id>/", views.block_user, name="block-user"),
    path("unblock/<int:user_id>/", views.unblock_user, name="unblock-user"),
    path("report/", views.AbuseReportCreateView.as_view(), name="abuse-report"),
]
