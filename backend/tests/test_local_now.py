from __future__ import annotations

import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from backend.main import _local_now

PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$")


def test_local_now_uses_timezone() -> None:
    value = _local_now("Europe/Berlin")
    assert PATTERN.match(value)
    assert value == datetime.now(ZoneInfo("Europe/Berlin")).strftime("%Y-%m-%dT%H:%M")


def test_unknown_timezone_falls_back_to_utc() -> None:
    value = _local_now("Not/AZone")
    assert value == datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M")


def test_missing_timezone_uses_utc() -> None:
    value = _local_now(None)
    assert value == datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M")
