from __future__ import annotations

from backend.config import (
    CANONICAL_PARAMS,
    DAILY_VARIABLES,
    HOURLY_VARIABLES,
    PARAMETER_SPECS,
    UNIT_OVERRIDES,
    VALUE_SCALES,
)
from backend.sources.open_meteo import _series


def test_every_canonical_param_has_a_complete_spec() -> None:
    assert [spec.key for spec in PARAMETER_SPECS] == CANONICAL_PARAMS
    for spec in PARAMETER_SPECS:
        assert HOURLY_VARIABLES[spec.key] == spec.hourly
        assert DAILY_VARIABLES[spec.key] == spec.daily
        assert VALUE_SCALES[spec.key] == spec.scale


def test_sunshine_duration_is_scaled_to_hours() -> None:
    assert UNIT_OVERRIDES["sunshine_duration"] == "h"
    block = {"sunshine_duration": [0.0, 3600.0, 1800.0, None]}
    values = _series(block, "sunshine_duration", "icon_seamless", scale=1.0 / 3600.0)
    assert values[0] == 0.0
    assert abs(values[1] - 1.0) < 1e-9
    assert abs(values[2] - 0.5) < 1e-9
    assert values[3] is None


def test_series_reads_model_suffixed_keys() -> None:
    block = {"temperature_2m_icon_seamless": [1.0, None, 3.0]}
    values = _series(block, "temperature_2m", "icon_seamless")
    assert values == [1.0, None, 3.0]
