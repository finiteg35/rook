import hashlib
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models.alert import Alert
from ..models.monitor import Monitor
from ..models.user import User
from ..openclaw import openclaw_client
from ..notifications.email import send_email
from ..notifications.telegram import send_telegram

logger = logging.getLogger(__name__)


def _hash_content(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


async def _notify_user(user: User, title: str, message: str) -> None:
    notify_email = user.notification_email or user.email
    await send_email(notify_email, title, f"<p>{message}</p>")
    if user.telegram_chat_id:
        await send_telegram(user.telegram_chat_id, f"<b>{title}</b>\n{message}")


async def run_pagespy(monitor_id: int, db: Session) -> None:
    """
    Check a URL for content changes.
    config: {"url": str, "check_interval_hours": int}
    """
    monitor: Monitor | None = db.get(Monitor, monitor_id)
    if not monitor or not monitor.is_active:
        return

    url: str = (monitor.config or {}).get("url", "")
    if not url:
        logger.warning("PageSpy monitor %d has no URL configured", monitor_id)
        return

    user: User | None = db.get(User, monitor.user_id)
    if not user:
        return

    try:
        result = await openclaw_client.browse_url(url)
        content: str = result.get("content", "")
        title_fetched: str = result.get("title", url)

        current_hash = _hash_content(content)
        previous_hash = monitor.last_state

        now = datetime.now(timezone.utc)

        if previous_hash is not None and current_hash != previous_hash:
            alert_title = f"Page Changed: {monitor.name}"
            alert_message = f'The page "{title_fetched}" at {url} has changed since your last check.'

            alert = Alert(
                monitor_id=monitor.id,
                user_id=monitor.user_id,
                title=alert_title,
                message=alert_message,
                data={"url": url, "page_title": title_fetched},
            )
            db.add(alert)

            monitor.last_alert_at = now
            monitor.status = "alert"

            await _notify_user(user, alert_title, alert_message)
        else:
            monitor.status = "ok"

        monitor.last_state = current_hash
        monitor.last_checked = now
        db.commit()
    except Exception as exc:
        logger.error("PageSpy monitor %d failed: %s", monitor_id, exc)
        monitor.status = "error"
        monitor.last_checked = datetime.now(timezone.utc)
        db.commit()
