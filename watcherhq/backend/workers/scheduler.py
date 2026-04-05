import asyncio
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..models.monitor import Monitor
from ..models.user import User

logger = logging.getLogger(__name__)

# Intervals per module type and plan (in minutes)
INTERVALS: dict[str, dict[str, int]] = {
    "pagespy":      {"free": 1440, "pro": 60,   "business": 15},
    "pricehound":   {"free": 1440, "pro": 360,  "business": 60},
    "digestbot":    {"free": 1440, "pro": 1440, "business": 1440},
    "mentionalert": {"free": 1440, "pro": 360,  "business": 60},
    "rankwatch":    {"free": 10080,"pro": 10080,"business": 10080},
    "jobradar":     {"free": 1440, "pro": 360,  "business": 60},
    "leaseguard":   {"free": 1440, "pro": 60,   "business": 15},
}

# Smallest interval per module (drives how often the job function runs)
MIN_INTERVALS: dict[str, int] = {
    module: min(plans.values()) for module, plans in INTERVALS.items()
}


def _get_interval_minutes(module_type: str, plan: str) -> int:
    return INTERVALS.get(module_type, {}).get(plan, 1440)


def _is_due(monitor: Monitor, user: User) -> bool:
    """Return True if a monitor is due to run given the user's plan interval."""
    if not monitor.last_checked:
        return True
    interval_minutes = _get_interval_minutes(monitor.module_type, user.plan)
    last = monitor.last_checked
    # Ensure comparison is timezone-aware
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    due_at = last + timedelta(minutes=interval_minutes)
    return datetime.now(timezone.utc) >= due_at


def _run_worker(module_type: str) -> None:
    """Synchronous job function that iterates active monitors of a given type."""
    db: Session = SessionLocal()
    try:
        monitors = (
            db.query(Monitor)
            .filter(Monitor.module_type == module_type, Monitor.is_active == True)
            .all()
        )

        if not monitors:
            return

        user_cache: dict[int, User] = {}
        due_monitors = []
        for monitor in monitors:
            if monitor.user_id not in user_cache:
                user = db.get(User, monitor.user_id)
                if user:
                    user_cache[monitor.user_id] = user
            user = user_cache.get(monitor.user_id)
            if user and _is_due(monitor, user):
                due_monitors.append(monitor.id)

        if not due_monitors:
            return

        # Import workers lazily to avoid circular imports at module load
        from . import pagespy, pricehound, digestbot, mentionalert, rankwatch, jobradar, leaseguard

        worker_map = {
            "pagespy":      pagespy.run_pagespy,
            "pricehound":   pricehound.run_pricehound,
            "digestbot":    digestbot.run_digestbot,
            "mentionalert": mentionalert.run_mentionalert,
            "rankwatch":    rankwatch.run_rankwatch,
            "jobradar":     jobradar.run_jobradar,
            "leaseguard":   leaseguard.run_leaseguard,
        }

        worker_fn = worker_map.get(module_type)
        if not worker_fn:
            logger.error("No worker found for module_type=%s", module_type)
            return

        async def _run_all():
            for monitor_id in due_monitors:
                try:
                    # Each worker gets its own DB session to isolate failures
                    inner_db: Session = SessionLocal()
                    try:
                        await worker_fn(monitor_id, inner_db)
                    finally:
                        inner_db.close()
                except Exception as exc:
                    logger.error("Worker %s monitor %d raised: %s", module_type, monitor_id, exc)

        asyncio.run(_run_all())
    except Exception as exc:
        logger.error("Scheduler job for %s failed: %s", module_type, exc)
    finally:
        db.close()


_scheduler: BackgroundScheduler | None = None


def start_scheduler() -> None:
    global _scheduler

    jobstores = {
        "default": SQLAlchemyJobStore(url=settings.DATABASE_URL),
    }

    _scheduler = BackgroundScheduler(jobstores=jobstores, timezone="UTC")

    for module_type, interval_minutes in MIN_INTERVALS.items():
        _scheduler.add_job(
            func=_run_worker,
            trigger="interval",
            minutes=interval_minutes,
            id=f"worker_{module_type}",
            args=[module_type],
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        logger.info("Scheduled %s every %d minutes", module_type, interval_minutes)

    _scheduler.start()
    logger.info("APScheduler started with %d jobs", len(_scheduler.get_jobs()))


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
