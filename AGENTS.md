# AGENTS.md

Kurzer Einstieg für Agenten. Die vollständige Doku (Setup, API, Konfiguration,
Einschränkungen) steht in **[README.md](./README.md)** – bei Fragen zuerst dort
nachsehen.

## Was ist das

**MetaMeteo** – lokale Web-App (FastAPI-Backend + statisches Browser-Frontend),
die für einen Ort eine 7-Tage-Vorhersage aus mehreren Open-Meteo-Wettermodellen
abfragt, pro Parameter Mittelwert + Streuung aggregiert und mit Plotly als Charts
darstellt. Kein API-Key, kein Scheduler, kein LLM zur Laufzeit.

## Struktur

```
backend/
  main.py          # FastAPI-App: /api/geocode, /api/forecast, /api/favorites, Cache, StaticFiles
  config.py        # PARAMETER_SPECS, Modelllisten, TTL, DISPLAY_NAMES
  models.py        # Pydantic-Response-Modelle + NormalizedForecast
  aggregation.py   # Mittelwert/Std, zirkuläre Aggregation, Tagesfallback
  cache.py         # In-Memory-TTL-Cache
  favorites.py     # JSON-Persistenz (data/favorites.json)
  sources/
    open_meteo.py  # Open-Meteo Client, ein Request pro Modell
    geocoding.py   # Open-Meteo Geocoding
    base.py        # ForecastSource(ABC)
  tests/           # pytest, laufen über backend/tests
frontend/
  index.html       # Layout + CSS, lädt Plotly per CDN; Sprach-Select, data-i18n-Attribute
  i18n.js          # Übersetzungen (de/en/fr/es/it), detectLang, t(), Locale, Kardinalrichtungen
  app.js           # Chart-Konfiguration (CHARTS), Rendering, Favoriten, Zoom-Sync
```

## Datenfluss

`sources/open_meteo.py` normalisiert jede Modell-Antwort in `NormalizedForecast`
(`models.py`). `aggregation.aggregate()` baut daraus je Auflösung (hourly/daily)
einen `ResolutionBlock` mit `ParameterSeries` pro Parameter. `main.py` cached und
liefert `ForecastResponse`. Das Frontend rendert pro Eintrag in `CHARTS`
(`frontend/app.js`) eine Chart-Karte; `STD` wird als Fehlerband gezeichnet.

## Wichtige Konventionen

- **Parameter zentral definieren:** Neue Metrik = `ParameterSpec` in
  `backend/config.py` plus Eintrag in `CHARTS` in `frontend/app.js`. Aggregation
  und Cache sind generisch und brauchen keine Anpassung. Details in der README.
- **Zirkuläre Größen:** Winkelwerte (z. B. `wind_direction_10m`) mit
  `circular=True` markieren. Dann nutzt `aggregation.py` Vektor-Mittel
  (`sin`/`cos` → `atan2`) und Kreissstandardabweichung statt arithmetischem
  Mittel. Niemals Winkel arithmetisch mitteln.
- **Ein Request pro Modell**, parallel via `asyncio.gather`.
- **Fehlende Werte** werden ausgeschlossen, nie als 0 gewertet; fehlt alles,
  sind `mean`/`std` `null`.
- **Frontend-Konsolen-/DOM-Änderungen** ohne Build-Schritt: `frontend/app.js`
  wird direkt geladen.
- **Farbige Zonen im Chart:** Über ein `bands`-Feld am `CHARTS`-Eintrag
  (`{ from, to, label, color }`) rendert `renderChart` gefüllte Bereiche,
  Grenzlinien und rechtsbündige Labels; die y-Achse skaliert dazu dynamisch am
  Datenbereich. Beispiel: die Druckbänder im Luftdruck-Chart.
- **Datenstart ab jetzt:** `ForecastResponse.now` (Ortszeit, `YYYY-MM-DDTHH:mm`)
  wird pro Request frisch gesetzt. Das Frontend setzt `xaxis.minallowed` auf
  diesen Wert (stündlich) bzw. auf 00:00 heute (täglich), damit vergangene Daten
  auch per Zoom/Pan unsichtbar bleiben.
- **Aktualisieren:** Der Refresh-Button ruft `selectLocation(state.selected,
  { refresh: true })` auf; `refresh=1` an `/api/forecast` überspringt den
  TTL-Cache-Lookup, holt frische Modelldaten und überschreibt danach den
  Cache-Eintrag. Zusätzlich Cache-Buster `_=Date.now()`. `/api/*` wird per
  Middleware mit `Cache-Control: no-store` ausgeliefert.
- **`generated_at`:** UTC-Zeitpunkt des letzten frischen Modell-Abrufs, wird bei
  Cache-Treffern nicht aktualisiert (kein Modelllauf-Zeitstempel). Das Frontend
  zeigt ihn als „Daten abgerufen: …“ mit erklärendem Tooltip
  (`location.updated`/`location.updatedTitle`).
