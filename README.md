# MetaMeteo

Local web app (backend + browser frontend) that fetches a 7-day forecast for a
location from several independent weather models, computes the mean and spread
(standard deviation) between the models for each quantity (temperature, wind,
wind direction, UV index, precipitation probability, precipitation amount,
sunshine hours, apparent temperature, cloud cover, air pressure) and displays it
as a chart with an error band. Wind direction is a circular quantity and is
averaged as a vector mean (vector sum) instead of an arithmetic mean.

## Features (v1)

- Place search with autocomplete via the Open-Meteo Geocoding API.
- Fetches several models via the Open-Meteo Forecast API – one request per model,
  in parallel via `asyncio.gather`.
- Aggregation: mean + population standard deviation across all models that
  provide a value for the respective time step. Missing values are excluded (not
  treated as 0).
- Circular aggregation: direction values (e.g. 350° and 10°) are averaged via
  unit vectors (`sin`/`cos` → `atan2`); the spread is the circular standard
  deviation `sqrt(-2·ln R)`.
- Error band as `mean ± 1σ` in one Plotly chart per parameter.
- Wind direction as rotated arrows in the wind chart (flow direction, i.e. the
  arrow points where the wind is blowing to). Arrows with high model disagreement
  become more transparent; hover shows cardinal direction, degrees, spread and
  model count.
- Dashed overlays: apparent temperature in the temperature chart, cloud cover
  (right axis, %) in the sunshine-hours chart.
- Coloured pressure bands in the air-pressure chart: `<1000` low pressure,
  `1000–1013` slightly below average, `1013–1025` normal range, `>1025` high
  pressure – each with a right-aligned label. Because `pressure_msl` is reduced
  to sea level, the thresholds apply regardless of the location's altitude. The
  y-axis scales dynamically to the data range so that only the relevant bands are
  visible.
- "hourly / daily" toggle; hourly starts the view with the first 3 days (zoom out
  for all 7 days).
- Daily highlights directly in the chart: temperature, wind, UV index,
  precipitation probability and air pressure show the daily maximum per day,
  precipitation amount and sunshine hours the daily total. The values are always
  computed from the hourly series (`max` or `sum` per calendar day) so that they
  are also correct in the daily view. Max charts use a grey box (`#222e40`) with
  a coloured border, coloured value and a dynamic connector line without an
  arrowhead – the further the daily peak lies towards the outside, the flatter
  the line points to the opposite side (max. 45°, `standoff` keeps distance to
  the point); the box is painted over the line's start and recalculated on
  zoom/pan/reset. The sum box for precipitation amount sits centred in the day
  without a line; the one for sunshine hours additionally floats at the top edge
  of the chart (`pinToTop`) with some headroom so that the y-axis scales to the
  hourly series but the value does not collide with the curve. From the partial
  (first) day, only the remaining hours appear in hourly mode and only if more
  than three hours are left; the value and position then refer to the visible
  remainder. In daily mode the full day is used. Highlights that round to `0.0`
  are omitted; configuration is via the `annotations` field in the respective
  `CHARTS` entry.
- Consistent number notation: all values in hover tooltips and chart annotations
  are output with one decimal place and a unit (e.g. `23.4 °C`, `3.2 mm`).
  Formatting is centralised via `formatNumber`/`formatValue` with the
  language-dependent locale in `frontend/app.js`.
- Multilingual interface: German, English, French, Spanish and Italian,
  switchable at the top of the header. The default comes from the browser
  language, the selection is stored in `localStorage` (`metameteo.lang`).
  Switching translates all texts as well as number and date formats live –
  without a reload and without a new forecast request (the data itself is
  language-independent). Units remain the same in every language (no Fahrenheit
  etc.). The translations and format definitions are centralised in
  `frontend/i18n.js`.
- Data start from "now": the hourly graph begins at the current minute (local
  time of the location). A hard axis limit (`xaxis.minallowed`) prevents past
  hours from becoming visible – even via zoom or pan. The daily chart starts with
  today at 00:00.
