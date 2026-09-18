# MetaMeteo

Lokale Web-App (Backend + Browser-Frontend), die für einen Ort eine 7-Tage-Vorhersage
aus mehreren unabhängigen Wettermodellen abfragt, pro Größe (Temperatur, Wind,
Windrichtung, UV-Index, Niederschlagswahrscheinlichkeit, Niederschlagsmenge,
Sonnenstunden, gefühlte Temperatur, Bewölkung, Luftdruck) Mittelwert und Streuung
(Standardabweichung) zwischen den Modellen berechnet und als Chart mit Fehlerband
darstellt. Windrichtung ist eine zirkuläre Größe und wird als Vektor-Mittel
(Vektorsumme) statt arithmetisch gemittelt.

## Features (v1)

- Ortssuche mit Autocomplete über die Open-Meteo Geocoding API.
- Abfrage mehrerer Modelle über die Open-Meteo Forecast API – ein Request pro Modell,
  parallel per `asyncio.gather`.
- Aggregation: Mittelwert + Populations-Standardabweichung über alle Modelle, die
  für den jeweiligen Zeitschritt einen Wert liefern. Fehlende Werte werden
  ausgeschlossen (nicht als 0 gewertet).
- Zirkuläre Aggregation: Richtungswerte (z. B. 350° und 10°) werden über
  Einheitsvektoren (`sin`/`cos` → `atan2`) gemittelt; die Streuung ist die
  Kreissstandardabweichung `sqrt(-2·ln R)`.
- Fehlerband als `mean ± 1σ` in einem Plotly-Chart je Parameter.
- Windrichtung als gedrehte Pfeile im Wind-Chart (Strömungsrichtung, d. h. Pfeil
  zeigt, wohin der Wind weht). Pfeile mit großer Modell-Uneinigkeit werden
  transparenter; Hover zeigt Himmelsrichtung, Grad, Streuung und Modellanzahl.
- Gestrichelte Overlays: gefühlte Temperatur im Temperatur-Chart, Bewölkung
  (rechte Achse, %) im Sonnenstunden-Chart.
- Farbige Druckbänder im Luftdruck-Chart: `<1000` Tiefdruck, `1000–1013` leicht
  unterdurchschnittlich, `1013–1025` Normalbereich, `>1025` Hochdruck – jeweils
  mit rechtsbündigem Label. Da `pressure_msl` auf Meeresniveau reduziert ist,
  gelten die Grenzen unabhängig von der Höhenlage des Ortes. Die y-Achse skaliert
  dynamisch am Datenbereich, sodass nur die relevanten Bänder sichtbar sind.
- Umschalter „stündlich / täglich“; stündlich startet die Ansicht mit den ersten
  3 Tagen (per Zoom alle 7 Tage).
- Tages-Kennwerte direkt im Chart: Temperatur, Wind, UV-Index,
  Niederschlagswahrscheinlichkeit und Luftdruck zeigen je Tag den
  Tageshöchstwert, die Niederschlagsmenge und die Sonnenstunden die Tagessumme.
  Die Werte werden immer
  aus der Stundenreihe (`max` bzw. `sum` je Kalendertag) berechnet, damit sie
  auch in der Tagesansicht korrekt sind. Max-Charts nutzen eine graue Box
  (`#222e40`) mit farbigem Rand, farbigem Wert und dynamischem Pfeil – je weiter
  der Tagespeak außen liegt, desto flacher zeigt der Pfeil zur gegenüberliegenden
  Seite (max. 45°, `standoff` hält Abstand zum Punkt); die Box wird über den
  Pfeilansatz gemalt und bei Zoom/Pan/Reset neu berechnet. Die Summen-Box der
  Niederschlagsmenge sitzt ohne Pfeil mittig im Tag; die der Sonnenstunden
  schwebt zusätzlich am oberen Chartrand (`pinToTop`) mit etwas Kopfraum, damit
  die y-Achse an der Stundenreihe skaliert, der Wert aber nicht mit der Kurve
  kollidiert.
  Vom angebrochenen (ersten)
  Tag erscheinen im stündlichen Modus nur die verbleibenden Stunden und nur dann,
  wenn noch mehr als drei Stunden übrig sind; Wert und Position beziehen sich
  dann auf den sichtbaren Rest. Im täglichen Modus wird der volle Tag verwendet.
  Kennwerte, die auf `0,0` gerundet werden, werden ausgelassen; die Konfiguration
  läuft über das `annotations`-Feld im jeweiligen `CHARTS`-Eintrag.
