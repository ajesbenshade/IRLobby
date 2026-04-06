from django.contrib import admin

from .models import Activity, ActivityParticipant, Ticket, TicketRedemptionLog


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ("title", "host", "category", "is_approved", "time", "created_at")
    search_fields = ("title", "description", "host__username", "location")
    list_filter = ("is_approved", "category", "is_private", "is_ticketed", "created_at")
    raw_id_fields = ("host",)
    actions = ["approve_activities", "reject_activities"]

    @admin.action(description="Approve selected activities")
    def approve_activities(self, request, queryset):
        queryset.update(is_approved=True)

    @admin.action(description="Reject (unapprove) selected activities")
    def reject_activities(self, request, queryset):
        queryset.update(is_approved=False)


@admin.register(ActivityParticipant)
class ActivityParticipantAdmin(admin.ModelAdmin):
    list_display = ("user", "activity", "status", "joined_at")
    search_fields = ("user__username", "activity__title")
    list_filter = ("status",)
    raw_id_fields = ("user", "activity")


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ("ticket_id", "buyer", "activity", "status", "purchased_at", "created_at")
    search_fields = ("ticket_id", "buyer__username", "activity__title")
    list_filter = ("status", "created_at")
    raw_id_fields = ("buyer", "activity")


@admin.register(TicketRedemptionLog)
class TicketRedemptionLogAdmin(admin.ModelAdmin):
    list_display = ("ticket", "host", "successful", "scanned_at")
    search_fields = ("ticket__ticket_id", "host__username")
    list_filter = ("successful", "scanned_at")
    raw_id_fields = ("ticket", "activity", "host")