- **Internationalisierung:** Keine UI-Strings direkt im Code – neue Texte als Key
  in allen fünf Sprachen in `frontend/i18n.js` (`TRANSLATIONS`), Abruf über `t()`
  (Interpolation mit `{{var}}`). `CHARTS` nutzt `labelKey`/`infoKey` (Overlays,
  `direction`, `bands` analog), Auflösung erst beim Rendern. Sprache: Default aus
  `navigator.languages`, Persistenz in `localStorage["metameteo.lang"]`; Wechsel
  übersetzt live ohne neuen Request (`changeLanguage` → `render()`). Sprache
  spezifisch außerdem `LOCALES`, `CARDINALS`, `WEEKDAYS`, `TICK_FORMATS`,
  `gemName()`.
- **X-Achse:** Im Stundenmodus baut `hourlyTicks(range)` eigene `tickvals`/
  `ticktext` (Wochentag aus `I18n.weekdays()` um Mitternacht, sonst `HH:00`);
  Schrittweite aus `[1,2,3,6,12,24]` so, dass ≤ 8 Ticks entstehen, Start per
  `wallClockMs`/`isoLocal`. Bei Zoom/Pan im `plotly_relayout`-Handler über
  `hourlyTickLayout()` neu setzen (zusammen mit den Annotationen in einem
  `Plotly.relayout`). Tagesmodus bleibt bei `tickformat: "%a"`.
- **Zahlenformat:** Immer über `formatNumber`/`formatValue` in `frontend/app.js`
  (Locale aus `I18n.locale()`, eine Nachkommastelle, Einheit). Plotly-Hover
  nutzt deshalb vorformatierte Werte in `customdata` statt `%{y:.2f}`, weil
  Plotly sonst einen Punkt als Dezimaltrenner setzt. Datums-Ticks über
  `I18n.tickFormat(mode)`, Hover-Datum über die Plotly-Locale (`locale` in der
  `Plotly.newPlot`-Config, Bundle von der Plotly-CDN via `loadPlotlyLocale`).
- **Tages-Kennwerte im Chart:** Über ein `annotations`-Feld am `CHARTS`-Eintrag
  (`{ type: "max" | "sum" }`). `dailyHighlights` aggregiert dafür stets die
  **Stundenreihe** aus `state.data.hourly` je Kalendertag (Tagesmaximum bzw.
  Tagessumme), damit die Werte auch in der Tagesansicht stimmen
  (`temperature_2m`/`pressure_msl` liegen täglich nur als `_mean` vor). `max`
  rendert als graue Box mit farbigem Pfeil am Peak, `sum` als Box ohne Pfeil
  mittig im Tag; `pinToTop: true` (Sonnenstunden) setzt sie per `yref: "paper"`
  an den oberen Chartrand und skaliert die y-Achse mit erhöhtem Kopfraum
  (`computeYRange`, top-Faktor 0,3), damit der Wert nicht mit der Stundenkurve
  kollidiert. Vom angebrochenen ersten Tag zählt im stündlichen Modus nur der
  sichtbare Rest ab `now` – und nur, wenn mehr als 3 h übrig sind; im täglichen
  Modus zählt der volle Tag. Kennwerte, die auf `0,0` gerundet werden, werden
  ausgelassen. `computeYRange` schafft Platz für die Labels. Die tägliche
  x-Achse reicht bis `nextDayString` des letzten Tags, damit die Labels des
  letzten Tags nicht abgeschnitten werden.
- **Dynamische Pfeile:** `dynamicArrow: true` am `annotations`-Eintrag lässt
  `resolveArrow`/`arrowOffset` den Pfeil x-abhängig neigen (Punkt außen → Label
  zur Mitte, max. 45°, `standoff` hält Abstand zum Punkt). Aktiv für die
  Max-Charts, nicht bei `sum`. `chartXContext` liefert die sichtbare x-Spanne;
  `rebuildAnnotations` wird bei Zoom/Pan/Reset über den `plotly_relayout`-Handler
  neu aufgebaut. `paintAnnotationsUnderBoxes` dreht per `plotly_afterplot` die
  SVG-Reihenfolge, damit die Box über dem Pfeilansatz liegt.

## Tests

```bash
source .venv/bin/activate
pytest
```

Testfokus ist die Aggregationslogik (Mittelwert/Std, fehlende Werte,
Ein-Modell-Fall, Tagesfallback, zirkuläre Windrichtung).

## Starten

```bash
source .venv/bin/activate
uvicorn backend.main:app --reload
# http://localhost:8000
```

Alternativ `./start.command` (legt venv an, startet Server, öffnet Browser).
