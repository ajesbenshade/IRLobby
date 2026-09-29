"""Optional gifts. RSVP stays free; the platform fee is always zero."""

from __future__ import annotations

from activities.eligibility import host_display_name

FEE_NOTE = "Stripe's card fee applies. The Foyer takes no cut."
PERSONAL_GIFT_DISCLAIMER = (
    "This gift goes to {host_name} directly. It is not a tax-deductible gift to "
    "Franconia Mennonite Church."
)
CHURCH_GIFT_DISCLAIMER = "Your gift goes to {host_name}."


def gift_disclaimer(activity) -> str:
    host_name = host_display_name(activity)
    if activity.host_kind == "church":
        return CHURCH_GIFT_DISCLAIMER.format(host_name=host_name)
    return PERSONAL_GIFT_DISCLAIMER.format(host_name=host_name)


def giving_recipient_account_id(activity) -> str:
    """Connected account that should receive a direct charge, or empty when it cannot."""
    if not activity.donation_enabled:
        return ""
    if activity.host_kind == "church":
        church = activity.host_church
        if church is None:
            return ""
        return (church.stripe_account_id or "").strip()

    from users.stripe_connect import host_can_receive_payouts

    if not host_can_receive_payouts(activity.host):
        return ""
    return (activity.host.stripe_connect_account_id or "").strip()
