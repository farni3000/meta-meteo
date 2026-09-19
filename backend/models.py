from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from pydantic import BaseModel


@dataclass
class NormalizedForecast:
    source: str
    timezone: str
    elevation: Optional[float]
    hourly_times: list[str]
    hourly: dict[str, list[Optional[float]]]
    hourly_units: dict[str, str]
    daily_times: list[str]
    daily: dict[str, list[Optional[float]]]
    daily_units: dict[str, str]


class GeoResult(BaseModel):
    name: str
    country: Optional[str] = None
    country_code: Optional[str] = None
    admin1: Optional[str] = None
    latitude: float
    longitude: float
    timezone: Optional[str] = None
    population: Optional[int] = None


class GeocodeResponse(BaseModel):
    results: list[GeoResult]


class LocationInfo(BaseModel):
    name: str
    country: Optional[str] = None
    country_code: Optional[str] = None
    admin1: Optional[str] = None
    lat: float
    lon: float
    timezone: Optional[str] = None


class ParameterSeries(BaseModel):
    mean: list[Optional[float]]
    std: list[Optional[float]]
    models_used: list[str]
    model_count: list[int]
    unit: Optional[str] = None
    resolution: str


class ResolutionBlock(BaseModel):
    timestamps: list[str]
    parameters: dict[str, ParameterSeries]


class SunSeries(BaseModel):
    mean: list[Optional[float]]
    unit: str = "h"
    timestamps: Optional[list[str]] = None


class SunData(BaseModel):
    hourly: SunSeries
    ceiling: SunSeries
    daily: SunSeries


class WeatherAlert(BaseModel):
    id: str
    source: str
    severity: str
    severity_level: int
    event: Optional[str] = None
    headline: Optional[str] = None
    description: Optional[str] = None
    instruction: Optional[str] = None
    onset: Optional[str] = None
    expires: Optional[str] = None
    area: Optional[str] = None
    url: Optional[str] = None


class ForecastResponse(BaseModel):
    location: LocationInfo
    resolution: str
    hourly: ResolutionBlock
    daily: ResolutionBlock
    sun: Optional[SunData] = None
    alerts: list[WeatherAlert] = []
    models_requested: list[str]
    models_used: list[str]
    generated_at: str
    now: str


class FavoriteCreate(BaseModel):
    name: str
    country: Optional[str] = None
    country_code: Optional[str] = None
    admin1: Optional[str] = None
    latitude: float
    longitude: float
    timezone: Optional[str] = None


class Favorite(FavoriteCreate):
    id: str


class FavoritesResponse(BaseModel):
    favorites: list[Favorite]


class FavoriteOrder(BaseModel):
    ids: list[str]


class SmalltalkMetric(BaseModel):
    label: str
    value: str
    kind: str = "average"


class SmalltalkAlert(BaseModel):
    severity: str
    event: Optional[str] = None
    headline: Optional[str] = None
    area: Optional[str] = None
    onset: Optional[str] = None
    expires: Optional[str] = None


class SmalltalkRequest(BaseModel):
    language: str = "en"
    location: str
    country: Optional[str] = None
    admin1: Optional[str] = None
    mode: str = "hourly"
    metrics: list[SmalltalkMetric]
    alerts: list[SmalltalkAlert] = []


class SmalltalkResponse(BaseModel):
    text: str
