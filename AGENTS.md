# AGENTS.md

Short introduction for agents. The full documentation (setup, API, configuration,
limitations) is in **[README.md](./README.md)** – check there first if you have
questions.

## What this is

**MetaMeteo** – web app (FastAPI backend + static browser frontend) that
fetches a 7-day forecast for a location from several Open-Meteo weather models,
aggregates mean + spread per parameter and renders it as charts with Plotly. No
API key for the forecast, no scheduler. The only LLM call is the optional
smalltalk button (`POST /api/smalltalk`, DeepSeek, `DEEPSEEK_API_KEY` from
`.env`); the forecast pipeline itself is fully deterministic. Runs locally and as
a single Docker container on a PaaS (Render blueprint `render.yaml`, free plan);
favorites live in the browser, so no persistent disk is required.

## Structure

```
backend/
  main.py          # FastAPI app: /api/geocode, /api/forecast, /api/smalltalk, cache, StaticFiles
  config.py        # PARAMETER_SPECS, model lists, TTL, rate-limit settings, DISPLAY_NAMES, .env loading, DeepSeek settings
  models.py        # Pydantic response models + NormalizedForecast
  aggregation.py   # mean/std, circular aggregation, daily fallback
  cache.py         # in-memory TTL cache
  ratelimit.py     # in-memory per-IP sliding-window limiter for /api/smalltalk
  http.py          # get_with_retry: retry/backoff on transient 429/5xx
  sun.py           # Open-Meteo sunrise/sunset fetch + max-sunshine ceiling
  alerts.py        # warnings (Bright Sky/DWD for DE, NWS for US)
  smalltalk.py     # DeepSeek prompt + client for the smalltalk button
  sources/
    open_meteo.py  # Open-Meteo client, one request for all models
    geocoding.py   # Open-Meteo geocoding
    base.py        # ForecastSource(ABC)
  tests/           # pytest, run via backend/tests
frontend/
  index.html       # layout + CSS, loads Plotly via CDN; language select, data-i18n attributes
  i18n.js          # translations (de/en/fr/es/it), detectLang, t(), locale, cardinal directions
  app.js           # chart configuration (CHARTS), rendering, favorites, zoom sync
```

## Data flow

`sources/open_meteo.py` splits the single multi-model response into one
`NormalizedForecast` per model (`models.py`). `aggregation.aggregate()` builds from this a `ResolutionBlock`
with a `ParameterSeries` per parameter for each resolution (hourly/daily).
`main.py` caches and serves `ForecastResponse`. In parallel with the model
requests, `sun.py` fetches `sunrise`/`sunset` from Open-Meteo and derives the
max-sunshine ceiling (`ForecastResponse.sun`, hours, model-independent; `null`
on failure), and `alerts.py` fetches official warnings
(`ForecastResponse.alerts`; source by location `country_code`: DWD/Bright Sky
for DE, NWS for US, `[]` for every other country or on failure). The frontend
renders a chart card per entry in `CHARTS` (`frontend/app.js`); `STD` is drawn
as an error band.

## Important conventions

- **Define parameters centrally:** new metric = `ParameterSpec` in
  `backend/config.py` plus an entry in `CHARTS` in `frontend/app.js`. Aggregation
  and cache are generic and need no adjustment. Details in the README.
- **Circular quantities:** mark angle values (e.g. `wind_direction_10m`) with
  `circular=True`. `aggregation.py` then uses the vector mean
  (`sin`/`cos` → `atan2`) and circular standard deviation instead of the
  arithmetic mean. Never average angles arithmetically.
- **One Open-Meteo request for all models** (`models=a,b,c`), split from the
  suffixed response fields (`variable_model`); forecast/sun/alerts still run in
  parallel via `asyncio.gather`. Outbound calls use `get_with_retry`
  (`backend/http.py`) and a shared `HTTP_USER_AGENT`. A `429` in the forecast
  errors is detected in `frontend/app.js` and shown as
  `status.forecastRateLimited` (shared/datacenter IPs are commonly limited).
