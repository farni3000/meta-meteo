from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass
from typing import Deque


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    retry_after: int = 0


class SlidingWindowRateLimiter:
    """In-memory per-key rate limiter (single process, resets on restart)."""

    def __init__(self, max_requests: int, window_seconds: float) -> None:
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._hits: dict[str, Deque[float]] = {}

    def check(self, key: str, now: float | None = None) -> RateLimitResult:
        current = time.monotonic() if now is None else now
        window_start = current - self._window_seconds
        hits = self._hits.setdefault(key, deque())
        while hits and hits[0] <= window_start:
            hits.popleft()
        if len(hits) >= self._max_requests:
            retry_after = int(hits[0] + self._window_seconds - current) + 1
            return RateLimitResult(False, max(retry_after, 1))
        if not hits:
            self._prune(current)
        hits.append(current)
        return RateLimitResult(True)

    def _prune(self, now: float) -> None:
        if len(self._hits) < 1024:
            return
        window_start = now - self._window_seconds
        stale = [key for key, hits in self._hits.items() if not hits or hits[-1] <= window_start]
        for key in stale:
            del self._hits[key]
