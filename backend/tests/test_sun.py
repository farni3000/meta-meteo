from __future__ import annotations

from datetime import datetime, timedelta

from backend.sun import SunTimes, ceiling_series, daily_ceiling, hourly_ceiling

DAY = "2026-09-19"
SUNRISE = datetime(2026, 9, 19, 6, 42)
SUNSET = datetime(2026, 9, 19, 18, 30)


def make_sun(*days: str) -> SunTimes:
    return SunTimes(by_day={day: (SUNRISE, SUNSET) for day in days})


def day_hours() -> list[str]:
    return [f"{DAY}T{hour:02d}:00" for hour in range(24)]


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
    timestamps, values = ceiling_series(day_hours(), sun)
    assert len(timestamps) == len(values)
    assert values and all(value is None for value in values)


def test_ceiling_series_includes_ramp_corners() -> None:
    timestamps, values = ceiling_series(day_hours(), make_sun(DAY), step_minutes=10)
    by_time = dict(zip(timestamps, values))
    assert by_time[f"{DAY}T06:42"] == 0.0
    assert by_time[f"{DAY}T07:42"] == 1.0
    assert by_time[f"{DAY}T18:30"] == 1.0
    assert by_time[f"{DAY}T19:30"] == 0.0
    assert f"{DAY}T12:00" in by_time


def test_ceiling_series_shoulders_are_one_hour_wide() -> None:
    timestamps, values = ceiling_series(day_hours(), make_sun(DAY))
    parse = datetime.fromisoformat
    first_one = values.index(1.0)
    last_zero_before = max(i for i in range(first_one) if values[i] == 0.0)
    morning = parse(timestamps[first_one]) - parse(timestamps[last_zero_before])
    last_one = max(i for i, value in enumerate(values) if value == 1.0)
    first_zero_after = next(
        i for i in range(last_one, len(values)) if values[i] == 0.0
    )
    evening = parse(timestamps[first_zero_after]) - parse(timestamps[last_one])
    assert morning == timedelta(hours=1)
    assert evening == timedelta(hours=1)


def test_ceiling_series_empty_input() -> None:
    assert ceiling_series([], make_sun(DAY)) == ([], [])