- **Warnings:** `alerts.py` picks the source by `country_code` (DE → Bright
  Sky, US → NWS) and normalises to `WeatherAlert` (CAP `severity` plus
  `severity_level` 1–4). Non-fatal (`[]` on error/unsupported country). The
  banner is rendered by `renderAlerts()` above the charts, texts localised via
  `alerts.*` keys. `country_code` and `lang` are part of the forecast cache key.
- **Missing values** are excluded, never treated as 0; if all are missing,
  `mean`/`std` are `null`.
- **Frontend console/DOM changes** without a build step: `frontend/app.js`
  is loaded directly.
- **Coloured zones in the chart:** via a `bands` field on the `CHARTS` entry
  (`{ from, to, label, color }`), `renderChart` renders filled areas, boundary
  lines and right-aligned labels; the y-axis scales dynamically to the data
  range. Example: the pressure bands in the air-pressure chart.
- **Feels-like overlay:** `apparent_temperature` is a dashed overlay on the
  temperature chart, marked `hourlyOnly: true`; `renderChart` skips it in the
  daily view. It has no uncertainty band. Legend order is set via `legendrank`
  (mean `1`, spread band `2`, overlays `3`).
- **Max-sunshine ceiling:** the sunshine chart (`sunCeiling: true` in `CHARTS`)
  draws `state.data.sun.ceiling` (fine-sampled, own `timestamps`) as a thin grey
  solid line (width 1.2, `SUN_CEILING_COLOR`) behind the mean line; `sun.daily`
  is used in the daily view. The fine sampling plus explicit sunrise/sunset ramp
  corners keeps both shoulders exactly one hour wide. `computeYRange` includes
  the ceiling max so it is never clipped. The ±1σ band is clamped to the
  astronomical maximum (`sun.hourly` per hour, `sun.daily` in the daily view) and
  to 0 via the optional cap in `buildTraces`/`seriesExtent`. The cloud-cover
  overlay is blue (`#60a5fa`) and dashed. The hourly value covers the hour ending
  at the timestamp (`[t − 1 h, t)`), matching Open-Meteo's accumulation window.
  Data comes from `sun.py` (separate Open-Meteo call, see README).
- **Combined precipitation chart:** `precipitation_probability` (line, left
  axis, indigo) and `precipitation` (bars, right axis, green) share one
  `CHARTS` entry. The title comes from `titleKey` ("Niederschlag"),
  `meanLabelKey` names the primary legend/hover, and the amount is an overlay
  `{ key, secondary: true, bars: true }` drawn by `overlayBars` as
  `type: "bar"` on `yaxis: "y2"` (unshifted so it stays behind the line) with an
  asymmetric ±1σ `error_y` (lower whisker capped at 0).
  Overlays may carry their own `annotations`/`dailyAnnotations`; their
  non-pinned boxes are anchored to the overlay axis (`yref: "y2"`), pinned ones
  to `paper`. `reserveTop: true` shrinks `yaxis.domain` to `[0, 0.82]` when
  top-pinned sum boxes exist, so the sums sit above the curve without overlap.
  The secondary range is derived from the overlay series (`axisMax` overrides,
  e.g. cloud cover 100). `collectSmalltalkMetrics` picks up the overlay
  highlights via `entry.annotationOverlays`.
