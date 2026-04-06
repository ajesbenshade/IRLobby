from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Invite, PushDeviceToken, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "is_active",
        "is_staff",
        "date_joined",
    )
    search_fields = ("username", "email", "first_name", "last_name")
    list_filter = ("is_active", "is_staff", "date_joined")
    actions = ["deactivate_users", "activate_users"]

    @admin.action(description="Deactivate selected users")
    def deactivate_users(self, request, queryset):
        queryset.update(is_active=False)

    @admin.action(description="Activate selected users")
    def activate_users(self, request, queryset):
        queryset.update(is_active=True)


@admin.register(Invite)
class InviteAdmin(admin.ModelAdmin):
    list_display = ("inviter", "contact_value", "channel", "status", "created_at")
    search_fields = ("inviter__username", "contact_value")
    list_filter = ("status", "channel", "created_at")
    raw_id_fields = ("inviter", "invitee")


@admin.register(PushDeviceToken)
class PushDeviceTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "platform", "is_active", "last_seen_at")
    search_fields = ("user__username", "token")
    list_filter = ("platform", "is_active")
    raw_id_fields = ("user",)
