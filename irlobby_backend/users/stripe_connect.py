"""Stripe Connect helpers for marketplace ticket payouts."""

from __future__ import annotations

import logging
from decimal import Decimal

import stripe
from django.conf import settings

logger = logging.getLogger(__name__)


class StripeConnectError(Exception):
    """Raised when Connect account operations fail."""


def get_stripe_client() -> stripe.StripeClient:
    api_key = (settings.STRIPE_API_KEY or "").strip()
    if not api_key:
        raise StripeConnectError("Stripe is not configured (missing STRIPE_API_KEY).")
    return stripe.StripeClient(api_key)


def host_can_receive_payouts(user) -> bool:
    return bool(
        getattr(user, "stripe_connect_account_id", "")
        and getattr(user, "stripe_connect_payouts_enabled", False)
    )


def platform_fee_amount_cents(ticket_price, fee_percent=None) -> int:
    price = Decimal(str(ticket_price))
    percent = Decimal(
        str(
            fee_percent
            if fee_percent is not None
            else getattr(settings, "STRIPE_PLATFORM_FEE_PERCENT", 10)
        )
    )
    return int((price * percent / Decimal("100") * Decimal("100")).quantize(Decimal("1")))


def sync_connect_account_status(user) -> dict:
    """Refresh local Connect flags from Stripe Accounts v2."""
    account_id = (user.stripe_connect_account_id or "").strip()
    if not account_id:
        return {
            "connected": False,
            "payoutsEnabled": False,
            "detailsSubmitted": False,
            "accountId": None,
            "onboardingComplete": False,
        }

    client = get_stripe_client()
    account = client.v2.core.accounts.retrieve(
        account_id,
        params={
            "include": [
                "configuration.recipient",
                "requirements",
                "identity",
            ]
        },
    )

    recipient = getattr(getattr(account, "configuration", None), "recipient", None)
    capabilities = getattr(recipient, "capabilities", None) if recipient else None
    stripe_balance = getattr(capabilities, "stripe_balance", None) if capabilities else None
    transfers = (
        getattr(stripe_balance, "stripe_transfers", None) if stripe_balance else None
    )
    transfers_status = getattr(transfers, "status", None) if transfers else None
    payouts_enabled = transfers_status == "active"

    requirements = getattr(account, "requirements", None)
    currently_due = list(getattr(requirements, "currently_due", None) or [])
    details_submitted = len(currently_due) == 0 and bool(account_id)

    # Prefer Stripe's own summary when available.
    entries = getattr(requirements, "entries", None)
    if entries is not None and hasattr(entries, "__iter__"):
        # If there are still outstanding requirement entries, treat as incomplete.
        outstanding = [
            entry
            for entry in entries
            if getattr(getattr(entry, "minimum_deadline", None), "status", None)
            in {"currently_due", "past_due"}
            or getattr(entry, "status", None) in {"currently_due", "past_due"}
        ]
        if outstanding:
            details_submitted = False

    user.stripe_connect_payouts_enabled = payouts_enabled
    user.stripe_connect_details_submitted = details_submitted or payouts_enabled
    user.save(
        update_fields=[
            "stripe_connect_payouts_enabled",
            "stripe_connect_details_submitted",
        ]
    )

    return {
        "connected": True,
        "payoutsEnabled": payouts_enabled,
        "detailsSubmitted": user.stripe_connect_details_submitted,
        "accountId": account_id,
        "onboardingComplete": payouts_enabled,
    }


def ensure_connect_account(user) -> str:
    """Create an Accounts v2 recipient account if the host doesn't have one."""
    existing = (user.stripe_connect_account_id or "").strip()
    if existing:
        return existing

    client = get_stripe_client()
    email = (user.email or "").strip() or f"user{user.id}@irlobby.app"
    display_name = (
        f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
        or user.username
        or f"Host {user.id}"
    )
    country = (getattr(settings, "STRIPE_CONNECT_COUNTRY", "US") or "US").upper()

    account = client.v2.core.accounts.create(
        {
            "contact_email": email,
            "display_name": display_name[:150],
            "dashboard": "express",
            "identity": {"country": country.lower()},
            "defaults": {
                "responsibilities": {
                    "fees_collector": "application",
                    "losses_collector": "application",
                }
            },
            "configuration": {
                "recipient": {
                    "capabilities": {
                        "stripe_balance": {
                            "stripe_transfers": {"requested": True},
                        }
                    }
                }
            },
            "include": ["configuration.recipient", "identity", "requirements"],
        }
    )

    account_id = account.id
    user.stripe_connect_account_id = account_id
    user.stripe_connect_payouts_enabled = False
    user.stripe_connect_details_submitted = False
    user.save(
        update_fields=[
            "stripe_connect_account_id",
            "stripe_connect_payouts_enabled",
            "stripe_connect_details_submitted",
        ]
    )
    logger.info("Created Stripe Connect account %s for user %s", account_id, user.id)
    return account_id


def create_connect_onboarding_link(user, *, return_url=None, refresh_url=None) -> str:
    account_id = ensure_connect_account(user)
    client = get_stripe_client()
    return_url = return_url or settings.STRIPE_CONNECT_RETURN_URL
    refresh_url = refresh_url or settings.STRIPE_CONNECT_REFRESH_URL

    link = client.v2.core.account_links.create(
        {
            "account": account_id,
            "use_case": {
                "type": "account_onboarding",
                "account_onboarding": {
                    "configurations": ["recipient"],
                    "return_url": return_url,
                    "refresh_url": refresh_url,
                },
            },
        }
    )
    url = getattr(link, "url", None) or (link.get("url") if isinstance(link, dict) else None)
    if not url:
        raise StripeConnectError("Stripe did not return an onboarding URL.")
    return url
