import logging
from datetime import datetime, timezone
from typing import List

from sqlalchemy.orm import Session

from ..models.monitor import Monitor
from ..models.user import User
from ..openclaw import openclaw_client
from ..notifications.email import send_email
from ..notifications.telegram import send_telegram

logger = logging.getLogger(__name__)


def _build_digest_html(topics_results: List[dict]) -> str:
    lines = ["<h2>Your Daily Digest</h2>"]
    for item in topics_results:
        lines.append(f"<h3>{item['topic']}</h3><ul>")
        for result in item.get("results", []):
            title = result.get("title", "No title")
            url = result.get("url", "#")
            snippet = result.get("snippet", "")
            lines.append(f'<li><a href="{url}">{title}</a> — {snippet}</li>')
        lines.append("</ul>")
    return "\n".join(lines)


def _build_digest_text(topics_results: List[dict]) -> str:
    lines = ["Your Daily Digest\n"]
    for item in topics_results:
        lines.append(f"\n{item['topic']}")
        for result in item.get("results", []):
            title = result.get("title", "No title")
            url = result.get("url", "")
            lines.append(f"  • {title} — {url}")
    return "\n".join(lines)


async def run_digestbot(monitor_id: int, db: Session) -> None:
    """
    Compile and deliver a daily news digest.
    config: {"topics": list[str], "delivery": "email" | "telegram"}
    """
    monitor: Monitor | None = db.get(Monitor, monitor_id)
    if not monitor or not monitor.is_active:
        return

    config = monitor.config or {}
    raw_topics = config.get("topics", [])
    # Accept either a list or a comma-separated string
    if isinstance(raw_topics, str):
        topics: List[str] = [t.strip() for t in raw_topics.split(",") if t.strip()]
    else:
        topics = list(raw_topics)
    delivery: str = config.get("delivery", "email")

    if not topics:
        logger.warning("DigestBot monitor %d has no topics configured", monitor_id)
        return

    user: User | None = db.get(User, monitor.user_id)
    if not user:
        return

    now = datetime.now(timezone.utc)

    try:
        topics_results = []
        for topic in topics:
            result = await openclaw_client.search_web(topic, num_results=5)
            topics_results.append({"topic": topic, "results": result.get("results", [])})

        if delivery == "telegram" and user.telegram_chat_id:
            text = _build_digest_text(topics_results)
            await send_telegram(user.telegram_chat_id, text)
        else:
            notify_email = user.notification_email or user.email
            html = _build_digest_html(topics_results)
            await send_email(notify_email, f"Daily Digest: {monitor.name}", html)

        monitor.status = "ok"
        monitor.last_checked = now
        db.commit()
    except Exception as exc:
        logger.error("DigestBot monitor %d failed: %s", monitor_id, exc)
        monitor.status = "error"
        monitor.last_checked = datetime.now(timezone.utc)
        db.commit()
