from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Optional

import httpx

from .config import FORECAST_API_URL
from .models import SunData, SunSeries


@dataclass
class SunTimes:
    by_day: dict[str, tuple[Optional[datetime], Optional[datetime]]]


def _parse(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


async def fetch_sun_times(
    client: httpx.AsyncClient, lat: float, lon: float, days: int
) -> SunTimes:
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "sunrise,sunset",
        "timezone": "auto",
        "forecast_days": days,
    }
    response = await client.get(FORECAST_API_URL, params=params)
    response.raise_for_status()
    data = response.json()
    if data.get("error"):
        raise RuntimeError(data.get("reason", "unknown error"))
    daily = data.get("daily") or {}
    dates = daily.get("time") or []
    sunrises = daily.get("sunrise") or []
    sunsets = daily.get("sunset") or []
    by_day: dict[str, tuple[Optional[datetime], Optional[datetime]]] = {}
    for index, date in enumerate(dates):
        sunrise = _parse(sunrises[index]) if index < len(sunrises) else None
        sunset = _parse(sunsets[index]) if index < len(sunsets) else None
        by_day[str(date)] = (sunrise, sunset)
    return SunTimes(by_day=by_day)


def _overlap_hours(hour_end: datetime, sunrise: datetime, sunset: datetime) -> float:
    # Open-Meteo hourly accumulations (sunshine_duration) cover the preceding
    # hour, so the interval is [hour_end - 1h, hour_end).
    hour_start = hour_end - timedelta(hours=1)
    start = max(hour_start, sunrise)
    end = min(hour_end, sunset)
    seconds = (end - start).total_seconds()
    return seconds / 3600.0 if seconds > 0 else 0.0


def hourly_ceiling(hourly_times: list[str], sun: SunTimes) -> list[Optional[float]]:
    values: list[Optional[float]] = []
    for timestamp in hourly_times:
        moment = _parse(timestamp)
        if moment is None:
            values.append(None)
            continue
        sunrise, sunset = sun.by_day.get(moment.date().isoformat(), (None, None))
        if sunrise is None or sunset is None:
            values.append(None)
            continue
        values.append(round(_overlap_hours(moment, sunrise, sunset), 4))
    return values


def daily_ceiling(daily_times: list[str], sun: SunTimes) -> list[Optional[float]]:
    values: list[Optional[float]] = []
    for date in daily_times:
        sunrise, sunset = sun.by_day.get(date, (None, None))
        if sunrise is None or sunset is None:
            values.append(None)
            continue
        hours = (sunset - sunrise).total_seconds() / 3600.0
        values.append(round(hours, 4) if hours > 0 else 0.0)
    return values


def build_sun_data(
    hourly_times: list[str], daily_times: list[str], sun: SunTimes
) -> SunData:
    return SunData(
        hourly=SunSeries(mean=hourly_ceiling(hourly_times, sun), unit="h"),
        daily=SunSeries(mean=daily_ceiling(daily_times, sun), unit="h"),
    )
