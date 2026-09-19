# AGENTS.md

Short introduction for agents. The full documentation (setup, API, configuration,
limitations) is in **[README.md](./README.md)** – check there first if you have
questions.

## What this is

**MetaMeteo** – local web app (FastAPI backend + static browser frontend) that
fetches a 7-day forecast for a location from several Open-Meteo weather models,
aggregates mean + spread per parameter and renders it as charts with Plotly. No
API key for the forecast, no scheduler. The only LLM call is the optional
smalltalk button (`POST /api/smalltalk`, DeepSeek, `DEEPSEEK_API_KEY` from
`.env`); the forecast pipeline itself is fully deterministic.

## Structure

```
backend/
  main.py          # FastAPI app: /api/geocode, /api/forecast, /api/smalltalk, /api/favorites, cache, StaticFiles
  config.py        # PARAMETER_SPECS, model lists, TTL, DISPLAY_NAMES, .env loading, DeepSeek settings
  models.py        # Pydantic response models + NormalizedForecast
  aggregation.py   # mean/std, circular aggregation, daily fallback
  cache.py         # in-memory TTL cache
  favorites.py     # JSON persistence (data/favorites.json)
  sun.py           # Open-Meteo sunrise/sunset fetch + max-sunshine ceiling
  smalltalk.py     # DeepSeek prompt + client for the smalltalk button
  sources/
    open_meteo.py  # Open-Meteo client, one request per model
    geocoding.py   # Open-Meteo geocoding
    base.py        # ForecastSource(ABC)
  tests/           # pytest, run via backend/tests
frontend/
  index.html       # layout + CSS, loads Plotly via CDN; language select, data-i18n attributes
  i18n.js          # translations (de/en/fr/es/it), detectLang, t(), locale, cardinal directions
  app.js           # chart configuration (CHARTS), rendering, favorites, zoom sync
```

## Data flow

`sources/open_meteo.py` normalises each model response into `NormalizedForecast`
(`models.py`). `aggregation.aggregate()` builds from this a `ResolutionBlock`
with a `ParameterSeries` per parameter for each resolution (hourly/daily).
`main.py` caches and serves `ForecastResponse`. In parallel with the model
requests, `sun.py` fetches `sunrise`/`sunset` from Open-Meteo and derives the
max-sunshine ceiling (`ForecastResponse.sun`, hours, model-independent; `null`
on failure). The frontend renders a chart card per entry in `CHARTS`
(`frontend/app.js`); `STD` is drawn as an error band.

## Important conventions

- **Define parameters centrally:** new metric = `ParameterSpec` in
  `backend/config.py` plus an entry in `CHARTS` in `frontend/app.js`. Aggregation
  and cache are generic and need no adjustment. Details in the README.
- **Circular quantities:** mark angle values (e.g. `wind_direction_10m`) with
  `circular=True`. `aggregation.py` then uses the vector mean
  (`sin`/`cos` → `atan2`) and circular standard deviation instead of the
  arithmetic mean. Never average angles arithmetically.
- **One request per model**, in parallel via `asyncio.gather`.
- **Missing values** are excluded, never treated as 0; if all are missing,
  `mean`/`std` are `null`.
- **Frontend console/DOM changes** without a build step: `frontend/app.js`
  is loaded directly.
- **Coloured zones in the chart:** via a `bands` field on the `CHARTS` entry
  (`{ from, to, label, color }`), `renderChart` renders filled areas, boundary
  lines and right-aligned labels; the y-axis scales dynamically to the data
  range. Example: the pressure bands in the air-pressure chart.
- **Max-sunshine ceiling:** the sunshine chart (`sunCeiling: true` in `CHARTS`)
  draws `state.data.sun[state.mode]` as a thin grey solid line (width 1.2,
  `SUN_CEILING_COLOR`) behind the mean line; `computeYRange` includes its max so
  it is never clipped. The cloud-cover overlay is grey-blue (`#64748b`) and
  dashed. Data comes from `sun.py` (separate Open-Meteo call, see README).
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
  over the visible range plus the stored `points` = daily highlights) and posts
  them with place and `I18n.getLang()` to `/api/smalltalk`. The backend
  (`smalltalk.py`) calls DeepSeek with `DEEPSEEK_API_KEY` and returns a short,
  funny opener that is shown in the `#smalltalk-modal`; "Again" regenerates. The
  API key stays server-side. Missing key → `503`, upstream failure → `502`.
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
  as `tickvals` and `ticktext` from `weekdayName()` so that no day is omitted.
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
  remains. Model count and names are in the info tooltip behind the chart title
  (`chartInfoText`, keys `chart.infoModels`/`models.coverage`), the count
  additionally in the hover tooltip of the values (stays there). The "Models used
  per parameter" list is a collapsed-by-default `<details>` panel; the model list
  in it links via `MODEL_DOCS` to the Open-Meteo docs page of the respective
  provider (link title `models.docsLinkTitle`, note `models.docsNote`).
- **Daily highlights in the chart:** via an `annotations` field on the `CHARTS`
  entry (`{ type: "max" | "sum" }`). `dailyHighlights` always aggregates the
  **hourly series** from `state.data.hourly` per calendar day (daily maximum or
  daily total) so that the values are also correct in the daily view
  (`temperature_2m`/`pressure_msl` are only available daily as `_mean`). `max`
  renders as a grey box with a coloured connector line without an arrowhead at
  the peak (`arrowhead: 0`), `sum` as a box without a line centred in the day;
  `pinToTop: true` (sunshine hours) places it via `yref: "paper"` at the top edge
  of the chart and scales the y-axis with increased headroom
  (`computeYRange`, top factor 0.3) so that the value does not collide with the
  hourly curve. From the partial first day, only the visible remainder from `now`
  counts in hourly mode – and only if more than 3 h are left; in daily mode the
  full day counts. Highlights that round to `0.0` are omitted. `computeYRange`
  makes room for the labels. The daily x-axis extends to `nextDayString` of the
  last day so that the labels of the last day are not cut off.
- **Dynamic connector lines:** `dynamicArrow: true` on the `annotations` entry
  lets `resolveArrow`/`arrowOffset` tilt the headless line depending on x (point
  outside → label towards the centre, max. 45°, `standoff` keeps distance to the
  point). Active for the max charts, not for `sum`. `chartXContext` provides the
  visible x span; `rebuildAnnotations` is rebuilt on zoom/pan/reset via the
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
