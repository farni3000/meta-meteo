from __future__ import annotations

import asyncio
from typing import Any

import httpx

from backend.sources.open_meteo import fetch_forecasts


def _multi_model_payload(models: list[str]) -> dict[str, Any]:
    hourly: dict[str, Any] = {"time": [f"2026-09-28T{h:02d}:00" for h in range(3)]}
    daily: dict[str, Any] = {"time": ["2026-09-28"]}
    units: dict[str, Any] = {}
    for index, model in enumerate(models):
        hourly[f"temperature_2m_{model}"] = [10.0 + index, None, 12.0 + index]
        units[f"temperature_2m_{model}"] = "°C"
        hourly[f"sunshine_duration_{model}"] = [3600.0, 0.0, None]
        units[f"sunshine_duration_{model}"] = "s"
        daily[f"temperature_2m_mean_{model}"] = [11.0 + index]
        units[f"temperature_2m_mean_{model}"] = "°C"
    return {
        "timezone": "Europe/Berlin",
        "elevation": 34.0,
        "hourly": hourly,
        "hourly_units": units,
        "daily": daily,
        "daily_units": units,
    }


def _fetch(payload: dict[str, Any], models: list[str]):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await fetch_forecasts(client, 52.52, 13.41, 7, models)

    return asyncio.run(scenario())


def test_splits_multi_model_response_by_suffix() -> None:
    models = ["icon_seamless", "gfs_seamless"]
    forecasts = _fetch(_multi_model_payload(models), models)

    assert [f.source for f in forecasts] == models
    assert forecasts[0].hourly["temperature_2m"] == [10.0, None, 12.0]
    assert forecasts[1].hourly["temperature_2m"] == [11.0, None, 13.0]
    assert forecasts[0].hourly_units["temperature_2m"] == "°C"
    assert forecasts[0].daily["temperature_2m"] == [11.0]
    assert forecasts[0].timezone == "Europe/Berlin"


def test_applies_value_scale() -> None:
    forecasts = _fetch(_multi_model_payload(["icon_seamless"]), ["icon_seamless"])
    assert forecasts[0].hourly["sunshine_duration"] == [1.0, 0.0, None]
    assert forecasts[0].hourly_units["sunshine_duration"] == "h"


def test_missing_variable_is_empty() -> None:
    forecasts = _fetch(_multi_model_payload(["icon_seamless"]), ["icon_seamless"])
    assert forecasts[0].hourly["uv_index"] == []
    assert forecasts[0].daily["precipitation"] == []


def test_single_model_unsuffixed_fallback() -> None:
    payload = {
        "timezone": "UTC",
        "elevation": 0.0,
        "hourly": {
            "time": ["2026-09-28T00:00"],
            "temperature_2m": [7.5],
        },
        "hourly_units": {"temperature_2m": "°C"},
        "daily": {"time": ["2026-09-28"], "temperature_2m_mean": [7.0]},
        "daily_units": {"temperature_2m_mean": "°C"},
    }
    forecasts = _fetch(payload, ["icon_seamless"])
    assert forecasts[0].hourly["temperature_2m"] == [7.5]
    assert forecasts[0].daily["temperature_2m"] == [7.0]
