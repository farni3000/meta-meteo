from __future__ import annotations

import httpx

from ..config import GEOCODING_API_URL
from ..models import GeoResult


class GeocodingClient:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def search(
        self,
        query: str,
        count: int = 8,
        language: str = "de",
    ) -> list[GeoResult]:
        params = {
            "name": query,
            "count": count,
            "language": language,
            "format": "json",
        }
        response = await self._client.get(GEOCODING_API_URL, params=params)
        response.raise_for_status()
        data = response.json()

        results: list[GeoResult] = []
        for item in data.get("results") or []:
            results.append(
                GeoResult(
                    name=item["name"],
                    country=item.get("country"),
                    country_code=item.get("country_code"),
                    admin1=item.get("admin1"),
                    latitude=item["latitude"],
                    longitude=item["longitude"],
                    timezone=item.get("timezone"),
                    population=item.get("population"),
                )
            )
        return results
