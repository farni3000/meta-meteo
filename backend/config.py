from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

DATA_DIR = PROJECT_ROOT / "data"
FAVORITES_PATH = DATA_DIR / "favorites.json"


@dataclass(frozen=True)
class ParameterSpec:
    key: str
    hourly: str
    daily: str
    unit: Optional[str] = None
    scale: float = 1.0
    circular: bool = False


PARAMETER_SPECS: list[ParameterSpec] = [
    ParameterSpec("temperature_2m", "temperature_2m", "temperature_2m_mean"),
    ParameterSpec("wind_speed_10m", "wind_speed_10m", "wind_speed_10m_max"),
    ParameterSpec(
        "wind_direction_10m",
        "wind_direction_10m",
        "wind_direction_10m_dominant",
        unit="°",
        circular=True,
    ),
    ParameterSpec("uv_index", "uv_index", "uv_index_max"),
    ParameterSpec(
        "precipitation_probability",
        "precipitation_probability",
        "precipitation_probability_max",
    ),
    ParameterSpec("precipitation", "precipitation", "precipitation_sum"),
    ParameterSpec(
        "sunshine_duration",
        "sunshine_duration",
        "sunshine_duration",
        unit="h",
        scale=1.0 / 3600.0,
    ),
    ParameterSpec("apparent_temperature", "apparent_temperature", "apparent_temperature_mean"),
    ParameterSpec("cloud_cover", "cloud_cover", "cloud_cover_mean"),
    ParameterSpec("pressure_msl", "pressure_msl", "pressure_msl_mean"),
]

CANONICAL_PARAMS: list[str] = [spec.key for spec in PARAMETER_SPECS]

HOURLY_VARIABLES: dict[str, str] = {spec.key: spec.hourly for spec in PARAMETER_SPECS}

DAILY_VARIABLES: dict[str, str] = {spec.key: spec.daily for spec in PARAMETER_SPECS}

VALUE_SCALES: dict[str, float] = {spec.key: spec.scale for spec in PARAMETER_SPECS}

UNIT_OVERRIDES: dict[str, str] = {
    spec.key: spec.unit for spec in PARAMETER_SPECS if spec.unit is not None
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

DEFAULT_GEOCODE_LANGUAGE = "de"
GEOCODE_LANGUAGES = {"de", "en", "fr", "es", "it"}

FORECAST_MAX_DAYS = 16
DEFAULT_FORECAST_DAYS = 7
CACHE_TTL_SECONDS = 600
HTTP_TIMEOUT_SECONDS = 20.0

DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
DEEPSEEK_TIMEOUT_SECONDS = 45.0


@dataclass(frozen=True)
class Settings:
    default_models: list[str] = field(default_factory=lambda: list(DEFAULT_MODELS))
    allowed_models: list[str] = field(default_factory=lambda: list(ALLOWED_MODELS))
    cache_ttl_seconds: float = CACHE_TTL_SECONDS
    deepseek_api_key: Optional[str] = field(
        default_factory=lambda: os.getenv("DEEPSEEK_API_KEY")
    )
    deepseek_model: str = DEEPSEEK_MODEL


settings = Settings()