- Einheitliche Zahlennotation: alle Werte in Hover-Tooltips und Chart-Annotationen
  werden mit einer Nachkommastelle und mit Einheit ausgegeben (z. B. `23,4 °C`,
  `3,2 mm`). Die Formatierung läuft zentral über `formatNumber`/`formatValue` mit
  der sprachabhängigen Locale in `frontend/app.js`.
- Mehrsprachige Oberfläche: Deutsch, Englisch, Französisch, Spanisch und
  Italienisch, oben im Header umschaltbar. Der Default kommt aus der
  Browsersprache, die Auswahl wird in `localStorage` (`metameteo.lang`)
  gespeichert. Beim Umschalten werden alle Texte sowie Zahlen- und Datumsformate
  live übersetzt – ohne Reload und ohne neuen Forecast-Request (die Daten selbst
  sind sprachunabhängig). Einheiten bleiben in jeder Sprache gleich (kein
  Fahrenheit o. Ä.). Die Übersetzungen und Formatdefinitionen liegen zentral in
  `frontend/i18n.js`.
- Datenstart ab „jetzt“: Der stündliche Graph beginnt an der aktuellen Minute
  (Ortszeit des Ortes). Eine harte Achsengrenze (`xaxis.minallowed`) verhindert,
  dass vergangene Stunden – auch per Zoom oder Pan – sichtbar werden. Der
  Tages-Chart startet mit dem heutigen Tag um 00:00.
- Zoom-Sync: Button „Zoom auf alle“ in jedem Chart überträgt den sichtbaren
  Zeitbereich auf alle anderen Charts; „Zoom zurücksetzen“ stellt die
  Standardansicht wieder her.
- Aktualisieren: Der Button lädt die Vorhersage für den aktuellen Ort neu und
  umgeht dabei den Server-Cache (`refresh=1`), sodass frische Modelldaten
  abgefragt werden, ohne den Ort wechseln zu müssen. Der angezeigte Wert „Daten
  abgerufen: …“ ist der Server-Zeitpunkt dieses frischen Abrufs (nicht der
  Modelllauf); bei Cache-Treffern bleibt er stehen, ein Tooltip erklärt das.
- Favoriten: Ort per Stern hinzufügen/entfernen; Chips rechts neben der Suche,
  klickbar, per Drag & Drop sortierbar, serverseitig in `data/favorites.json`
  persistiert.
- Transparenz: pro Parameter wird angezeigt, welche Modelle tatsächlich eingeflossen
  sind und welche fehlen; Badges für „nur 1 Modell“, „nur täglich aufgelöst“ und
  schwankende Modellanzahl.
- Kurzlebiger In-Memory-Cache (TTL 10 Minuten), Key = Koordinaten + Modellauswahl.
- Kein Scheduler, kein Scraping, kein API-Key, kein LLM zur Laufzeit.

## Sprachen und Zahlenformate

Die Oberfläche läuft in fünf Sprachen; die Auswahl steht oben rechts und wird in
`localStorage` gespeichert. Beim ersten Besuch entscheidet die Browsersprache
(`navigator.languages`), sonst Englisch.

| Sprache | Locale | Dezimaltrenner | Beispiel (1013,2 hPa) |
| --- | --- | --- | --- |
| Deutsch | `de-DE` | Komma | `1.013,2` |
| Englisch | `en-GB` | Punkt | `1,013.2` |
| Französisch | `fr-FR` | Komma | `1 013,2` |
| Spanisch | `es-ES` | Komma | `1013,2` |
| Italienisch | `it-IT` | Komma | `1013,2` |

