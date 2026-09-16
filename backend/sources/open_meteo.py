from __future__ import annotations

from typing import Any, Optional

import httpx

from ..config import (
    CANONICAL_PARAMS,
    DAILY_VARIABLES,
    FORECAST_API_URL,
    HOURLY_VARIABLES,
    UNIT_OVERRIDES,
    VALUE_SCALES,
)
from ..models import NormalizedForecast
from .base import ForecastSource


def _unit(units: dict[str, Any], variable: str, model: str) -> Optional[str]:
    value = units.get(variable)
    if value is None:
        value = units.get(f"{variable}_{model}")
    if not value or value == "undefined":
        return None
    return value


def _series(
    block: dict[str, Any],
    variable: str,
    model: str,
    scale: float = 1.0,
) -> list[Optional[float]]:
    values = block.get(variable)
    if values is None:
        values = block.get(f"{variable}_{model}")
    if values is None:
        return []
    return [None if v is None else float(v) * scale for v in values]


class OpenMeteoForecastSource(ForecastSource):
    def __init__(self, client: httpx.AsyncClient, model: str) -> None:
        super().__init__(client)
        self.model = model
        self.name = model

    async def fetch(self, lat: float, lon: float, days: int) -> NormalizedForecast:
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": ",".join(HOURLY_VARIABLES[param] for param in CANONICAL_PARAMS),
            "daily": ",".join(DAILY_VARIABLES[param] for param in CANONICAL_PARAMS),
            "models": self.model,
            "timezone": "auto",
            "forecast_days": days,
        }
        response = await self._client.get(FORECAST_API_URL, params=params)
        response.raise_for_status()
        data = response.json()
        if data.get("error"):
            raise RuntimeError(f"{self.model}: {data.get('reason', 'unknown error')}")

        hourly_block = data.get("hourly") or {}
        daily_block = data.get("daily") or {}
        hourly_units = data.get("hourly_units") or {}
        daily_units = data.get("daily_units") or {}

        hourly: dict[str, list[Optional[float]]] = {}
        hourly_resolved_units: dict[str, str] = {}
        for canonical, variable in HOURLY_VARIABLES.items():
            hourly[canonical] = _series(
                hourly_block, variable, self.model, VALUE_SCALES.get(canonical, 1.0)
            )
            unit = UNIT_OVERRIDES.get(canonical) or _unit(hourly_units, variable, self.model)
            if unit is not None:
                hourly_resolved_units[canonical] = unit

        daily: dict[str, list[Optional[float]]] = {}
        daily_resolved_units: dict[str, str] = {}
        for canonical, variable in DAILY_VARIABLES.items():
            daily[canonical] = _series(
                daily_block, variable, self.model, VALUE_SCALES.get(canonical, 1.0)
            )
            unit = UNIT_OVERRIDES.get(canonical) or _unit(daily_units, variable, self.model)
            if unit is not None:
                daily_resolved_units[canonical] = unit

        return NormalizedForecast(
            source=self.model,
            timezone=data.get("timezone", "UTC"),
            elevation=data.get("elevation"),
            hourly_times=list(hourly_block.get("time", [])),
            hourly=hourly,
            hourly_units=hourly_resolved_units,
            daily_times=list(daily_block.get("time", [])),
            daily=daily,
            daily_units=daily_resolved_units,
        )
