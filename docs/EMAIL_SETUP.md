# Email / SMTP Setup

This document covers configuration of the Django email subsystem and a
convenience command for verifying delivery.

## Gmail

1. Enable **2‑step verification** on your Google account.
2. Go to *Security → App passwords* and create a new password for “Mail”.
3. Add the following to your `.env` (or the environment variables of your
deployment target):

```bash
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=you@gmail.com
EMAIL_HOST_PASSWORD=<app-password>
DEFAULT_FROM_EMAIL=you@gmail.com
```

Gmail may impose send limits; use a transactional email provider for
heavier workloads.

## Free / Third‑party SMTP providers

Providers such as SendGrid, Mailgun, or Mailjet offer free tiers. The
required environment variables are analogous to the Gmail example; consult
the provider's documentation for the correct `EMAIL_HOST`, port, and auth
details.  The same `EMAIL_BACKEND` value (`smtp.EmailBackend`) applies.

## Development

For local development when you don't want outbound mail:

```bash
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

All messages will be printed to the console instead of being sent.

## Testing the setup

After configuring the environment, the following management command can be
used to exercise the settings:

```bash
python manage.py smtp_test_email --to someone@example.com \
    --subject "hello"
```

It will display a success message on delivery or an error message if the
SMTP handshake fails.

> See `irlobby_backend/users/management/commands/smtp_test_email.py`
> for the implementation.
