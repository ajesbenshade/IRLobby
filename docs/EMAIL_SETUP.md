# Email / SMTP Setup

This document covers configuration of the Django email subsystem. It also covers a command that verifies delivery.

## Gmail

1. Enable **2-step verification** on your Google account.
2. Open *Security → App passwords* and create a new password for "Mail".
3. Add these values to your `.env` file (or to the environment variables of your deployment target):

```bash
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=you@gmail.com
EMAIL_HOST_PASSWORD=<app-password>
DEFAULT_FROM_EMAIL=you@gmail.com
```

Gmail can impose send limits. Use a transactional email provider for higher volume.

## Free / third-party SMTP providers

Providers such as SendGrid, Mailgun, or Mailjet offer free tiers. The required environment variables are similar to the Gmail example. Read the provider documentation for the correct `EMAIL_HOST`, port, and auth details. Use the same `EMAIL_BACKEND` value (`smtp.EmailBackend`).

## Development

For local development when you do not want outbound mail:

```bash
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

All messages print to the console. The system does not send them.

## Testing the setup

After you configure the environment, run this management command:

```bash
python manage.py smtp_test_email --to someone@example.com \
    --subject "hello"
```

The command shows a success message on delivery. It shows an error message if the SMTP handshake fails.

See `irlobby_backend/users/management/commands/smtp_test_email.py` for the implementation.
