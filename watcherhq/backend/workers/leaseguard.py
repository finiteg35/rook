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

RENTAL_SITES = [
    "site:zillow.com",
    "site:apartments.com",
    "site:craigslist.org",
    "site:rentals.com",
    "site:realtor.com/rentals",
]


async def _notify_user(user: User, title: str, message: str) -> None:
    notify_email = user.notification_email or user.email
    await send_email(notify_email, title, f"<p>{message}</p>")
    if user.telegram_chat_id:
        await send_telegram(user.telegram_chat_id, f"<b>{title}</b>\n{message}")


def _build_query(config: dict) -> str:
    location: str = config.get("location", "")
    max_price: float | None = config.get("max_price")
    min_bedrooms: int | None = config.get("min_bedrooms")
    keywords: List[str] = config.get("keywords", [])

    parts = ["rental apartment"]
    if location:
        parts.append(location)
    if min_bedrooms:
        parts.append(f"{min_bedrooms} bedroom")
    parts.extend(keywords)

    sites_filter = " OR ".join(RENTAL_SITES[:3])
    return f"({sites_filter}) {' '.join(parts)}".strip()


async def run_leaseguard(monitor_id: int, db: Session) -> None:
    """
    Search rental listings for new matches.
    config: {"location": str, "max_price": float, "min_bedrooms": int, "keywords": list}
    """
    monitor: Monitor | None = db.get(Monitor, monitor_id)
    if not monitor or not monitor.is_active:
        return

    config = monitor.config or {}
    max_price: float | None = config.get("max_price")
    user: User | None = db.get(User, monitor.user_id)
    if not user:
        return

    now = datetime.now(timezone.utc)

    try:
        query = _build_query(config)
        result = await openclaw_client.search_web(query, num_results=10)
        listings = result.get("results", [])

        seen_urls: List[str] = json.loads(monitor.last_state) if monitor.last_state else []
        seen_set = set(seen_urls)

        new_listings = [r for r in listings if r.get("url") and r["url"] not in seen_set]

        for listing in new_listings:
            listing_title = listing.get("title", "New Listing")
            listing_url = listing.get("url", "")
            snippet = listing.get("snippet", "")

            alert_title = f"New Rental Listing: {listing_title}"
            alert_message = f"{snippet} — {listing_url}"

            alert = Alert(
                monitor_id=monitor.id,
                user_id=monitor.user_id,
                title=alert_title,
                message=alert_message,
                data=listing,
            )
            db.add(alert)
            seen_set.add(listing_url)

            await _notify_user(user, alert_title, alert_message)

        if new_listings:
            monitor.last_alert_at = now
            monitor.status = "alert"
        else:
            monitor.status = "ok"

        monitor.last_state = json.dumps(list(seen_set))
        monitor.last_checked = now
        db.commit()
    except Exception as exc:
        logger.error("LeaseGuard monitor %d failed: %s", monitor_id, exc)
        monitor.status = "error"
        monitor.last_checked = datetime.now(timezone.utc)
        db.commit()