- **Data start from now:** `ForecastResponse.now` (local time, `YYYY-MM-DDTHH:mm`)
  is set fresh per request. The frontend sets `xaxis.minallowed` to this value
  (hourly) or to 00:00 today (daily) so that past data stays invisible even via
  zoom/pan. The default hourly window is a sliding 3 days from now
  (`hourlyWindowEnd`, `HOURLY_WINDOW_DAYS`); a trailing calendar day with less
  than 3 h inside the window is dropped, and `dailyHighlights` uses only the
  visible part of that last day (analogous to the first day's `remaining <= 3`).
- **Refresh:** the refresh button calls `selectLocation(state.selected,
  { refresh: true })`; `refresh=1` on `/api/forecast` skips the TTL cache
  lookup, fetches fresh model data and then overwrites the cache entry.
  Additionally a cache buster `_=Date.now()`. `/api/*` is served via middleware
  with `Cache-Control: no-store`.
- **`generated_at`:** UTC timestamp of the last fresh model fetch, not updated on
  cache hits (no model-run timestamp). The frontend shows it as
  "Data fetched: …" with an explanatory tooltip
  (`location.updated`/`location.updatedTitle`).
- **Smalltalk button:** `#smalltalk` next to `#reset-zoom` collects
  `collectSmalltalkMetrics()` from the visible `state.plots` (per chart the mean
  over the visible range plus the stored `points` = daily highlights) and
  `collectSmalltalkAlerts()` (the five most severe `state.data.alerts`, with
  localised severity label) and posts them with place and `I18n.getLang()` to
  `/api/smalltalk`. The backend (`smalltalk.py`) calls DeepSeek with
  `DEEPSEEK_API_KEY` and returns a short, funny opener that is shown in the
  `#smalltalk-modal`; warnings in the payload are treated as the strongest hook.
  "Again" regenerates. The API key stays server-side. Missing key → `503`,
  upstream failure → `502`, rate limit → `429` (in-memory per-IP sliding window
  `ratelimit.py`, `SMALLTALK_RATE_LIMIT`/`SMALLTALK_RATE_WINDOW_SECONDS`).
- **Favorites:** purely client-side in `localStorage["metameteo.favorites"]`
  (`frontend/app.js`); there are no `/api/favorites` endpoints and no server
  state. Keeps the hosting target disk-less.
- **Deployment:** single Docker image (`Dockerfile`) serving frontend + API,
  `--workers 1` (in-memory cache/rate limit) and
  `--proxy-headers --forwarded-allow-ips=*` so the per-IP limit sees the real
  client IP. `render.yaml` is the Render blueprint (free plan, no disk,
  `healthCheckPath: /`); `DEEPSEEK_API_KEY` is set in the dashboard, not the repo.
- **Internationalisation:** no UI strings directly in the code – new texts as a
  key in all five languages in `frontend/i18n.js` (`TRANSLATIONS`), retrieved via
  `t()` (interpolation with `{{var}}`). `CHARTS` uses `labelKey`/`infoKey`
  (overlays, `direction`, `bands` analogous), resolved only at render time.
  Language: default from `navigator.languages`, persisted in
  `localStorage["metameteo.lang"]`; switching translates live without a new
  request (`changeLanguage` → `render()`). Language-specific also `LOCALES`,
  `CARDINALS`, `WEEKDAYS`, `TICK_FORMATS`, `gemName()`.
- **X-axis:** in hourly mode `hourlyTicks(range)` builds its own
  `tickvals`/`ticktext` (weekday from `I18n.weekdays()` at midnight, otherwise
  `HH:00`); step size from `[1,2,3,6,12,24]` such that ≤ 8 ticks result, start via
  `wallClockMs`/`isoLocal`. On zoom/pan, reset in the `plotly_relayout` handler
  via `hourlyTickLayout()` (together with the annotations in one
  `Plotly.relayout`). Daily mode: `tickmode: "array"` with all block timestamps
  centred in the day (`<day>T12:00`, `dailyPlotTimestamp`) as `tickvals` and
  `ticktext` from `weekdayName()` so that no day is omitted; the daily **data
  points/traces** use the same centred timestamps with a small marker per day, so
  the axis shows exactly one x gridline per day, while the raw timestamps stay in
  use for day grouping and the axis range. The alternating day shading
  (`dayShapes`) exists only in hourly mode; the daily view has no day areas.
  Weekdays always come from `I18n.weekdays()` (not from the Plotly locale, which
  is not reliable here).
- **Hover tooltips:** instead of `%{x}`/`hoverformat`, the x label is computed via
  `hoverXLabel()` in `frontend/app.js` and passed as the **last** `customdata`
  element: hourly `weekdayName + " HH:MM"` (e.g. `Thu 14:00`), daily only
  `weekdayName`. Templates use `%{customdata[2]}` (mean/overlay) or
  `%{customdata[4]}` (wind direction).
- **Number format:** always via `formatNumber`/`formatValue` in `frontend/app.js`
  (locale from `I18n.locale()`, one decimal place, unit). Plotly hover therefore
  uses preformatted values in `customdata` instead of `%{y:.2f}`, because
  otherwise Plotly uses a point as the decimal separator. Date ticks via
  `I18n.tickFormat(mode)`, hover date via the Plotly locale (`locale` in the
  `Plotly.newPlot` config, bundle from the Plotly CDN via `loadPlotlyLocale`).
- **Model info understated:** above the charts only the "daily only" badge
  remains. Model count and names are in the info popup behind the chart title
  (`chartInfoText`, keys `chart.infoModels`/`models.coverage`); it opens on hover
  and is pinned/unpinned by clicking the "i" (`closeInfoPopups` on outside
  click/`Esc`). The count is
  additionally in the hover tooltip of the values (stays there). The "Models used
  per parameter" list is a collapsed-by-default `<details>` panel; the model list
  in it links via `MODEL_DOCS` to the Open-Meteo docs page of the respective
  provider (link title `models.docsLinkTitle`, note `models.docsNote`).
- **Highlights in the chart:** mode-dependent. Hourly via the `annotations` field
  on the `CHARTS` entry (`{ type: "max" | "sum" }`); `dailyHighlights` aggregates
  the **hourly series** from `state.data.hourly` per calendar day (daily maximum
  or daily total). Daily via `dailyAnnotations` (`{ min, max, sum, pinSum }`), plus
  `dailyExtremes: true` for temperature, which replaces the daily mean with the
  per-day maximum (orange) and minimum (blue) lines; `dailyGroupedExtremes`
  derives both from the aggregated hourly series and carries the hourly `std` at
  the extreme hour, drawn as a ±1σ band per line. `rangeHighlights` computes the
  highlights over the **visible daily range** instead of per day, so the boxes
  follow the daily curve and re-scale on zoom; a point's `color` overrides the
  chart colour (temperature max/min boxes match their lines). `max`/`min` render
  as grey boxes with a coloured connector line without an arrowhead
  (`arrowhead: 0`, `min` below the point); `sum` as a box without a line, in the
  daily view labelled `Summe: …` (`chart.sumPrefix`) with a range tooltip
  (`sumRange` → annotation `hovertext` `chart.sumRangeNote`, also appended to the
  info text in daily mode);
  `pinToTop`/`pinSum` place it via `yref: "paper"` at the top edge.
  `computeYRange` scales the y-axis with extra headroom (`topFactor` 0.3 pinned,
  0.22 otherwise), includes the draw `extraExtent` (temperature max/min lines and
  their bands) and the min boxes. From the partial first day, only the visible
  remainder from `now` counts in hourly mode – and only if more than 3 h are left.
  Highlights that round to `0.0` are omitted. The daily x-axis extends to
  `nextDayString` of the last day so that the labels of the last day are not cut
  off.
- **Dynamic connector lines:** `dynamicArrow: true` on the `annotations` entry
  lets `resolveArrow`/`arrowOffset` tilt the headless line depending on x (point
  outside → label towards the centre, max. 45°, `standoff` keeps distance to the
  point). Active for the hourly max charts. `chartXContext` provides the visible
  x span; in daily mode `rebuildAnnotations` recomputes the points from the new
  range (and stores them in `entry.points` for the smalltalk button) via the
  `plotly_relayout` handler. `paintAnnotationsUnderBoxes` reorders the SVG via
  `plotly_afterplot` so that the box lies over the start of the line.

## Tests

```bash
source .venv/bin/activate
pytest
```

The test focus is the aggregation logic (mean/std, missing values, single-model
case, daily fallback, circular wind direction).

## Running

```bash
source .venv/bin/activate
uvicorn backend.main:app --reload
# http://localhost:8000
```

Alternatively `./start.command` (creates the venv, starts the server, opens the
browser).
