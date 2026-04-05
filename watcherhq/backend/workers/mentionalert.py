import json
import logging
from datetime import datetime, timezone
from typing import List

from sqlalchemy.orm import Session

from ..models.alert import Alert
from ..models.monitor import Monitor
from ..models.user import User
from ..openclaw import openclaw_client
from ..notifications.email import send_email
from ..notifications.telegram import send_telegram

logger = logging.getLogger(__name__)


async def _notify_user(user: User, title: str, message: str) -> None:
    notify_email = user.notification_email or user.email
    await send_email(notify_email, title, f"<p>{message}</p>")
    if user.telegram_chat_id:
        await send_telegram(user.telegram_chat_id, f"<b>{title}</b>\n{message}")


async def run_mentionalert(monitor_id: int, db: Session) -> None:
    """
    Watch for new web mentions of a keyword.
    config: {"keyword": str, "sources": list}
    """
    monitor: Monitor | None = db.get(Monitor, monitor_id)
    if not monitor or not monitor.is_active:
        return

    config = monitor.config or {}
    keyword: str = config.get("keyword", "")
    sources: List[str] = config.get("sources", [])

    if not keyword:
        logger.warning("MentionAlert monitor %d has no keyword configured", monitor_id)
        return

    user: User | None = db.get(User, monitor.user_id)
    if not user:
        return

    now = datetime.now(timezone.utc)

    try:
        result = await openclaw_client.find_mentions(keyword, sources)
        mentions = result.get("mentions", [])

        seen_urls: List[str] = json.loads(monitor.last_state) if monitor.last_state else []
        seen_set = set(seen_urls)

        new_mentions = [m for m in mentions if m.get("url") and m["url"] not in seen_set]

        for mention in new_mentions:
            title_str = mention.get("title", keyword)
            source_str = mention.get("source", "")
            url_str = mention.get("url", "")
            snippet = mention.get("snippet", "")

            alert_title = f'New Mention: "{keyword}"'
            alert_message = f'"{keyword}" was mentioned in "{title_str}" ({source_str}). {snippet} — {url_str}'

            alert = Alert(
                monitor_id=monitor.id,
                user_id=monitor.user_id,
                title=alert_title,
                message=alert_message,
                data=mention,
            )
            db.add(alert)
            seen_set.add(url_str)

            await _notify_user(user, alert_title, alert_message)

        if new_mentions:
            monitor.last_alert_at = now
            monitor.status = "alert"
        else:
            monitor.status = "ok"

        monitor.last_state = json.dumps(list(seen_set))
        monitor.last_checked = now
        db.commit()
    except Exception as exc:
        logger.error("MentionAlert monitor %d failed: %s", monitor_id, exc)
        monitor.status = "error"
        monitor.last_checked = datetime.now(timezone.utc)
        db.commit()