- Zoom sync: the "Apply zoom to all" button in each chart transfers the visible
  time range to all other charts; "Reset zoom" restores the default view.
- Refresh: the button reloads the forecast for the current location and bypasses
  the server cache (`refresh=1`) so that fresh model data is fetched without
  changing the location. The displayed value "Data fetched: …" is the server
  timestamp of this fresh fetch (not the model run); on cache hits it stays
  unchanged, and a tooltip explains this.
- Favorites: add/remove a location via the star; chips to the right of the
  search, clickable, sortable via drag & drop, persisted server-side in
  `data/favorites.json`.
- Transparency: per parameter, a collapsed-by-default area ("Models used per
  parameter") lists which models contributed and which are missing; the model
  list above links each model name to the matching Open-Meteo documentation.
  Above the charts only the "daily only" badge remains; model count and names are
  in the info tooltip behind the chart title, and the count is also in the hover
  tooltip of the values.
- Short-lived in-memory cache (TTL 10 minutes), key = coordinates + model
  selection.
- No scheduler, no scraping, no API key, no LLM at runtime.

## Languages and number formats

The interface runs in five languages; the selection is at the top right and is
stored in `localStorage`. On the first visit the browser language decides
(`navigator.languages`), otherwise English.

| Language | Locale | Decimal separator | Example (1013.2 hPa) |
| --- | --- | --- | --- |
| German | `de-DE` | comma | `1.013,2` |
| English | `en-GB` | point | `1,013.2` |
| French | `fr-FR` | comma | `1 013,2` |
| Spanish | `es-ES` | comma | `1013,2` |
| Italian | `it-IT` | comma | `1013,2` |

Only English uses the point as the decimal separator. The numbers come from
`Intl.NumberFormat`, the date formats ("Fetched") from the respective locale; for
the Plotly interface the locale bundles are additionally loaded from the Plotly
CDN. The weekday abbreviations of the charts deliberately come from
`I18n.WEEKDAYS` instead of the Plotly locale so that they remain correct even
without locale registration. For four-digit values, Spanish and Italian do not
group, in line with the standard (`1013,2` instead of `1.013,2`); this is CLDR
behaviour and deliberately left as is.

The x-axis labels the charts in the correct language: in hourly mode the weekday
abbreviation appears at day boundaries (midnight) (e.g. `Mo`, `Thu`, `Jeu`,
`Jue`, `Gio`), the time in between; in daily mode every day is labelled with its
weekday, no day is omitted. Tick positions are chosen to match the visible span
and recalculated on zoom/pan.

The hover tooltip shows the same weekday abbreviation instead of the date: in
hourly mode together with the time (e.g. `Thu 14:00`), in daily mode as the sole
abbreviation. The abbreviation is computed from the x value and passed to the
hover templates as `customdata`.

To add a new language: add an entry in `TRANSLATIONS`, `LOCALES`, `CARDINALS`,
`TICK_FORMATS` and `LANGUAGES` in `frontend/i18n.js` (all keys must be present)
as well as the language in `GEOCODE_LANGUAGES` in `backend/config.py` for
localised place names. The frontend builds the selection automatically from this.

## Setup

Requirement: **Python 3.11+** (tested with 3.12). The standard `python3` on macOS
may be older – therefore use `python3.12` explicitly below.

```bash
cd meta-meteo
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Running

```bash
source .venv/bin/activate
uvicorn backend.main:app --reload
```

Then open in the browser:

```text
http://localhost:8000
```

The frontend is served by the backend as a static file, so no separate web server
and no CORS configuration is needed.

Alternatively use the start script (creates the venv if needed, starts the server
and opens the browser):

```bash
./start.command
# or by double-clicking in Finder
```

The port can be changed via the environment variable `META_METEO_PORT` (default
8000).

## Tests

```bash
source .venv/bin/activate
pytest
```

The tests cover the aggregation logic: mean/population std, exclusion of missing
values, single-model case (std = 0), completely missing series, the fallback to
daily values, the circular aggregation of wind direction (vector mean across the
north point, circular spread, daily fallback) as well as the local-time
calculation (`now`) incl. UTC fallback.

## API

### `GET /api/geocode`

| Parameter | Description |
| --- | --- |
| `query` | Search term (required) |
| `count` | Max. results, 1–20 (default 8) |
| `lang` | Language of place names: `de`, `en`, `fr`, `es`, `it` (default `de`) |

Returns a list of possible places (`name`, `country`, `admin1`, `latitude`,
`longitude`, `timezone`) for disambiguation.

### `GET /api/forecast`

| Parameter | Description |
| --- | --- |
| `lat`, `lon` | Coordinates (required) |
| `days` | Forecast days, 1–16 (default 7) |
| `models` | Comma-separated model list (default from config) |
| `name`, `country`, `admin1`, `tz` | Optional metadata for display |
| `refresh` | `true` to bypass the cache and load fresh model data |

Response (abridged):

```json
{
  "location": {"name": "Berlin", "country": "Germany", "lat": 52.52, "lon": 13.41, "timezone": "Europe/Berlin"},
  "resolution": "hourly",
  "hourly": {
    "timestamps": ["2026-09-16T00:00", "..."],
    "parameters": {
      "temperature_2m": {
        "mean": [20.25, "..."],
        "std": [0.79, "..."],
        "models_used": ["icon_seamless", "gfs_seamless"],
        "model_count": [6, 6],
        "unit": "°C",
        "resolution": "hourly"
      }
    }
  },
  "daily": {"timestamps": ["2026-09-16", "..."], "parameters": {"...": {}}},
  "models_requested": ["icon_seamless", "gfs_seamless", "..."],
  "models_used": ["icon_seamless", "gfs_seamless", "..."],
  "generated_at": "2026-09-16T17:27:21+00:00",
  "now": "2026-09-16T19:34"
}
```

`now` is the current local time of the location in the format
`YYYY-MM-DDTHH:mm` (without timezone offset, identical to the timestamps) and is
set fresh on every request – including cache hits. The frontend uses it as the
start limit of the x-axis.

`generated_at` is the UTC timestamp at which the forecast was last freshly
fetched from Open-Meteo and aggregated. On a cache hit the existing value is
returned unchanged; `refresh=true` produces a new value. It is explicitly **not**
a model-run timestamp (Open-Meteo does not provide this in the fields used). API
responses receive `Cache-Control: no-store` so the browser does not cache by
itself; additionally the frontend appends a cache buster on refresh.

`std` is the population standard deviation (`ddof=0`) across all models with a
value. With exactly one model `std = 0`; with no model `mean`/`std` are `null`.
`hourly` and `daily` are always both included, the toggle in the frontend works
without a new request.

### Favorites endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/favorites` | List in stored order |
| `POST` | `/api/favorites` | Add favorite (duplicates are ignored) |
| `DELETE` | `/api/favorites/{id}` | Remove favorite (`id` = `lat,lon` to 4 decimals) |
| `PUT` | `/api/favorites/order` | Set order (`{"ids": [...]}`) |

All endpoints return `{"favorites": [...]}`. Storage is in
`data/favorites.json` (created on first write, is gitignored).

## Configuration

`backend/config.py` controls:

- `DEFAULT_MODELS` – default selection for Central Europe:
  `icon_seamless`, `gfs_seamless`, `ecmwf_ifs025`, `gem_seamless`,
  `ukmo_seamless`, `meteofrance_seamless`.
- `ALLOWED_MODELS` – additionally `jma_seamless` (especially useful for the
  Asia-Pacific region).
- `PARAMETER_SPECS` – per parameter the hourly/daily API variable, optional
  display unit, scale factor and `circular` flag. From this, `CANONICAL_PARAMS`,
  `HOURLY_VARIABLES`, `DAILY_VARIABLES`, `VALUE_SCALES`, `UNIT_OVERRIDES` and
  `CIRCULAR_PARAMS` are derived. New metrics are added here (plus an entry in the
  frontend). Example sunshine hours: `sunshine_duration`, `scale=1/3600`,
  `unit="h"`. Example wind direction: `wind_direction_10m`, `unit="°"`,
  `circular=True`, daily `wind_direction_10m_dominant`.
- `CACHE_TTL_SECONDS`, `FORECAST_MAX_DAYS`, `DISPLAY_NAMES`.

The model selection is therefore changeable in one place and is overridden per
request via the query parameter `models`.

Adding a metric: add a `ParameterSpec` in `backend/config.py` and an entry in the
`CHARTS` list in `frontend/app.js` (with label, colour, tooltip). Aggregation and
caching are generic and need no adjustment. For angle quantities set
`circular=True` so that the vector mean is used instead of the arithmetic mean.
If the quantity should appear as arrows in an existing chart, add
`direction: { key, label }` to the frontend entry instead of creating a separate
chart. For a daily highlight in the chart set
`annotations: { type: "max" | "sum" }`. `max` shows the daily maximum at the
position of the peak with a connector line without an arrowhead (optional
`dynamicArrow: true` for x-dependent tilting, max. 45°, recalculation on
zoom/pan/reset); `sum` the daily total without a line, centred in the day.

## Known limitation: UV index

With the default models **only `gfs_seamless`** provides a UV index (hourly and
daily); the others return `null` arrays (no error). A UV error band across
multiple models is therefore currently not possible – the frontend indicates only
one model used in the info tooltip of the UV chart. The aggregation logic remains
generic: as soon as more models provide UV, they flow in automatically.

## Further model limitations

`precipitation_probability` is missing from `ukmo_seamless`,
`meteofrance_seamless` and `jma_seamless`; the aggregation then uses only the
available models and lists them under "Models used per parameter".

`sunshine_duration` is provided by `ukmo_seamless` only for ~2.6 days and by
`meteofrance_seamless` for ~5 days; the model count therefore drops towards the
end of the period and is shown in the frontend in the chart's info tooltip as
"Model count over the period: X–Y".

## Project structure

```
meta-meteo/
  backend/
    main.py              # FastAPI app, endpoints, cache, StaticFiles
    config.py            # model selection, parameter name mapping, TTL, data paths
    models.py            # Pydantic models + NormalizedForecast
    aggregation.py       # mean/std, daily fallback
    cache.py             # TTL cache
    favorites.py         # FavoritesStore (JSON persistence)
    sources/
      base.py            # ForecastSource(ABC)
      open_meteo.py      # Open-Meteo forecast client (one request per model)
      geocoding.py       # Open-Meteo geocoding client
    tests/
      test_aggregation.py
      test_parameters.py
      test_favorites.py
      test_local_now.py
  frontend/
    index.html
    i18n.js              # translations, language detection, locale/cardinal directions
    app.js
  requirements.txt
  pytest.ini
  AGENTS.md            # short overview for agents (references this README)
  README.md            # detailed docs (setup, API, configuration)
```

## Extensibility

- Every data source implements `ForecastSource.fetch(lat, lon, days) ->
  NormalizedForecast`. The aggregation works exclusively on this normalised
  format – additional sources (e.g. scraping) can be added as extra `Source`
  classes to the `asyncio.gather` list in `main.py` without changing the
  aggregation logic.
- The model selection lives in `backend/config.py`, not hard-coded.
- Deliberately **not** in v1: scraping sources, multi-location comparison,
  automatic reload/scheduler, server deployment (Docker), optional LLM summary.

## Manually tested locations

Berlin (Central Europe), Bremerhaven (coast) and Innsbruck (mountain) with the
default models, as well as Tokyo (with
`models=jma_seamless,gfs_seamless,ecmwf_ifs025`). All parameters provide
plausible values; model coverage (info tooltip and collapsed model panel) is
displayed correctly in the frontend.
