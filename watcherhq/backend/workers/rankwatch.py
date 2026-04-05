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

SIGNIFICANT_CHANGE = 3  # positions


async def _notify_user(user: User, title: str, message: str) -> None:
    notify_email = user.notification_email or user.email
    await send_email(notify_email, title, f"<p>{message}</p>")
    if user.telegram_chat_id:
        await send_telegram(user.telegram_chat_id, f"<b>{title}</b>\n{message}")


async def run_rankwatch(monitor_id: int, db: Session) -> None:
    """
    Track search engine ranking for a domain/keyword pair.
    config: {"domain": str, "keyword": str}
    """
    monitor: Monitor | None = db.get(Monitor, monitor_id)
    if not monitor or not monitor.is_active:
        return

    config = monitor.config or {}
    domain: str = config.get("domain", "")
    keyword: str = config.get("keyword", "")

    if not domain or not keyword:
        logger.warning("RankWatch monitor %d missing domain or keyword", monitor_id)
        return

    user: User | None = db.get(User, monitor.user_id)
    if not user:
        return

    now = datetime.now(timezone.utc)

    try:
        result = await openclaw_client.check_ranking(domain, keyword)
        position: int | None = result.get("position")
        ranked_url: str = result.get("url", "")

        previous_position: int | None = int(monitor.last_state) if monitor.last_state else None

        if position is not None:
            alert_title = f"Weekly Rank Report: {domain}"
            alert_message = (
                f'{domain} ranks #{position} for "{keyword}". URL: {ranked_url}'
            )
            notify = True

            if previous_position is not None:
                diff = previous_position - position  # positive = improved
                if abs(diff) >= SIGNIFICANT_CHANGE:
                    direction = "improved" if diff > 0 else "dropped"
                    alert_message += f" (Rank {direction} by {abs(diff)} positions from #{previous_position})"
                else:
                    # Still create weekly alert but skip notification for minor changes
                    notify = False
        else:
            alert_title = f"Rank Not Found: {domain}"
            alert_message = f'{domain} was not found in the top results for "{keyword}".'
            notify = previous_position is not None  # notify if previously ranked

        alert = Alert(
            monitor_id=monitor.id,
            user_id=monitor.user_id,
            title=alert_title,
            message=alert_message,
            data={"domain": domain, "keyword": keyword, "position": position, "url": ranked_url},
        )
        db.add(alert)

        if notify:
            monitor.last_alert_at = now
            monitor.status = "alert"
            await _notify_user(user, alert_title, alert_message)
        else:
            monitor.status = "ok"

        monitor.last_state = str(position) if position is not None else ""
        monitor.last_checked = now
        db.commit()
    except Exception as exc:
        logger.error("RankWatch monitor %d failed: %s", monitor_id, exc)
        monitor.status = "error"
        monitor.last_checked = datetime.now(timezone.utc)
        db.commit()
