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
from ..http import get_with_retry
from ..models import NormalizedForecast


def _unit(units: dict[str, Any], variable: str, model: str) -> Optional[str]:
    value = units.get(f"{variable}_{model}")
    if value is None:
        value = units.get(variable)
    if not value or value == "undefined":
        return None
    return value


def _series(
    block: dict[str, Any],
    variable: str,
    model: str,
    scale: float = 1.0,
) -> list[Optional[float]]:
    values = block.get(f"{variable}_{model}")
    if values is None:
        values = block.get(variable)
    if values is None:
        return []
    return [None if v is None else float(v) * scale for v in values]


def _resolve_units(
    units: dict[str, Any], variables: dict[str, str], model: str
) -> dict[str, str]:
    resolved: dict[str, str] = {}
    for canonical, variable in variables.items():
        unit = UNIT_OVERRIDES.get(canonical) or _unit(units, variable, model)
        if unit is not None:
            resolved[canonical] = unit
    return resolved


def _resolve_series(
    block: dict[str, Any], variables: dict[str, str], model: str
) -> dict[str, list[Optional[float]]]:
    return {
        canonical: _series(
            block, variable, model, VALUE_SCALES.get(canonical, 1.0)
        )
        for canonical, variable in variables.items()
    }


async def fetch_forecasts(
    client: httpx.AsyncClient,
    lat: float,
    lon: float,
    days: int,
    models: list[str],
) -> list[NormalizedForecast]:
    """Fetch all requested models in a single Open-Meteo request.

    Requesting the models together (comma-separated) keeps the call count low,
    which matters on rate-limited / shared IPs. Open-Meteo then returns the
    variables suffixed with the model id (e.g. ``temperature_2m_icon_seamless``),
    so each model is split out of the shared response.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(HOURLY_VARIABLES[param] for param in CANONICAL_PARAMS),
        "daily": ",".join(DAILY_VARIABLES[param] for param in CANONICAL_PARAMS),
        "models": ",".join(models),
        "timezone": "auto",
        "forecast_days": days,
    }
    response = await get_with_retry(client, FORECAST_API_URL, params=params)
    data = response.json()
    if data.get("error"):
        raise RuntimeError(data.get("reason", "unknown error"))

    hourly_block = data.get("hourly") or {}
    daily_block = data.get("daily") or {}
    hourly_units = data.get("hourly_units") or {}
    daily_units = data.get("daily_units") or {}
    timezone = data.get("timezone", "UTC")
    elevation = data.get("elevation")
    hourly_times = list(hourly_block.get("time", []))
    daily_times = list(daily_block.get("time", []))

    forecasts: list[NormalizedForecast] = []
    for model in models:
        forecasts.append(
            NormalizedForecast(
                source=model,
                timezone=timezone,
                elevation=elevation,
                hourly_times=hourly_times,
                hourly=_resolve_series(hourly_block, HOURLY_VARIABLES, model),
                hourly_units=_resolve_units(hourly_units, HOURLY_VARIABLES, model),
                daily_times=daily_times,
                daily=_resolve_series(daily_block, DAILY_VARIABLES, model),
                daily_units=_resolve_units(daily_units, DAILY_VARIABLES, model),
            )
        )
    return forecasts
