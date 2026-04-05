import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from ..config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, body: str) -> bool:
    """Send an HTML email via SMTP. Returns True on success."""
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning("SMTP not configured; skipping email to %s", to)
        return False

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM or settings.SMTP_USER
    message["To"] = to
    message.attach(MIMEText(body, "html"))

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info("Email sent to %s | subject: %s", to, subject)
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)
        return False
