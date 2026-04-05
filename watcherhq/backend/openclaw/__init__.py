from .client import OpenClawClient
from ..config import settings

openclaw_client = OpenClawClient(
    base_url=settings.OPENCLAW_API_URL,
    api_key=settings.OPENCLAW_API_KEY or None,
)

__all__ = ["OpenClawClient", "openclaw_client"]
