import logging

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

TELEGRAM_API_BASE = "https://api.telegram.org"


async def send_telegram(chat_id: str, message: str) -> bool:
    """Send a Telegram message to a chat_id. Returns True on success."""
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not configured; skipping message to chat_id=%s", chat_id)
        return False

    url = f"{TELEGRAM_API_BASE}/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
        logger.info("Telegram message sent to chat_id=%s", chat_id)
        return True
    except Exception as exc:
        logger.error("Failed to send Telegram message to chat_id=%s: %s", chat_id, exc)
        return False
