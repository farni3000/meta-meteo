from __future__ import annotations

from backend.ratelimit import SlidingWindowRateLimiter


def test_allows_requests_up_to_limit() -> None:
    limiter = SlidingWindowRateLimiter(3, 10)
    assert all(limiter.check("a", now=t).allowed for t in (0, 1, 2))


def test_blocks_over_limit_with_retry_after() -> None:
    limiter = SlidingWindowRateLimiter(2, 10)
    limiter.check("a", now=0)
    limiter.check("a", now=1)
    result = limiter.check("a", now=2)
    assert result.allowed is False
    assert result.retry_after == 9


def test_window_slides_after_expiry() -> None:
    limiter = SlidingWindowRateLimiter(1, 10)
    assert limiter.check("a", now=0).allowed
    assert limiter.check("a", now=5).allowed is False
    assert limiter.check("a", now=10).allowed


def test_keys_are_independent() -> None:
    limiter = SlidingWindowRateLimiter(1, 10)
    assert limiter.check("a", now=0).allowed
    assert limiter.check("b", now=0).allowed
