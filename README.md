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
  (right axis, %, blue `#60a5fa`) in the sunshine-hours chart. The
  sunshine-hours chart additionally shows the astronomically maximum possible
  sunshine duration as a thin grey solid line in the background: Open-Meteo
  `sunrise`/`sunset` are turned into the day/night share of each hour (partial
  hours at the boundaries) and the day length for the daily view, so the actual
  model hours can be read against the physical upper bound. Because Open-Meteo's
  hourly `sunshine_duration` covers the preceding hour, the hourly ceiling uses
  the interval `[t − 1 h, t)` so both bins line up. The ceiling is drawn from a
  finely sampled series (10 min plus the exact ramp corners at sunrise/sunset),
  so both shoulders are exactly one hour wide regardless of where the sun event
  falls within the hour; coarse hourly sampling would make them look asymmetric
  (1 vs. 2 bins). The ±1σ error band is clamped to the astronomical maximum (and
  to 0), so it never exceeds the physical bound. Its hover shows the label and
  value.
- Coloured pressure bands in the air-pressure chart: `<1000` low pressure,
  `1000–1013` slightly below average, `1013–1025` normal range, `>1025` high
  pressure – each with a right-aligned label. Because `pressure_msl` is reduced
  to sea level, the thresholds apply regardless of the location's altitude. The
  y-axis scales dynamically to the data range so that only the relevant bands are
  visible.
- "hourly / daily" toggle; hourly starts the view with a sliding 3-day window
  from now (zoom out for all 7 days). A trailing calendar day is only included
  if at least 3 hours of it fall inside the window, otherwise the window ends at
  its midnight.
- Highlights directly in the chart. In the hourly view, temperature, wind, UV
  index, precipitation probability and air pressure show the daily maximum per
  day, precipitation amount and sunshine hours the daily total; the values are
  computed from the hourly series (`max`/`sum` per calendar day). Max charts use
  a grey box (`#222e40`) with a coloured border, coloured value and a dynamic
  connector line without an arrowhead (the further the peak lies towards the
  outside, the flatter the line points to the opposite side, max. 45°); the sum
  box sits centred in the day without a line, and for sunshine hours it is
  additionally pinned to the top edge (`pinToTop`) with headroom so that it does
  not collide with the curve. From the partial (first) day only the remaining
  hours appear, and only if more than three hours are left; the value and
  position then refer to the visible remainder. The boxes are painted over the
  line's start and recalculated on zoom/pan/reset.
- Daily view highlights instead refer to the visible period rather than to
  individual days: the highest and lowest value (temperature, sunshine hours,
  air pressure), the highest value (wind, UV index, precipitation probability,
  precipitation amount) and, for precipitation amount and sunshine hours, the
  period total pinned to the top edge. They therefore follow the daily curve and
  re-scale when zooming. The temperature chart shows only the daily maximum
  (orange) and the daily minimum (blue) per day instead of the daily mean, both
  derived from the hourly series and each with a ±1σ band taken from the hourly
  spread at the extreme hour; the highlight boxes use the colour of the
  respective line. (The feels-like overlay is currently commented out.)
  Highlights that round to `0.0` are omitted. All daily data points sit centred
  in their day (`<day>T12:00`), like the daily x labels, so the first and last
  days are fully visible. Configuration is via `annotations` (hourly) and
  `dailyAnnotations` (daily) in the respective `CHARTS` entry.
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
  today at 00:00. The default hourly window spans 3 days from now
  (`hourlyWindowEnd`); its trailing partial day follows the same 3-hour rule as
  the first day's daily highlight.
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
- "Help – I need a smalltalk topic" button next to "Reset zoom": sends the
  averages of the visible series (temperature incl. feels-like, sunshine, cloud
  cover, wind, precipitation probability, precipitation, UV index, air pressure),
  the daily highlights currently shown and any active weather warnings (the five
  most severe, with level, event, area and validity), together with the place, to
  DeepSeek and shows a short, funny opener in a modal. The warnings are treated as
  the strongest hook and woven into the joke without sounding alarming. The
  generated text follows the selected interface language and can be regenerated
  ("Again"). Requires a `DEEPSEEK_API_KEY` in `.env`; the key never reaches the
  browser.
