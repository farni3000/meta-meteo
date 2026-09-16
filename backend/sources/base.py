from __future__ import annotations

from abc import ABC, abstractmethod

import httpx

from ..models import NormalizedForecast


class ForecastSource(ABC):
    name: str

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    @abstractmethod
    async def fetch(self, lat: float, lon: float, days: int) -> NormalizedForecast:
        raise NotImplementedError
