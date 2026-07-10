"""Rate limiter in-memory a finestra scorrevole (thread-safe).

Sufficiente per un'istanza singola del backend. Per deployment multi-processo
si potra' sostituire con un backend condiviso (es. Redis).
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    """Consente al massimo `limit` eventi per `window` secondi, per chiave."""

    def __init__(self, limit: int, window_seconds: float) -> None:
        self.limit = limit
        self.window = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        """Registra un evento per `key`. Ritorna False se il limite e' superato."""
        now = time.monotonic()
        with self._lock:
            bucket = self._events[key]
            while bucket and now - bucket[0] > self.window:
                bucket.popleft()
            if len(bucket) >= self.limit:
                return False
            bucket.append(now)
            return True
