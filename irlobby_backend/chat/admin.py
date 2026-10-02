from django.contrib import admin

from .models import Conversation, ConversationUserState, Message


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("match", "created_at")
    search_fields = ("match__user_a__username", "match__user_b__username")
    raw_id_fields = ("match",)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("sender", "conversation", "created_at")
    search_fields = ("sender__username", "text")
    list_filter = ("created_at",)
    raw_id_fields = ("sender", "conversation")


@admin.register(ConversationUserState)
class ConversationUserStateAdmin(admin.ModelAdmin):
    list_display = ("conversation", "user", "muted", "left")
    search_fields = ("user__username",)
    list_filter = ("muted", "left")
    raw_id_fields = ("conversation", "user")
