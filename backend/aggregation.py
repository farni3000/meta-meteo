from __future__ import annotations

from typing import Optional

import numpy as np

from .config import CANONICAL_PARAMS, DISPLAY_NAMES
from .models import NormalizedForecast, ParameterSeries, ResolutionBlock

HOURLY = "hourly"
DAILY = "daily"


def _aggregate_series(
    series_by_model: dict[str, list[Optional[float]]],
    length: int,
) -> tuple[list[Optional[float]], list[Optional[float]], list[str], list[int]]:
    models_used = [
        model
        for model, values in series_by_model.items()
        if any(value is not None for value in values)
    ]
    means: list[Optional[float]] = []
    stds: list[Optional[float]] = []
    counts: list[int] = []

    for index in range(length):
        row = [
            values[index]
            for values in series_by_model.values()
            if index < len(values) and values[index] is not None
        ]
        counts.append(len(row))
        if not row:
            means.append(None)
            stds.append(None)
            continue
        array = np.asarray(row, dtype=float)
        means.append(float(np.mean(array)))
        stds.append(float(np.std(array)) if len(row) > 1 else 0.0)

    return means, stds, models_used, counts


def _unit(forecasts: list[NormalizedForecast], resolution: str, param: str) -> Optional[str]:
    for forecast in forecasts:
        units = forecast.hourly_units if resolution == HOURLY else forecast.daily_units
        if param in units:
            return units[param]
    return None


def _daily_fallback(
    forecasts: list[NormalizedForecast],
    param: str,
    hourly_times: list[str],
) -> Optional[tuple[list[Optional[float]], list[Optional[float]], list[str], list[int], Optional[str]]]:
    daily_times: list[str] = []
    for forecast in forecasts:
        if forecast.daily_times and len(forecast.daily_times) > len(daily_times):
            daily_times = forecast.daily_times
    if not daily_times:
        return None

    series_by_model = {f.source: f.daily.get(param, []) for f in forecasts}
    mean, std, models_used, counts = _aggregate_series(series_by_model, len(daily_times))
    if not models_used:
        return None

    date_index = {timestamp[:10]: i for i, timestamp in enumerate(daily_times)}
    fallback_mean: list[Optional[float]] = []
    fallback_std: list[Optional[float]] = []
    fallback_counts: list[int] = []
    for timestamp in hourly_times:
        index = date_index.get(timestamp[:10])
        if index is None:
            fallback_mean.append(None)
            fallback_std.append(None)
            fallback_counts.append(0)
            continue
        fallback_mean.append(mean[index])
        fallback_std.append(std[index])
        fallback_counts.append(counts[index])

    return fallback_mean, fallback_std, models_used, fallback_counts, _unit(forecasts, DAILY, param)


def _build_block(
    forecasts: list[NormalizedForecast],
    resolution: str,
    timestamps: list[str],
) -> ResolutionBlock:
    parameters: dict[str, ParameterSeries] = {}
    for param in CANONICAL_PARAMS:
        attribute = "hourly" if resolution == HOURLY else "daily"
        series_by_model = {f.source: getattr(f, attribute).get(param, []) for f in forecasts}
        mean, std, models_used, counts = _aggregate_series(series_by_model, len(timestamps))
        unit = _unit(forecasts, resolution, param)
        param_resolution = resolution

        if not models_used and resolution == HOURLY:
            fallback = _daily_fallback(forecasts, param, timestamps)
            if fallback is not None:
                mean, std, models_used, counts, unit = fallback
                param_resolution = DAILY

        parameters[param] = ParameterSeries(
            mean=mean,
            std=std,
            models_used=models_used,
            model_count=counts,
            unit=unit,
            resolution=param_resolution,
        )
    return ResolutionBlock(timestamps=timestamps, parameters=parameters)


def _longest_times(forecasts: list[NormalizedForecast], attribute: str) -> list[str]:
    times: list[str] = []
    for forecast in forecasts:
        candidate = forecast.hourly_times if attribute == "hourly" else forecast.daily_times
        if len(candidate) > len(times):
            times = candidate
    return times


def aggregate(forecasts: list[NormalizedForecast]) -> tuple[ResolutionBlock, ResolutionBlock, list[str]]:
    hourly_times = _longest_times(forecasts, "hourly")
    daily_times = _longest_times(forecasts, "daily")

    hourly_block = _build_block(forecasts, HOURLY, hourly_times)
    daily_block = _build_block(forecasts, DAILY, daily_times)

    models_used = sorted(
        {
            forecast.source
            for forecast in forecasts
            if any(
                value is not None
                for values in list(forecast.hourly.values()) + list(forecast.daily.values())
                for value in values
            )
        },
        key=lambda model: DISPLAY_NAMES.get(model, model),
    )
    return hourly_block, daily_block, models_used
