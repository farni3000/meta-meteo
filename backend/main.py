from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles

from .aggregation import aggregate
from .cache import TTLCache
from .config import (
    CACHE_TTL_SECONDS,
    DEFAULT_FORECAST_DAYS,
    DEFAULT_GEOCODE_LANGUAGE,
    DEFAULT_MODELS,
    FAVORITES_PATH,
    FORECAST_MAX_DAYS,
    GEOCODE_LANGUAGES,
    HTTP_TIMEOUT_SECONDS,
    settings,
)
from .favorites import FavoritesStore, favorite_id
from .models import (
    Favorite,
    FavoriteCreate,
    FavoriteOrder,
    FavoritesResponse,
    ForecastResponse,
    GeocodeResponse,
    LocationInfo,
    NormalizedForecast,
    SmalltalkRequest,
    SmalltalkResponse,
)
from .smalltalk import generate_smalltalk
from .sources.geocoding import GeocodingClient
from .sources.open_meteo import OpenMeteoForecastSource
from .sun import SunTimes, build_sun_data, fetch_sun_times

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
_cache = TTLCache(CACHE_TTL_SECONDS)
_favorites = FavoritesStore(FAVORITES_PATH)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
        app.state.client = client
        app.state.geocoder = GeocodingClient(client)
        yield


app = FastAPI(title="MetaMeteo", version="1.0.0", lifespan=lifespan)


@app.middleware("http")
async def disable_frontend_cache(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    elif path == "/" or path.endswith((".html", ".js", ".css")):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


@app.get("/api/geocode", response_model=GeocodeResponse)
async def geocode(
    query: str = Query(..., min_length=1),
    count: int = Query(8, ge=1, le=20),
    lang: str = Query(DEFAULT_GEOCODE_LANGUAGE),
) -> GeocodeResponse:
    if lang not in GEOCODE_LANGUAGES:
        lang = DEFAULT_GEOCODE_LANGUAGE
    try:
        results = await app.state.geocoder.search(query, count=count, language=lang)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Geocoding fehlgeschlagen: {exc}") from exc
    return GeocodeResponse(results=results)


def _local_now(tz_name: Optional[str]) -> str:
    try:
        tz = ZoneInfo(tz_name) if tz_name else timezone.utc
    except (ZoneInfoNotFoundError, ValueError):
        tz = timezone.utc
    return datetime.now(tz).strftime("%Y-%m-%dT%H:%M")


def _resolve_models(models: Optional[str]) -> list[str]:
    if not models:
        return list(DEFAULT_MODELS)
    model_list = [name.strip() for name in models.split(",") if name.strip()]
    if not model_list:
        return list(DEFAULT_MODELS)
    unknown = [name for name in model_list if name not in settings.allowed_models]
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"Unbekannte Modelle: {', '.join(unknown)}",
        )
    return model_list


@app.get("/api/forecast", response_model=ForecastResponse)
async def forecast(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    days: int = Query(DEFAULT_FORECAST_DAYS, ge=1, le=FORECAST_MAX_DAYS),
    models: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    admin1: Optional[str] = Query(None),
    tz: Optional[str] = Query(None),
    refresh: bool = Query(False),
) -> ForecastResponse:
    model_list = _resolve_models(models)
    cache_key = f"{lat:.3f}:{lon:.3f}:{days}:{','.join(sorted(model_list))}"
    cached = None if refresh else _cache.get(cache_key)
    if cached is not None:
        cached.now = _local_now(cached.location.timezone)
        return cached

    client: httpx.AsyncClient = app.state.client
    tasks = [
        OpenMeteoForecastSource(client, model).fetch(lat, lon, days)
        for model in model_list
    ]
    gathered = await asyncio.gather(
        *tasks, fetch_sun_times(client, lat, lon, days), return_exceptions=True
    )
    results = gathered[:-1]
    sun_times = gathered[-1]

    forecasts: list[NormalizedForecast] = []
    errors: list[str] = []
    for model, result in zip(model_list, results):
        if isinstance(result, NormalizedForecast):
            forecasts.append(result)
        else:
            errors.append(f"{model}: {result}")

    if not forecasts:
        raise HTTPException(
            status_code=502,
            detail={"message": "Keine Modell-Daten verfügbar", "errors": errors},
        )

    hourly_block, daily_block, models_used = aggregate(forecasts)
    sun = (
        build_sun_data(hourly_block.timestamps, daily_block.timestamps, sun_times)
        if isinstance(sun_times, SunTimes)
        else None
    )

    location = LocationInfo(
        name=name or f"{lat:.4f}, {lon:.4f}",
        country=country,
        admin1=admin1,
        lat=lat,
        lon=lon,
        timezone=tz or forecasts[0].timezone,
    )
    response = ForecastResponse(
        location=location,
        resolution="hourly",
        hourly=hourly_block,
        daily=daily_block,
        sun=sun,
        models_requested=model_list,
        models_used=models_used,
        generated_at=datetime.now(timezone.utc).isoformat(),
        now=_local_now(location.timezone),
    )
    _cache.set(cache_key, response)
    return response


@app.post("/api/smalltalk", response_model=SmalltalkResponse)
async def smalltalk(payload: SmalltalkRequest) -> SmalltalkResponse:
    if not settings.deepseek_api_key:
        raise HTTPException(
            status_code=503,
            detail="DEEPSEEK_API_KEY ist nicht gesetzt",
        )
    if not payload.metrics:
        raise HTTPException(status_code=422, detail="Keine Wetterdaten übermittelt")
    client: httpx.AsyncClient = app.state.client
    try:
        text = await generate_smalltalk(
            client,
            payload,
            api_key=settings.deepseek_api_key,
            model=settings.deepseek_model,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"DeepSeek nicht erreichbar: {exc}",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return SmalltalkResponse(text=text)


@app.get("/api/favorites", response_model=FavoritesResponse)
async def list_favorites() -> FavoritesResponse:
    return FavoritesResponse(favorites=_favorites.list())


@app.post("/api/favorites", response_model=FavoritesResponse)
async def add_favorite(payload: FavoriteCreate) -> FavoritesResponse:
    favorite = Favorite(
        id=favorite_id(payload.latitude, payload.longitude),
        **payload.model_dump(),
    )
    return FavoritesResponse(favorites=_favorites.add(favorite))


@app.delete("/api/favorites/{favorite_id_value}", response_model=FavoritesResponse)
async def delete_favorite(favorite_id_value: str) -> FavoritesResponse:
    return FavoritesResponse(favorites=_favorites.remove(favorite_id_value))


@app.put("/api/favorites/order", response_model=FavoritesResponse)
async def reorder_favorites(payload: FavoriteOrder) -> FavoritesResponse:
    return FavoritesResponse(favorites=_favorites.reorder(payload.ids))


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
