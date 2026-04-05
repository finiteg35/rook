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


async def _notify_user(user: User, title: str, message: str) -> None:
    notify_email = user.notification_email or user.email
    await send_email(notify_email, title, f"<p>{message}</p>")
    if user.telegram_chat_id:
        await send_telegram(user.telegram_chat_id, f"<b>{title}</b>\n{message}")


async def run_pricehound(monitor_id: int, db: Session) -> None:
    """
    Monitor a product URL for price drops below a target.
    config: {"url": str, "target_price": float, "product_name": str}
    """
    monitor: Monitor | None = db.get(Monitor, monitor_id)
    if not monitor or not monitor.is_active:
        return

    config = monitor.config or {}
    url: str = config.get("url", "")
    target_price: float | None = config.get("target_price")
    product_name: str = config.get("product_name", "Product")

    if not url or target_price is None:
        logger.warning("PriceHound monitor %d missing url or target_price", monitor_id)
        return

    user: User | None = db.get(User, monitor.user_id)
    if not user:
        return

    now = datetime.now(timezone.utc)

    try:
        result = await openclaw_client.extract_price(url)
        current_price: float | None = result.get("price")
        currency: str = result.get("currency", "USD")
        fetched_name: str = result.get("product_name", product_name)

        if current_price is None:
            logger.info("PriceHound monitor %d: could not extract price from %s", monitor_id, url)
            monitor.status = "error"
            monitor.last_checked = now
            db.commit()
            return

        previous_price_str: str | None = monitor.last_state
        previous_price: float | None = float(previous_price_str) if previous_price_str else None

        if current_price <= target_price:
            alert_title = f"Price Drop: {fetched_name}"
            alert_message = (
                f"{fetched_name} is now {currency} {current_price:.2f} "
                f"(your target: {currency} {target_price:.2f}). Shop at: {url}"
            )

            alert = Alert(
                monitor_id=monitor.id,
                user_id=monitor.user_id,
                title=alert_title,
                message=alert_message,
                data={"url": url, "current_price": current_price, "target_price": target_price, "currency": currency},
            )
            db.add(alert)

            monitor.last_alert_at = now
            monitor.status = "alert"

            await _notify_user(user, alert_title, alert_message)
        else:
            monitor.status = "ok"

        monitor.last_state = str(current_price)
        monitor.last_checked = now
        db.commit()
    except Exception as exc:
        logger.error("PriceHound monitor %d failed: %s", monitor_id, exc)
        monitor.status = "error"
        monitor.last_checked = datetime.now(timezone.utc)
        db.commit()
