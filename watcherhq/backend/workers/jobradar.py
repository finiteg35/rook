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

JOB_BOARDS = [
    "site:linkedin.com/jobs",
    "site:indeed.com",
    "site:glassdoor.com/job",
    "site:remoteok.com",
    "site:weworkremotely.com",
]


async def _notify_user(user: User, title: str, message: str) -> None:
    notify_email = user.notification_email or user.email
    await send_email(notify_email, title, f"<p>{message}</p>")
    if user.telegram_chat_id:
        await send_telegram(user.telegram_chat_id, f"<b>{title}</b>\n{message}")


def _build_query(config: dict) -> str:
    keywords: List[str] = config.get("keywords", [])
    location: str = config.get("location", "")
    job_title: str = config.get("job_title", "")
    remote: bool = config.get("remote", False)

    parts = []
    if job_title:
        parts.append(f'"{job_title}"')
    parts.extend(keywords)
    if location:
        parts.append(location)
    if remote:
        parts.append("remote")
    boards_filter = " OR ".join(JOB_BOARDS[:3])
    return f"({boards_filter}) {' '.join(parts)}".strip()


async def run_jobradar(monitor_id: int, db: Session) -> None:
    """
    Search job boards for new matching listings.
    config: {"keywords": list, "location": str, "job_title": str, "remote": bool}
    """
    monitor: Monitor | None = db.get(Monitor, monitor_id)
    if not monitor or not monitor.is_active:
        return

    config = monitor.config or {}
    user: User | None = db.get(User, monitor.user_id)
    if not user:
        return

    now = datetime.now(timezone.utc)

    try:
        query = _build_query(config)
        result = await openclaw_client.search_web(query, num_results=10)
        search_results = result.get("results", [])

        seen_urls: List[str] = json.loads(monitor.last_state) if monitor.last_state else []
        seen_set = set(seen_urls)

        new_jobs = [r for r in search_results if r.get("url") and r["url"] not in seen_set]

        for job in new_jobs:
            job_title_str = job.get("title", "New Job")
            job_url = job.get("url", "")
            snippet = job.get("snippet", "")

            alert_title = f"New Job Match: {job_title_str}"
            alert_message = f"{snippet} — {job_url}"

            alert = Alert(
                monitor_id=monitor.id,
                user_id=monitor.user_id,
                title=alert_title,
                message=alert_message,
                data=job,
            )
            db.add(alert)
            seen_set.add(job_url)

            await _notify_user(user, alert_title, alert_message)

        if new_jobs:
            monitor.last_alert_at = now
            monitor.status = "alert"
        else:
            monitor.status = "ok"

        monitor.last_state = json.dumps(list(seen_set))
        monitor.last_checked = now
        db.commit()
    except Exception as exc:
        logger.error("JobRadar monitor %d failed: %s", monitor_id, exc)
        monitor.status = "error"
        monitor.last_checked = datetime.now(timezone.utc)
        db.commit()
