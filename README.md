# Meta-Wetter

Lokale Web-App (Backend + Browser-Frontend), die für einen Ort eine 7-Tage-Vorhersage
aus mehreren unabhängigen Wettermodellen abfragt, pro Größe (Temperatur, Wind,
UV-Index, Niederschlagswahrscheinlichkeit, Niederschlagsmenge, Sonnenstunden,
gefühlte Temperatur, Bewölkung, Luftdruck) Mittelwert und Streuung
(Standardabweichung) zwischen den Modellen berechnet und als Chart mit Fehlerband
darstellt.

## Features (v1)

- Ortssuche mit Autocomplete über die Open-Meteo Geocoding API.
- Abfrage mehrerer Modelle über die Open-Meteo Forecast API – ein Request pro Modell,
  parallel per `asyncio.gather`.
- Aggregation: Mittelwert + Populations-Standardabweichung über alle Modelle, die
  für den jeweiligen Zeitschritt einen Wert liefern. Fehlende Werte werden
  ausgeschlossen (nicht als 0 gewertet).
- Fehlerband als `mean ± 1σ` in einem Plotly-Chart je Parameter.
- Gestrichelte Overlays: gefühlte Temperatur im Temperatur-Chart, Bewölkung
  (rechte Achse, %) im Sonnenstunden-Chart.
- Umschalter „stündlich / täglich“; stündlich startet die Ansicht mit den ersten
  3 Tagen (per Zoom alle 7 Tage).
- Zoom-Sync: Button „Zoom auf alle“ in jedem Chart überträgt den sichtbaren
  Zeitbereich auf alle anderen Charts; „Zoom zurücksetzen“ stellt die
  Standardansicht wieder her.
- Transparenz: pro Parameter wird angezeigt, welche Modelle tatsächlich eingeflossen
  sind und welche fehlen; Badges für „nur 1 Modell“, „nur täglich aufgelöst“ und
  schwankende Modellanzahl.
- Kurzlebiger In-Memory-Cache (TTL 10 Minuten), Key = Koordinaten + Modellauswahl.
- Kein Scheduler, kein Scraping, kein API-Key, kein LLM zur Laufzeit.

## Setup

Voraussetzung: **Python 3.11+** (getestet mit 3.12). Das Standard-`python3` auf macOS
kann älter sein – daher im Folgenden explizit `python3.12` verwenden.

