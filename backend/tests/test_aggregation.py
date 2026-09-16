from __future__ import annotations

from typing import Optional

from backend.aggregation import aggregate
from backend.config import CANONICAL_PARAMS
from backend.models import NormalizedForecast


def make_forecast(
    source: str,
    hourly_times: list[str],
    hourly_values: dict[str, list[Optional[float]]],
    daily_times: Optional[list[str]] = None,
    daily_values: Optional[dict[str, list[Optional[float]]]] = None,
) -> NormalizedForecast:
    daily_times = daily_times or []
    hourly = {param: [None] * len(hourly_times) for param in CANONICAL_PARAMS}
    hourly.update(hourly_values)
    daily = {param: [None] * len(daily_times) for param in CANONICAL_PARAMS}
    if daily_values:
        daily.update(daily_values)
    return NormalizedForecast(
        source=source,
        timezone="UTC",
        elevation=0.0,
        hourly_times=hourly_times,
        hourly=hourly,
        hourly_units={"temperature_2m": "°C"},
        daily_times=daily_times,
        daily=daily,
        daily_units={"temperature_2m": "°C"},
    )


def test_mean_and_population_std() -> None:
    times = ["2026-09-16T00:00", "2026-09-16T01:00"]
    a = make_forecast("a", times, {"temperature_2m": [0.0, 10.0]})
    b = make_forecast("b", times, {"temperature_2m": [2.0, 14.0]})

    hourly, _, _ = aggregate([a, b])
    series = hourly.parameters["temperature_2m"]

    assert series.mean == [1.0, 12.0]
    assert series.std == [1.0, 2.0]
    assert series.model_count == [2, 2]
    assert series.models_used == ["a", "b"]


def test_missing_values_are_excluded_not_zeroed() -> None:
    times = ["t0", "t1"]
    a = make_forecast("a", times, {"temperature_2m": [5.0, None]})
    b = make_forecast("b", times, {"temperature_2m": [None, 7.0]})

    hourly, _, _ = aggregate([a, b])
    series = hourly.parameters["temperature_2m"]

    assert series.mean == [5.0, 7.0]
    assert series.std == [0.0, 0.0]
    assert series.model_count == [1, 1]
    assert series.models_used == ["a", "b"]


def test_single_model_has_zero_std() -> None:
    times = ["t0", "t1"]
    a = make_forecast("a", times, {"temperature_2m": [3.0, 4.0]})

    hourly, _, _ = aggregate([a])
    series = hourly.parameters["temperature_2m"]

    assert series.mean == [3.0, 4.0]
    assert series.std == [0.0, 0.0]
    assert series.models_used == ["a"]


def test_all_missing_yields_null() -> None:
    times = ["t0", "t1"]
    a = make_forecast("a", times, {"temperature_2m": [None, None]})
    b = make_forecast("b", times, {"temperature_2m": [None, None]})

    hourly, _, _ = aggregate([a, b])
    series = hourly.parameters["temperature_2m"]

    assert series.mean == [None, None]
    assert series.std == [None, None]
    assert series.model_count == [0, 0]
    assert series.models_used == []


def test_hourly_falls_back_to_daily_when_only_daily_available() -> None:
    hourly_times = ["2026-09-16T00:00", "2026-09-16T01:00", "2026-09-17T00:00"]
    daily_times = ["2026-09-16T00:00", "2026-09-17T00:00"]
    a = make_forecast(
        "a",
        hourly_times,
        {"temperature_2m": [None, None, None]},
        daily_times,
        {"temperature_2m": [10.0, 20.0]},
    )
    b = make_forecast(
        "b",
        hourly_times,
        {"temperature_2m": [None, None, None]},
        daily_times,
        {"temperature_2m": [14.0, 18.0]},
    )

    hourly, _, _ = aggregate([a, b])
    series = hourly.parameters["temperature_2m"]

    assert series.resolution == "daily"
    assert series.mean == [12.0, 12.0, 19.0]
    assert series.std == [2.0, 2.0, 1.0]
    assert series.models_used == ["a", "b"]


def test_hourly_data_preferred_over_daily_fallback() -> None:
    hourly_times = ["2026-09-16T00:00"]
    daily_times = ["2026-09-16T00:00"]
    a = make_forecast(
        "a",
        hourly_times,
        {"temperature_2m": [5.0]},
        daily_times,
        {"temperature_2m": [100.0]},
    )

    hourly, _, _ = aggregate([a])
    series = hourly.parameters["temperature_2m"]

    assert series.resolution == "hourly"
    assert series.mean == [5.0]


def test_models_used_is_sorted_by_display_name() -> None:
    times = ["t0"]
    a = make_forecast("icon_seamless", times, {"temperature_2m": [1.0]})
    b = make_forecast("gfs_seamless", times, {"temperature_2m": [2.0]})

    _, _, models_used = aggregate([a, b])

    assert models_used == ["icon_seamless", "gfs_seamless"]
