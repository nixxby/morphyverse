import threading
import time
from datetime import datetime, timezone

import httpx
from loguru import logger

from config import REPLIT_SERVER_URL, SYNC_INTERVAL

# TODO: Add retry logic (e.g., 3 attempts with backoff) on failed polls before logging warning
# TODO: Track consecutive failure count; expose "degraded" state when failures exceed 2 intervals


class EmbeddingCache:
    def __init__(self) -> None:
        self._store: list[dict] = []
        self._lock = threading.Lock()
        self._last_sync_ts: str | None = None
        self._thread = threading.Thread(target=self._poll_loop, daemon=True)

    def start(self) -> None:
        self._thread.start()
        logger.info("EmbeddingCache polling thread started")

    def _poll_loop(self) -> None:
        while True:
            self._sync()
            time.sleep(SYNC_INTERVAL)

    def _sync(self) -> None:
        try:
            resp = httpx.get(f"{REPLIT_SERVER_URL}/api/embeddings", timeout=10)
            resp.raise_for_status()
            data = resp.json()
            with self._lock:
                self._store = data
                self._last_sync_ts = datetime.now(timezone.utc).isoformat()
            logger.info(f"Embedding cache refreshed: {len(data)} embeddings")
        except Exception as e:
            logger.warning(f"Embedding sync failed: {e}")

    def get_all(self) -> list[dict]:
        with self._lock:
            return list(self._store)

    def count(self) -> int:
        with self._lock:
            return len(self._store)

    def last_sync_ts(self) -> str | None:
        with self._lock:
            return self._last_sync_ts
