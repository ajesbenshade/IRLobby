"""Stripe Connect helpers for host payouts and gathering gifts.

Onboarding creates an Accounts v2 **Express** account (`dashboard: "express"`), not a
Standard account (`dashboard: "full"`). Until merchant `card_payments` is requested,
the account is recipient-only (`stripe_transfers` + `payouts`) and can receive
destination charges, not direct charges. Existing hosts created that way need to
re-onboard so merchant configuration can be added. `fees_collector` and
`losses_collector` stay `application` (they cannot be changed later). Direct gift
charges set `application_fee_amount` to 0.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from urllib.parse import urlparse

import stripe
from django.conf import settings

from utils.client_urls import to_stripe_https_return_url

logger = logging.getLogger(__name__)


class StripeConnectError(Exception):
    """Raised when Connect account operations fail."""


def _configured_stripe_api_key() -> str:
    return (getattr(settings, "STRIPE_API_KEY", "") or "").strip()


def assert_test_mode_api_key(api_key: str) -> None:
    """Reject live-mode keys until STRIPE_ALLOW_LIVE_MODE is explicitly enabled."""
    if api_key.startswith(("sk_live_", "rk_live_")) and not getattr(
        settings, "STRIPE_ALLOW_LIVE_MODE", False
    ):
        raise StripeConnectError(
            "Live Stripe keys are blocked. Set a sk_test_ / rk_test_ key "
            "and keep STRIPE_ALLOW_LIVE_MODE=False until live charges are approved."
        )


def get_stripe_client() -> stripe.StripeClient:
    api_key = _configured_stripe_api_key()
    if not api_key:
        raise StripeConnectError("Stripe is not configured (missing STRIPE_API_KEY).")
    assert_test_mode_api_key(api_key)
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


def _require_http_url(url: str, label: str) -> str:
    rewritten = to_stripe_https_return_url(url)
    placeholder_safe = (rewritten or "").replace("{CHECKOUT_SESSION_ID}", "cs_placeholder")
    parsed = urlparse(placeholder_safe)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise StripeConnectError(
            f"{label} must be an http(s) URL for Stripe. "
            "Use the IRLobby app scheme or https://api.irlobby.com/… bounce pages."
        )
    return rewritten


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
    transfers = getattr(stripe_balance, "stripe_transfers", None) if stripe_balance else None
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
                # Merchant card_payments is required for direct charges (gifts).
                # Recipient transfers keep the legacy destination-charge path working.
                "merchant": {
                    "capabilities": {
                        "card_payments": {"requested": True},
                    }
                },
                "recipient": {
                    "capabilities": {
                        "stripe_balance": {
                            "stripe_transfers": {"requested": True},
                            # SDK TypedDict lags Accounts v2; payouts is a valid recipient cap.
                            "payouts": {"requested": True},  # type: ignore[typeddict-unknown-key]
                        }
                    }
                },
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


def ensure_direct_charge_capability(account_id: str) -> None:
    """Request merchant card_payments on an existing Express account.

    Recipient-only accounts created before this change cannot take direct charges
    until Stripe accepts this update and the host finishes any new requirements.
    Responsibilities are left unchanged because Stripe does not allow editing them.
    """
    client = get_stripe_client()
    client.v2.core.accounts.update(
        account_id,
        {
            "configuration": {
                "merchant": {
                    "capabilities": {
                        "card_payments": {"requested": True},
                    }
                }
            }
        },
    )


def create_connect_onboarding_link(user, *, return_url=None, refresh_url=None) -> str:
    account_id = ensure_connect_account(user)
    try:
        ensure_direct_charge_capability(account_id)
    except Exception:
        logger.exception(
            "Could not request direct-charge capability for Stripe account %s", account_id
        )
    client = get_stripe_client()
    return_url = _require_http_url(
        return_url or settings.STRIPE_CONNECT_RETURN_URL,
        "Connect return URL",
    )
    refresh_url = _require_http_url(
        refresh_url or settings.STRIPE_CONNECT_REFRESH_URL,
        "Connect refresh URL",
    )

    link = client.v2.core.account_links.create(
        {
            "account": account_id,
            "use_case": {
                "type": "account_onboarding",
                "account_onboarding": {
                    "configurations": ["merchant", "recipient"],
                    "return_url": return_url,
                    "refresh_url": refresh_url,
                },
            },
        }
    )
    url = getattr(link, "url", None)
    if not url and isinstance(link, dict):
        url = link.get("url")
    if not url:
        raise StripeConnectError("Stripe did not return an onboarding URL.")
    return url


def create_destination_checkout_session(
    *,
    activity,
    ticket,
    host,
    success_url: str,
    cancel_url: str,
    application_fee_amount: int,
    fee_percent,
):
    """Create a Checkout Session that destination-charges the connected host."""
    client = get_stripe_client()
    success_url = _require_http_url(success_url, "Checkout success URL")
    cancel_url = _require_http_url(cancel_url, "Checkout cancel URL")
    unit_amount = int((Decimal(str(activity.ticket_price)) * Decimal("100")).quantize(Decimal("1")))

    return client.v1.checkout.sessions.create(
        {
            "mode": "payment",
            "line_items": [
                {
                    "price_data": {
                        "currency": (activity.currency or "usd").lower(),
                        "product_data": {
                            "name": f"Ticket for {activity.title}",
                            "description": (activity.description or "")[:200],
                        },
                        "unit_amount": unit_amount,
                    },
                    "quantity": 1,
                }
            ],
            "payment_intent_data": {
                "application_fee_amount": application_fee_amount,
                "transfer_data": {
                    "destination": host.stripe_connect_account_id,
                },
                "metadata": {
                    "ticket_id": str(ticket.ticket_id),
                    "activity_id": str(activity.id),
                    "host_id": str(host.id),
                },
            },
            "metadata": {
                "ticket_id": str(ticket.ticket_id),
                "activity_id": str(activity.id),
                "host_id": str(host.id),
                "platform_fee_percent": str(fee_percent),
            },
            "success_url": success_url,
            "cancel_url": cancel_url,
        }
    )


def create_direct_checkout_session(
    *,
    connected_account_id: str,
    unit_amount: int,
    currency: str,
    product_name: str,
    description: str,
    success_url: str,
    cancel_url: str,
    metadata: dict,
):
    """Checkout Session charged on the connected account. Application fee is always 0."""
    client = get_stripe_client()
    success_url = _require_http_url(success_url, "Checkout success URL")
    cancel_url = _require_http_url(cancel_url, "Checkout cancel URL")
    return client.v1.checkout.sessions.create(
        {
            "mode": "payment",
            "line_items": [
                {
                    "price_data": {
                        "currency": (currency or "usd").lower(),
                        "product_data": {
                            "name": product_name[:120],
                            "description": (description or "")[:200],
                        },
                        "unit_amount": unit_amount,
                    },
                    "quantity": 1,
                }
            ],
            "payment_intent_data": {
                "application_fee_amount": 0,
                "metadata": metadata,
            },
            "metadata": metadata,
            "success_url": success_url,
            "cancel_url": cancel_url,
        },
        {"stripe_account": connected_account_id},
    )
