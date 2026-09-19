from __future__ import annotations

from typing import Any, Optional

import httpx

from .config import (
    BRIGHTSKY_ALERTS_URL,
    NWS_ALERTS_URL,
    NWS_USER_AGENT,
)
from .models import WeatherAlert

# CAP awareness levels used by Bright Sky and NWS alike.
_LEVEL_NAMES: dict[int, str] = {1: "minor", 2: "moderate", 3: "severe", 4: "extreme"}
_SEVERITY_LEVELS: dict[str, int] = {
    name: level for level, name in _LEVEL_NAMES.items()
}


def _severity(value: Any) -> tuple[str, int]:
    level = _SEVERITY_LEVELS.get(str(value or "").strip().lower(), 1)
    return _LEVEL_NAMES[level], level


def _brightsky_text(alert: dict[str, Any], lang: str, field: str) -> Optional[str]:
    suffix = lang if lang in ("de", "en") else "en"
    for key in (f"{field}_{suffix}", f"{field}_en", field):
        value = alert.get(key)
        if value:
            return str(value)
    return None


def parse_brightsky(data: dict[str, Any], lang: str = "en") -> list[WeatherAlert]:
    alerts: list[WeatherAlert] = []
    for item in data.get("alerts") or []:
        if str(item.get("message_type") or "Alert").lower() not in ("alert", "update"):
            continue
        severity, level = _severity(item.get("severity"))
        alerts.append(
            WeatherAlert(
                id=str(item.get("alert_id") or item.get("id") or ""),
                source="brightsky",
                severity=severity,
                severity_level=level,
                event=_brightsky_text(item, lang, "event"),
                headline=_brightsky_text(item, lang, "headline"),
                description=_brightsky_text(item, lang, "description"),
                instruction=_brightsky_text(item, lang, "instruction"),
                onset=item.get("onset") or item.get("effective"),
                expires=item.get("expires"),
            )
        )
    return alerts


def parse_nws(data: dict[str, Any]) -> list[WeatherAlert]:
    alerts: list[WeatherAlert] = []
    for feature in data.get("features") or []:
        props = feature.get("properties") or {}
        severity, level = _severity(props.get("severity"))
        alerts.append(
            WeatherAlert(
                id=str(props.get("id") or feature.get("id") or ""),
                source="nws",
                severity=severity,
                severity_level=level,
                event=props.get("event"),
                headline=props.get("headline"),
                description=props.get("description"),
                instruction=props.get("instruction"),
                onset=props.get("onset") or props.get("effective"),
                expires=props.get("expires") or props.get("ends"),
                area=props.get("areaDesc"),
                url=props.get("id"),
            )
        )
    return alerts


def _finalize(alerts: list[WeatherAlert]) -> list[WeatherAlert]:
    seen: set[tuple[Any, ...]] = set()
    unique: list[WeatherAlert] = []
    for alert in alerts:
        key = (alert.event, alert.severity_level, alert.onset, alert.expires)
        if key in seen:
            continue
        seen.add(key)
        unique.append(alert)
    return sorted(unique, key=lambda alert: (-alert.severity_level, alert.onset or ""))


async def _fetch_brightsky(
    client: httpx.AsyncClient, lat: float, lon: float, lang: str
) -> list[WeatherAlert]:
    response = await client.get(BRIGHTSKY_ALERTS_URL, params={"lat": lat, "lon": lon})
    response.raise_for_status()
    return _finalize(parse_brightsky(response.json(), lang))


async def _fetch_nws(
    client: httpx.AsyncClient, lat: float, lon: float
) -> list[WeatherAlert]:
    response = await client.get(
        NWS_ALERTS_URL,
        params={"point": f"{lat},{lon}"},
        headers={"User-Agent": NWS_USER_AGENT, "Accept": "application/geo+json"},
    )
    response.raise_for_status()
    return _finalize(parse_nws(response.json()))


async def fetch_alerts(
    client: httpx.AsyncClient,
    lat: float,
    lon: float,
    country_code: Optional[str],
    lang: str = "en",
) -> list[WeatherAlert]:
    code = (country_code or "").strip().upper()
    if code == "DE":
        return await _fetch_brightsky(client, lat, lon, lang)
    if code == "US":
        return await _fetch_nws(client, lat, lon)
    return []