Nur Englisch verwendet den Punkt als Dezimaltrenner. Die Zahlen kommen aus
`Intl.NumberFormat`, die Datumsformate (Chart-Achse, Hover, „Aktualisiert“) aus
der jeweiligen Locale; für die Plotly-Hover werden zusätzlich die
Locale-Bundles von der Plotly-CDN geladen. Bei vierstelligen Werten gruppieren
Spanisch und Italienisch standardkonform nicht (`1013,2` statt `1.013,2`); das
ist CLDR-Verhalten und bewusst so belassen.

Die X-Achse beschriftet die Charts sprachrichtig: Im Stundenmodus steht an
Tagesgrenzen (Mitternacht) das lokalisierte Wochentagskürzel (z. B. `Mo`, `Thu`,
`Jeu`, `Jue`, `Gio`), dazwischen die Uhrzeit; im Tagesmodus nur der Wochentag.
Die Tick-Positionen werden passend zur sichtbaren Spanne gewählt und bei
Zoom/Pan neu berechnet.

Eine neue Sprache ergänzen: Eintrag in `TRANSLATIONS`, `LOCALES`, `CARDINALS`,
`TICK_FORMATS` und `LANGUAGES` in `frontend/i18n.js` (alle Schlüssel müssen
vorhanden sein) sowie die Sprache in `GEOCODE_LANGUAGES` in `backend/config.py`
für lokalisierte Ortsnamen. Das Frontend baut die Auswahl automatisch daraus auf.

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
Ausschluss fehlender Werte, Ein-Modell-Fall (Std = 0), komplett fehlende Reihen,
den Rückfall auf Tageswerte, die zirkuläre Aggregation von Windrichtung
(Vektor-Mittel über den Nordpunkt, Kreisspreizung, Tagesfallback) sowie die
Ortszeit-Berechnung (`now`) inkl. UTC-Fallback.

## API

### `GET /api/geocode`

| Parameter | Beschreibung |
| --- | --- |
| `query` | Suchbegriff (Pflicht) |
| `count` | Max. Treffer, 1–20 (Default 8) |
| `lang` | Sprache der Ortsnamen: `de`, `en`, `fr`, `es`, `it` (Default `de`) |

Liefert eine Liste möglicher Orte (`name`, `country`, `admin1`, `latitude`,
`longitude`, `timezone`) zur Disambiguierung.

### `GET /api/forecast`

| Parameter | Beschreibung |
| --- | --- |
| `lat`, `lon` | Koordinaten (Pflicht) |
| `days` | Vorhersagetage, 1–16 (Default 7) |
| `models` | Komma-separierte Modellliste (Default aus Config) |
| `name`, `country`, `admin1`, `tz` | Optionale Metadaten für die Anzeige |
| `refresh` | `true`, um den Cache zu umgehen und frische Modelldaten zu laden |

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
  "generated_at": "2026-09-16T17:27:21+00:00",
  "now": "2026-09-16T19:34"
}
```

`now` ist die aktuelle Ortszeit des Ortes im Format `YYYY-MM-DDTHH:mm` (ohne
Zeitzonen-Offset, identisch zu den Timestamps) und wird bei jedem Request frisch
gesetzt – auch bei Cache-Treffern. Das Frontend nutzt sie als Startgrenze der
x-Achse.

`generated_at` ist der UTC-Zeitpunkt, an dem die Prognose zuletzt frisch von
Open-Meteo geholt und aggregiert wurde. Bei einem Cache-Treffer wird der
bestehende Wert unverändert zurückgegeben; `refresh=true` erzeugt einen neuen
Wert. Es ist ausdrücklich **kein** Modelllauf-Zeitstempel (Open-Meteo liefert
diesen in den genutzten Feldern nicht). API-Antworten erhalten
`Cache-Control: no-store`, damit der Browser nicht selbst cached; zusätzlich
hängt das Frontend beim Refresh einen Cache-Buster an.

`std` ist die Populations-Standardabweichung (`ddof=0`) über alle Modelle mit Wert.
Bei genau einem Modell ist `std = 0`; bei keinem Modell sind `mean`/`std` `null`.
`hourly` und `daily` sind immer beide enthalten, der Umschalter im Frontend arbeitet
ohne neuen Request.

### Favoriten-Endpoints

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/api/favorites` | Liste in gespeicherter Reihenfolge |
| `POST` | `/api/favorites` | Favorit hinzufügen (Duplikate werden ignoriert) |
| `DELETE` | `/api/favorites/{id}` | Favorit entfernen (`id` = `lat,lon` auf 4 Stellen) |
| `PUT` | `/api/favorites/order` | Reihenfolge setzen (`{"ids": [...]}`) |

