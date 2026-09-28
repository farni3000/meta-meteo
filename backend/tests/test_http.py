from __future__ import annotations

import asyncio

import httpx
import pytest

from backend.http import get_with_retry


def _run(coro):
    return asyncio.run(coro)


def test_retries_on_rate_limit_then_succeeds() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] < 3:
            return httpx.Response(429, headers={"Retry-After": "0"})
        return httpx.Response(200, json={"ok": True})

    async def scenario() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await get_with_retry(
                client, "https://example.test", attempts=3, base_delay=0
            )

    response = _run(scenario())
    assert response.status_code == 200
    assert calls["n"] == 3


def test_gives_up_after_attempts() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(429, headers={"Retry-After": "0"})

    async def scenario() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await get_with_retry(
                client, "https://example.test", attempts=2, base_delay=0
            )

    with pytest.raises(httpx.HTTPStatusError):
        _run(scenario())
    assert calls["n"] == 2


def test_does_not_retry_client_error() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(400)

    async def scenario() -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await get_with_retry(
                client, "https://example.test", attempts=3, base_delay=0
            )

    with pytest.raises(httpx.HTTPStatusError):
        _run(scenario())
    assert calls["n"] == 1
