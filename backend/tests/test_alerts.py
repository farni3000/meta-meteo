from __future__ import annotations

import asyncio

from backend.alerts import (
    _finalize,
    _severity,
    fetch_alerts,
    parse_brightsky,
    parse_nws,
)
from backend.models import WeatherAlert

BRIGHTSKY_DATA = {
    "alerts": [
        {
            "id": 1,
            "alert_id": "bs-1",
            "message_type": "Alert",
            "severity": "moderate",
            "event_en": "gale-force gusts",
            "event_de": "STURMBÖEN",
            "headline_en": "Official WARNING of GALE-FORCE GUSTS",
            "headline_de": "Amtliche WARNUNG vor STURMBÖEN",
            "description_en": "risk of gale-force gusts",
            "description_de": "Es treten Sturmböen auf",
            "instruction_en": "secure free-standing objects",
            "instruction_de": "frei stehende Objekte sichern",
            "onset": "2026-09-20T10:00:00+00:00",
            "expires": "2026-09-20T18:00:00+00:00",
        },
        {
            "id": 2,
            "alert_id": "bs-2",
            "message_type": "Cancel",
            "severity": "severe",
            "event_en": "severe storm",
            "onset": "2026-09-20T10:00:00+00:00",
            "expires": "2026-09-20T18:00:00+00:00",
        },
    ]
}

NWS_DATA = {
    "features": [
        {
            "id": "urn:nws:1",
            "properties": {
                "id": "urn:nws:1",
                "severity": "Severe",
                "event": "Coastal Flood Warning",
                "headline": "Coastal Flood Warning issued",
                "description": "dangerous flooding",
                "instruction": "move to higher ground",
                "onset": "2026-09-20T10:00:00+00:00",
                "expires": "2026-09-20T18:00:00+00:00",
                "areaDesc": "Coastal County",
            },
        }
    ]
}


def test_severity_mapping() -> None:
    assert _severity("Moderate") == ("moderate", 2)
    assert _severity("extreme") == ("extreme", 4)
    assert _severity("") == ("minor", 1)
    assert _severity(None) == ("minor", 1)


def test_parse_brightsky_localises_and_skips_cancels() -> None:
    alerts = parse_brightsky(BRIGHTSKY_DATA, lang="de")
    assert len(alerts) == 1
    alert = alerts[0]
    assert alert.source == "brightsky"
    assert alert.severity_level == 2
    assert alert.event == "STURMBÖEN"
    assert alert.headline == "Amtliche WARNUNG vor STURMBÖEN"
    assert alert.instruction == "frei stehende Objekte sichern"


def test_parse_brightsky_falls_back_to_english() -> None:
    alerts = parse_brightsky(BRIGHTSKY_DATA, lang="fr")
    assert alerts[0].event == "gale-force gusts"


def test_parse_nws() -> None:
    alerts = parse_nws(NWS_DATA)
    assert len(alerts) == 1
    alert = alerts[0]
    assert alert.source == "nws"
    assert alert.severity_level == 3
    assert alert.area == "Coastal County"
    assert alert.url == "urn:nws:1"


def _alert(event: str, level: int, onset: str) -> WeatherAlert:
    return WeatherAlert(
        id=f"{event}-{level}",
        source="nws",
        severity=["minor", "moderate", "severe", "extreme"][level - 1],
        severity_level=level,
        event=event,
        onset=onset,
        expires="2026-09-20T18:00:00+00:00",
    )


def test_finalize_dedupes_and_sorts() -> None:
    alerts = _finalize(
        [
            _alert("gale force gusts", 2, "2026-09-20T07:00:00+00:00"),
            _alert("gale force gusts", 2, "2026-09-20T07:00:00+00:00"),
            _alert("thunderstorms", 3, "2026-09-20T12:00:00+00:00"),
        ]
    )
    # The two identical gusts collapse into one, severe stays first.
    assert len(alerts) == 2
    assert alerts[0].severity_level == 3
    assert alerts[0].event == "thunderstorms"
    assert alerts[1].severity_level == 2


def test_fetch_alerts_unknown_country_returns_empty() -> None:
    assert asyncio.run(fetch_alerts(None, 0.0, 0.0, "XX")) == []
    assert asyncio.run(fetch_alerts(None, 0.0, 0.0, "FR")) == []
    assert asyncio.run(fetch_alerts(None, 0.0, 0.0, None)) == []