```bash
cd meta-meteo
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Starten

```bash
source .venv/bin/activate
uvicorn backend.main:app --reload
```

Danach im Browser öffnen:

```text
http://localhost:8000
```

Das Frontend wird vom Backend als statische Datei ausgeliefert, daher ist kein
separater Webserver und keine CORS-Konfiguration nötig.

Alternativ das Start-Skript verwenden (legt bei Bedarf die venv an, startet den
Server und öffnet den Browser):

```bash
./start.command
# oder per Doppelklick im Finder
```

Der Port lässt sich über die Umgebungsvariable `META_METEO_PORT` ändern (Default 8000).

## Tests

```bash
source .venv/bin/activate
pytest
```

Die Tests decken die Aggregationslogik ab: Mittelwert/Populations-Std,
Ausschluss fehlender Werte, Ein-Modell-Fall (Std = 0), komplett fehlende Reihen
und den Rückfall auf Tageswerte.

## API

### `GET /api/geocode`

| Parameter | Beschreibung |
| --- | --- |
| `query` | Suchbegriff (Pflicht) |
| `count` | Max. Treffer, 1–20 (Default 8) |

Liefert eine Liste möglicher Orte (`name`, `country`, `admin1`, `latitude`,
`longitude`, `timezone`) zur Disambiguierung.

### `GET /api/forecast`

| Parameter | Beschreibung |
| --- | --- |
| `lat`, `lon` | Koordinaten (Pflicht) |
| `days` | Vorhersagetage, 1–16 (Default 7) |
| `models` | Komma-separierte Modellliste (Default aus Config) |
| `name`, `country`, `admin1`, `tz` | Optionale Metadaten für die Anzeige |

Antwort (gekürzt):

```json
{
  "location": {"name": "Berlin", "country": "Deutschland", "lat": 52.52, "lon": 13.41, "timezone": "Europe/Berlin"},
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
  "generated_at": "2026-09-16T17:27:21+00:00"
}
```

`std` ist die Populations-Standardabweichung (`ddof=0`) über alle Modelle mit Wert.
Bei genau einem Modell ist `std = 0`; bei keinem Modell sind `mean`/`std` `null`.
`hourly` und `daily` sind immer beide enthalten, der Umschalter im Frontend arbeitet
ohne neuen Request.

## Konfiguration

`backend/config.py` steuert:

- `DEFAULT_MODELS` – Standardauswahl für Mitteleuropa:
  `icon_seamless`, `gfs_seamless`, `ecmwf_ifs025`, `gem_seamless`,
  `ukmo_seamless`, `meteofrance_seamless`.
- `ALLOWED_MODELS` – zusätzlich `jma_seamless` (v. a. für Asien-Pazifik sinnvoll).
- `PARAMETER_SPECS` – je Parameter stündliche/tägliche API-Variable, optionale
  Anzeige-Einheit und Skalierungsfaktor. Daraus werden `CANONICAL_PARAMS`,
  `HOURLY_VARIABLES`, `DAILY_VARIABLES`, `VALUE_SCALES` und `UNIT_OVERRIDES`
  abgeleitet. Neue Metriken werden hier ergänzt (plus Eintrag im Frontend).
  Beispiel Sonnenstunden: `sunshine_duration`, `scale=1/3600`, `unit="h"`.
- `CACHE_TTL_SECONDS`, `FORECAST_MAX_DAYS`, `DISPLAY_NAMES`.

Modellauswahl ist damit an einer Stelle änderbar und wird über den Query-Parameter
`models` pro Request überschrieben.

Eine Metrik hinzufügen: `ParameterSpec` in `backend/config.py` ergänzen und einen
Eintrag in der `CHARTS`-Liste in `frontend/app.js` (mit Label, Farbe, Tooltip)
anlegen. Aggregation und Caching sind generisch und brauchen keine Anpassung.

## Bekannte Einschränkung: UV-Index

Bei den Standardmodellen liefert **nur `gfs_seamless`** einen UV-Index (stündlich
und täglich); die übrigen liefern `null`-Arrays (kein Fehler). Ein UV-Fehlerband
über mehrere Modelle ist daher derzeit nicht möglich – das Frontend kennzeichnet
den UV-Chart mit dem Badge „nur 1 Modell“. Die Aggregationslogik bleibt generisch:
sobald weitere Modelle UV liefern, fließen sie automatisch ein.

## Weitere Modell-Einschränkungen

`precipitation_probability` fehlt bei `ukmo_seamless`, `meteofrance_seamless` und
`jma_seamless`; die Aggregation nutzt dann nur die verfügbaren Modelle und weist
sie unter „Genutzte Modelle je Parameter“ aus.

`sunshine_duration` liefert `ukmo_seamless` nur für ~2,6 Tage und
`meteofrance_seamless` für ~5 Tage; die Modellanzahl sinkt entsprechend gegen Ende
des Zeitraums und wird im Frontend als „Modellanzahl X–Y“ ausgewiesen.

## Projektstruktur

```
meta-meteo/
  backend/
    main.py              # FastAPI-App, Endpoints, Cache, StaticFiles
    config.py            # Modellauswahl, Parametername-Mapping, TTL
    models.py            # Pydantic-Modelle + NormalizedForecast
    aggregation.py       # Mittelwert/Std, Tagesfallback
    cache.py             # TTL-Cache
    sources/
      base.py            # ForecastSource(ABC)
      open_meteo.py      # Open-Meteo Forecast Client (ein Request pro Modell)
      geocoding.py       # Open-Meteo Geocoding Client
    tests/
      test_aggregation.py
      test_parameters.py
  frontend/
    index.html
    app.js
  requirements.txt
  pytest.ini
  README.md
```

## Erweiterbarkeit

- Jede Datenquelle implementiert `ForecastSource.fetch(lat, lon, days) ->
  NormalizedForecast`. Die Aggregation arbeitet ausschließlich auf diesem
  normalisierten Format – weitere Quellen (z. B. Scraping) lassen sich als
  zusätzliche `Source`-Klassen in die `asyncio.gather`-Liste in `main.py`
  aufnehmen, ohne die Aggregationslogik zu ändern.
- Modellauswahl liegt in `backend/config.py`, nicht hart im Code.
- Bewusst **nicht** in v1: Scraping-Quellen, Multi-Orte-Vergleich, automatisches
  Neuladen/Scheduler, Server-Deployment (Docker), optionale LLM-Zusammenfassung.

## Manuell getestete Orte

Berlin (Mitteleuropa), Bremerhaven (Küste) und Innsbruck (Berg) mit den
Default-Modellen sowie Tokyo (mit `models=jma_seamless,gfs_seamless,ecmwf_ifs025`).
Alle Parameter liefern plausible Werte; Modellabdeckung und Badges werden im
Frontend korrekt angezeigt.
