from django.urls import path

from . import direct_views, views

urlpatterns = [
    path("direct/", direct_views.direct_conversations, name="direct-conversations"),
    path("direct/<int:conversation_id>/mute/", direct_views.direct_mute, name="direct-mute"),
    path("direct/<int:conversation_id>/leave/", direct_views.direct_leave, name="direct-leave"),
    path("direct/<int:conversation_id>/report/", direct_views.direct_report, name="direct-report"),
    path("direct/<int:conversation_id>/block/", direct_views.direct_block, name="direct-block"),
    path("conversations/", views.ConversationListView.as_view(), name="conversation-list"),
    path(
        "conversations/<int:conversation_id>/messages/",
        views.MessageListView.as_view(),
        name="message-list",
    ),
]
