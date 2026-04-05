import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

MOCK_BROWSE = {"content": "", "title": "Unavailable", "links": []}
MOCK_SEARCH = {"results": []}
MOCK_PRICE = {"price": None, "currency": "USD", "product_name": "Unavailable"}
MOCK_MENTIONS = {"mentions": []}
MOCK_RANKING = {"position": None, "url": ""}


class OpenClawClient:
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            headers["X-API-Key"] = api_key
        self._headers = headers

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.base_url,
            headers=self._headers,
            timeout=30.0,
        )

    async def send_task(self, task_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Generic task sender with retry logic (3 retries, 30s timeout)."""
        last_exc: Optional[Exception] = None
        for attempt in range(3):
            try:
                async with self._client() as client:
                    response = await client.post(
                        "/task",
                        json={"type": task_type, "payload": payload},
                    )
                    response.raise_for_status()
                    return response.json()
            except httpx.HTTPStatusError as exc:
                logger.warning("OpenClaw HTTP error on attempt %d: %s", attempt + 1, exc)
                last_exc = exc
            except httpx.RequestError as exc:
                logger.warning("OpenClaw connection error on attempt %d: %s", attempt + 1, exc)
                last_exc = exc
        logger.error("OpenClaw send_task failed after 3 attempts: %s", last_exc)
        return {}

    async def browse_url(self, url: str) -> Dict[str, Any]:
        """Fetch and return page content, title, and links."""
        try:
            async with self._client() as client:
                response = await client.post("/browse", json={"url": url})
                response.raise_for_status()
                return response.json()
        except Exception as exc:
            logger.warning("OpenClaw browse_url failed (%s): %s", url, exc)
            return dict(MOCK_BROWSE)

    async def search_web(self, query: str, num_results: int = 5) -> Dict[str, Any]:
        """Search the web and return results."""
        try:
            async with self._client() as client:
                response = await client.post(
                    "/search",
                    json={"query": query, "num_results": num_results},
                )
                response.raise_for_status()
                return response.json()
        except Exception as exc:
            logger.warning("OpenClaw search_web failed (%s): %s", query, exc)
            return dict(MOCK_SEARCH)

    async def extract_price(self, url: str) -> Dict[str, Any]:
        """Extract product price from a URL."""
        try:
            async with self._client() as client:
                response = await client.post("/extract-price", json={"url": url})
                response.raise_for_status()
                return response.json()
        except Exception as exc:
            logger.warning("OpenClaw extract_price failed (%s): %s", url, exc)
            return dict(MOCK_PRICE)

    async def find_mentions(self, keyword: str, sources: Optional[List[str]] = None) -> Dict[str, Any]:
        """Find web mentions of a keyword across optional sources."""
        try:
            async with self._client() as client:
                response = await client.post(
                    "/mentions",
                    json={"keyword": keyword, "sources": sources or []},
                )
                response.raise_for_status()
                return response.json()
        except Exception as exc:
            logger.warning("OpenClaw find_mentions failed (%s): %s", keyword, exc)
            return dict(MOCK_MENTIONS)

    async def check_ranking(self, domain: str, keyword: str) -> Dict[str, Any]:
        """Check search ranking for a domain/keyword pair."""
        try:
            async with self._client() as client:
                response = await client.post(
                    "/ranking",
                    json={"domain": domain, "keyword": keyword},
                )
                response.raise_for_status()
                return response.json()
        except Exception as exc:
            logger.warning("OpenClaw check_ranking failed (%s / %s): %s", domain, keyword, exc)
            return dict(MOCK_RANKING)