- Weather warnings above the charts: fetched in parallel with the forecast and
  rendered as a severity-coloured banner (CAP levels minor/moderate/severe/
  extreme → yellow/orange/red/violet) with an expandable description and
  instruction. The source depends on the country of the location: DWD/Bright Sky
  for Germany (point-accurate, German/English text) and NWS (`api.weather.gov`)
  for the US. Other countries have no warning source and show no banner. Without
  an active warning the banner stays hidden. A failed warning request never fails
  the forecast; it simply yields no alerts.
- Short-lived in-memory cache (TTL 10 minutes), key = coordinates + model
  selection + country code + UI language.
- No scheduler, no scraping, no API key for the forecast itself. The forecast
  pipeline uses no LLM; the optional smalltalk button is the only DeepSeek call.

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

Returns a list of possible places (`name`, `country`, `country_code`, `admin1`,
`latitude`, `longitude`, `timezone`) for disambiguation.

### `GET /api/forecast`

| Parameter | Description |
| --- | --- |
| `lat`, `lon` | Coordinates (required) |
| `days` | Forecast days, 1–16 (default 7) |
| `models` | Comma-separated model list (default from config) |
| `name`, `country`, `country_code`, `admin1`, `tz` | Optional metadata for display and for picking the warning source |
| `lang` | UI language (affects the warning texts): `de`, `en`, `fr`, `es`, `it` (default `de`) |
| `refresh` | `true` to bypass the cache and load fresh model data |

Response (abridged):

