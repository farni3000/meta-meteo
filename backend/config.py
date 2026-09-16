from __future__ import annotations

from dataclasses import dataclass, field

CANONICAL_PARAMS: list[str] = [
    "temperature_2m",
    "wind_speed_10m",
    "uv_index",
    "precipitation_probability",
    "precipitation",
]

HOURLY_VARIABLES: dict[str, str] = {param: param for param in CANONICAL_PARAMS}

DAILY_VARIABLES: dict[str, str] = {
    "temperature_2m": "temperature_2m_mean",
    "wind_speed_10m": "wind_speed_10m_max",
    "uv_index": "uv_index_max",
    "precipitation_probability": "precipitation_probability_max",
    "precipitation": "precipitation_sum",
}

DEFAULT_MODELS: list[str] = [
    "icon_seamless",
    "gfs_seamless",
    "ecmwf_ifs025",
    "gem_seamless",
    "ukmo_seamless",
    "meteofrance_seamless",
]

ALLOWED_MODELS: list[str] = DEFAULT_MODELS + [
    "jma_seamless",
]

DISPLAY_NAMES: dict[str, str] = {
    "icon_seamless": "DWD ICON",
    "gfs_seamless": "NOAA GFS",
    "ecmwf_ifs025": "ECMWF IFS",
    "gem_seamless": "Kanada GEM",
    "ukmo_seamless": "UK Met Office",
    "meteofrance_seamless": "Météo-France",
    "jma_seamless": "Japan JMA",
}

FORECAST_API_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODING_API_URL = "https://geocoding-api.open-meteo.com/v1/search"

FORECAST_MAX_DAYS = 16
DEFAULT_FORECAST_DAYS = 7
CACHE_TTL_SECONDS = 600
HTTP_TIMEOUT_SECONDS = 20.0


@dataclass(frozen=True)
class Settings:
    default_models: list[str] = field(default_factory=lambda: list(DEFAULT_MODELS))
    allowed_models: list[str] = field(default_factory=lambda: list(ALLOWED_MODELS))
    cache_ttl_seconds: float = CACHE_TTL_SECONDS


settings = Settings()
