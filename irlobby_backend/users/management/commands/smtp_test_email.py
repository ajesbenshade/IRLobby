from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Send a simple test email to verify SMTP/EMAIL_BACKEND settings"

    def add_arguments(self, parser):
        parser.add_argument(
            "--to",
            "-t",
            help="Recipient email address",
            required=True,
        )
        parser.add_argument(
            "--subject",
            "-s",
            help="Subject line for the test message",
            default="IRLobby test email",
        )

    def handle(self, *args, **options):
        recipient = options["to"]
        subject = options["subject"]

        message = "This is a test message sent by the " "smtp_test_email management command."

        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None)

        try:
            send_mail(subject, message, from_email, [recipient])
            self.stdout.write(self.style.SUCCESS(f"Email sent to {recipient}"))
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"Error sending email: {exc}"))