```json
{
  "location": {"name": "Berlin", "country": "Germany", "country_code": "DE", "lat": 52.52, "lon": 13.41, "timezone": "Europe/Berlin"},
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
  "sun": {
    "hourly": {"mean": [0.0, 0.0, 0.2167, 1.0, "..."], "unit": "h"},
    "ceiling": {
      "timestamps": ["2026-09-16T00:00", "2026-09-16T00:10", "..."],
      "mean": [0.0, 0.0, "...", 1.0, "..."],
      "unit": "h"
    },
    "daily": {"mean": [12.4167, "..."], "unit": "h"}
  },
  "alerts": [
    {
      "id": "2.49.0.0.276.0.DWD.PVW....",
      "source": "brightsky",
      "severity": "moderate",
      "severity_level": 2,
      "event": "STURMBÖEN",
      "headline": "Amtliche WARNUNG vor STURMBÖEN",
      "description": "Es treten Sturmböen ...",
      "instruction": "frei stehende Objekte sichern ...",
      "onset": "2026-09-20T10:00:00+00:00",
      "expires": "2026-09-20T18:00:00+00:00",
      "area": null,
      "url": null
    }
  ],
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

`sun` is derived independently of the weather models from a separate Open-Meteo
call (`daily=sunrise,sunset`) and is `null` if that call fails. `sun.hourly.mean`
holds the maximum possible sunshine duration of each hour in hours (0–1,
including partial hours at sunrise/sunset) and is aligned by index with the
hourly timestamps; it is used to cap the error band. `sun.ceiling` is the same
bound finely sampled (10 min plus the exact sunrise/sunset ramp corners) with its
own `timestamps` and is what the frontend draws as the grey line, so both
shoulders are exactly one hour wide. `sun.daily.mean` is the day length aligned
with the daily timestamps (line and band cap in the daily view). The hourly value
refers to the hour ending at the timestamp (`[t − 1 h, t)`), matching Open-Meteo's
accumulation window. All three are only used by the sunshine-hours chart.

`alerts` holds the active official weather warnings for the location, sorted by
severity (highest first) and then by onset. The `source` decides the provider:
`brightsky` (DWD, only `country_code=DE`, point-accurate, text chosen from the
`_de`/`_en` variants according to `lang`) or `nws` (US, `country_code=US`,
point-accurate, English). For every other country the list stays empty – there
is no worldwide warning source. `severity` is the CAP level
(`minor`/`moderate`/`severe`/`extreme`) with `severity_level` 1–4 for colouring.
Warnings are fetched in parallel with the models; a failure or an unsupported
country simply yields `[]` and never fails the whole forecast. Because the
alerts are part of the cached forecast, the cache key includes `country_code`
and `lang`.

### `POST /api/smalltalk`

Generates a short smalltalk opener with DeepSeek from the weather figures the
frontend currently shows. The request is built entirely in the browser, so the
server stays stateless here.

| Field | Description |
| --- | --- |
| `language` | Interface language for the answer: `de`, `en`, `fr`, `es`, `it` |
| `location`, `admin1`, `country` | Place metadata for the prompt |
| `mode` | `hourly` or `daily` (currently displayed view) |
| `metrics` | List of `{label, value, kind}` – `kind` is `average` or `highlight` |
| `alerts` | Optional list of active warnings `{severity, event, headline, area, onset, expires}` (localised `severity` label); folded into the prompt as the strongest hook |

Response: `{"text": "..."}`. Status `503` if `DEEPSEEK_API_KEY` is not set,
`502` if DeepSeek is unreachable or returns nothing usable.

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

The smalltalk feature additionally reads `DEEPSEEK_API_KEY` from the environment
(or a `.env` file in the project root, loaded via `python-dotenv`); create a
`.env` with `DEEPSEEK_API_KEY=<your key>`. `DEEPSEEK_MODEL` defaults to
`deepseek-chat` (`backend/config.py`). Without a key the endpoint answers `503`
and the button shows the corresponding error.

Adding a metric: add a `ParameterSpec` in `backend/config.py` and an entry in the
`CHARTS` list in `frontend/app.js` (with label, colour, tooltip). Aggregation and
caching are generic and need no adjustment. For angle quantities set
`circular=True` so that the vector mean is used instead of the arithmetic mean.
If the quantity should appear as arrows in an existing chart, add
`direction: { key, label }` to the frontend entry instead of creating a separate
chart. For hourly highlights set `annotations: { type: "max" | "sum" }`: `max`
shows the daily maximum at the position of the peak with a connector line
without an arrowhead (optional `dynamicArrow: true` for x-dependent tilting,
max. 45°, recalculation on zoom/pan/reset); `sum` the daily total without a line,
centred in the day. For the daily view set `dailyAnnotations:
{ min, max, sum, pinSum }` (range highlights over the visible period) and
optionally `dailyExtremes: true` to draw the per-day maximum/minimum lines.

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
    sun.py               # sunrise/sunset fetch + max-sunshine ceiling
    alerts.py            # weather warnings (Bright Sky / NWS)
    smalltalk.py         # DeepSeek prompt + client for the smalltalk button
    sources/
      base.py            # ForecastSource(ABC)
      open_meteo.py      # Open-Meteo forecast client (one request per model)
      geocoding.py       # Open-Meteo geocoding client
    tests/
      test_aggregation.py
      test_parameters.py
      test_favorites.py
      test_local_now.py
      test_sun.py
      test_alerts.py
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
  automatic reload/scheduler, server deployment (Docker). The smalltalk opener
  is the only LLM use; a general LLM summary of the forecast is not planned.

## Manually tested locations

Berlin (Central Europe), Bremerhaven (coast) and Innsbruck (mountain) with the
default models, as well as Tokyo (with
`models=jma_seamless,gfs_seamless,ecmwf_ifs025`). All parameters provide
plausible values; model coverage (info tooltip and collapsed model panel) is
displayed correctly in the frontend.
