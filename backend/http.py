from __future__ import annotations

import asyncio
from typing import Optional, Union

import httpx

RETRY_STATUS_CODES = frozenset({429, 500, 502, 503, 504})

Params = Optional[Union[dict, list[tuple[str, str]]]]


def _retry_delay(
    response: httpx.Response, attempt: int, base_delay: float, max_delay: float
) -> float:
    retry_after = response.headers.get("Retry-After")
    if retry_after:
        try:
            return min(max(float(retry_after), 0.0), max_delay)
        except ValueError:
            pass
    return min(base_delay * (2 ** attempt), max_delay)


async def get_with_retry(
    client: httpx.AsyncClient,
    url: str,
    *,
    params: Params = None,
    attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 5.0,
) -> httpx.Response:
    """GET with retries on transient failures (429/5xx, network errors).

    Retry-After is honoured but capped by ``max_delay`` so a server asking for
    a long wait does not block the request indefinitely.
    """
    if attempts < 1:
        raise ValueError("attempts must be >= 1")
    for attempt in range(attempts):
        try:
            response = await client.get(url, params=params)
        except httpx.TransportError:
            if attempt >= attempts - 1:
                raise
            await asyncio.sleep(min(base_delay * (2 ** attempt), max_delay))
            continue
        if response.status_code in RETRY_STATUS_CODES and attempt < attempts - 1:
            await asyncio.sleep(_retry_delay(response, attempt, base_delay, max_delay))
            continue
        response.raise_for_status()
        return response
    raise RuntimeError("get_with_retry: exhausted attempts without a response")