Alle Endpoints liefern `{"favorites": [...]}`. Gespeichert wird in
`data/favorites.json` (wird beim ersten Schreiben angelegt, ist gitignored).

## Konfiguration

`backend/config.py` steuert:

- `DEFAULT_MODELS` – Standardauswahl für Mitteleuropa:
  `icon_seamless`, `gfs_seamless`, `ecmwf_ifs025`, `gem_seamless`,
  `ukmo_seamless`, `meteofrance_seamless`.
- `ALLOWED_MODELS` – zusätzlich `jma_seamless` (v. a. für Asien-Pazifik sinnvoll).
- `PARAMETER_SPECS` – je Parameter stündliche/tägliche API-Variable, optionale
  Anzeige-Einheit, Skalierungsfaktor und `circular`-Flag. Daraus werden
  `CANONICAL_PARAMS`, `HOURLY_VARIABLES`, `DAILY_VARIABLES`, `VALUE_SCALES`,
  `UNIT_OVERRIDES` und `CIRCULAR_PARAMS` abgeleitet. Neue Metriken werden hier
  ergänzt (plus Eintrag im Frontend).
  Beispiel Sonnenstunden: `sunshine_duration`, `scale=1/3600`, `unit="h"`.
  Beispiel Windrichtung: `wind_direction_10m`, `unit="°"`, `circular=True`,
  täglich `wind_direction_10m_dominant`.
- `CACHE_TTL_SECONDS`, `FORECAST_MAX_DAYS`, `DISPLAY_NAMES`.

Modellauswahl ist damit an einer Stelle änderbar und wird über den Query-Parameter
`models` pro Request überschrieben.

Eine Metrik hinzufügen: `ParameterSpec` in `backend/config.py` ergänzen und einen
Eintrag in der `CHARTS`-Liste in `frontend/app.js` (mit Label, Farbe, Tooltip)
anlegen. Aggregation und Caching sind generisch und brauchen keine Anpassung.
Für Winkelgrößen `circular=True` setzen, damit der Vektor-Mittelwert statt des
arithmetischen Mittels verwendet wird. Soll die Größe als Pfeile in einem
bestehenden Chart erscheinen, im Frontend-Eintrag `direction: { key, label }`
ergänzen statt ein eigenes Chart anzulegen. Für einen Tages-Kennwert im Chart
`annotations: { type: "max" | "sum" }` setzen. `max` zeigt den Tageshöchstwert am
Ort des Peaks mit Pfeil (optional `dynamicArrow: true` für x-abhängige Neigung,
max. 45°, Neuberechnung bei Zoom/Pan/Reset); `sum` die Tagessumme ohne Pfeil,
mittig im Tag.

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
    config.py            # Modellauswahl, Parametername-Mapping, TTL, Datenpfade
    models.py            # Pydantic-Modelle + NormalizedForecast
    aggregation.py       # Mittelwert/Std, Tagesfallback
    cache.py             # TTL-Cache
    favorites.py         # FavoritesStore (JSON-Persistenz)
    sources/
      base.py            # ForecastSource(ABC)
      open_meteo.py      # Open-Meteo Forecast Client (ein Request pro Modell)
      geocoding.py       # Open-Meteo Geocoding Client
    tests/
      test_aggregation.py
      test_parameters.py
      test_favorites.py
      test_local_now.py
  frontend/
    index.html
    i18n.js              # Übersetzungen, Spracherkennung, Locale/Kardinalrichtungen
    app.js
  requirements.txt
  pytest.ini
  AGENTS.md            # Kurz-Überblick für Agenten (verweist auf diese README)
  README.md            # Ausführliche Doku (Setup, API, Konfiguration)
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
