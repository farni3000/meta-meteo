from __future__ import annotations

from datetime import datetime

from backend.sun import SunTimes, daily_ceiling, hourly_ceiling

DAY = "2026-09-19"
SUNRISE = datetime(2026, 9, 19, 6, 42)
SUNSET = datetime(2026, 9, 19, 18, 30)


def make_sun(*days: str) -> SunTimes:
    return SunTimes(by_day={day: (SUNRISE, SUNSET) for day in days})


def test_hourly_ceiling_full_and_partial_hours() -> None:
    # Each value covers the preceding hour (Open-Meteo accumulation semantics).
    times = [
        f"{DAY}T06:00",
        f"{DAY}T07:00",
        f"{DAY}T08:00",
        f"{DAY}T18:00",
        f"{DAY}T19:00",
        f"{DAY}T20:00",
    ]
    values = hourly_ceiling(times, make_sun(DAY))
    assert values[0] == 0.0
    assert abs(values[1] - 0.3) < 1e-9
    assert values[2] == 1.0
    assert values[3] == 1.0
    assert abs(values[4] - 0.5) < 1e-9
    assert values[5] == 0.0


def test_hourly_ceiling_missing_day_is_none() -> None:
    values = hourly_ceiling([f"{DAY}T07:00"], make_sun("2026-09-18"))
    assert values == [None]


def test_daily_ceiling_is_day_length() -> None:
    values = daily_ceiling([DAY], make_sun(DAY))
    assert abs(values[0] - 11.8) < 1e-9


def test_polar_null_sun_times_are_none() -> None:
    sun = SunTimes(by_day={DAY: (None, None)})
    assert hourly_ceiling([f"{DAY}T12:00"], sun) == [None]
    assert daily_ceiling([DAY], sun) == [None]
