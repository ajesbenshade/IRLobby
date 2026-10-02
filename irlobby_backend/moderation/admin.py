from django.contrib import admin
from django.utils import timezone

from .models import AbuseReport, BlockedUser


@admin.register(BlockedUser)
class BlockedUserAdmin(admin.ModelAdmin):
    list_display = ("blocker", "blocked", "created_at")
    search_fields = ("blocker__username", "blocked__username")
    list_filter = ("created_at",)
    raw_id_fields = ("blocker", "blocked")


@admin.register(AbuseReport)
class AbuseReportAdmin(admin.ModelAdmin):
    list_display = (
        "reporter",
        "reported_user",
        "target_type",
        "target_id",
        "reason",
        "status",
        "created_at",
    )
    search_fields = (
        "reporter__username",
        "reported_user__username",
        "description",
        "target_snapshot",
    )
    list_filter = ("status", "target_type", "reason", "created_at")
    raw_id_fields = ("reporter", "reported_user", "resolved_by")
    readonly_fields = (
        "reporter",
        "reported_user",
        "reason",
        "description",
        "target_type",
        "target_id",
        "target_snapshot",
        "created_at",
    )
    actions = ["mark_resolved", "mark_dismissed"]

    @admin.action(description="Mark selected reports as resolved")
    def mark_resolved(self, request, queryset):
        queryset.update(status="resolved", resolved_at=timezone.now(), resolved_by=request.user)

    @admin.action(description="Dismiss selected reports")
    def mark_dismissed(self, request, queryset):
        queryset.update(status="dismissed", resolved_at=timezone.now(), resolved_by=request.user)
