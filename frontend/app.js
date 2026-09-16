const CHARTS = [
  {
    key: "temperature_2m",
    label: "Temperatur (2 m)",
    color: "#f97316",
    zero: false,
    info: "Lufttemperatur in 2 m Höhe über Grund – die meteorologische Standard-Messhöhe.",
    overlays: [
      { key: "apparent_temperature", label: "Gefühlte Temperatur", color: "#fca5a5" },
    ],
  },
  {
    key: "sunshine_duration",
    label: "Sonnenstunden",
    color: "#fbbf24",
    zero: true,
    info: "Sonnenscheindauer: stündlich = Sonnenstunden dieser Stunde, täglich = Tagessumme. Die gestrichelte Linie zeigt die Bewölkung.",
    overlays: [
      { key: "cloud_cover", label: "Bewölkung", color: "#94a3b8", secondary: true },
    ],
  },
  {
    key: "wind_speed_10m",
    label: "Wind (10 m)",
    color: "#38bdf8",
    zero: true,
    info: "Windgeschwindigkeit in 10 m Höhe über Grund – die meteorologische Standard-Messhöhe. Wind in 2 m Höhe ist bei Open-Meteo nicht verfügbar. Die Pfeile zeigen die mittlere Strömungsrichtung; blasser = Modelle uneiniger.",
    direction: { key: "wind_direction_10m", label: "Windrichtung" },
  },
  {
    key: "precipitation_probability",
    label: "Niederschlagswahrscheinlichkeit",
    color: "#818cf8",
    zero: true,
    info: "Wahrscheinlichkeit für Niederschlag (0–100 %). Nicht jedes Modell liefert diesen Wert.",
  },
  {
    key: "precipitation",
    label: "Niederschlagsmenge",
    color: "#4ade80",
    zero: true,
    info: "Erwartete Niederschlagsmenge in mm.",
  },
  {
    key: "uv_index",
    label: "UV-Index",
    color: "#facc15",
    zero: true,
    info: "UV-Index (0 = niedrig, ab 3 erhöhter Schutzbedarf, ab 8 sehr hoch).",
  },
  {
    key: "pressure_msl",
    label: "Luftdruck",
    color: "#c084fc",
    zero: false,
    info: "Luftdruck auf Meeresniveau in hPa.",
  },
];

const PANEL_PARAMS = [];
CHARTS.forEach((chart) => {
  PANEL_PARAMS.push({ key: chart.key, label: chart.label });
  (chart.overlays || []).forEach((overlay) => {
    PANEL_PARAMS.push({
      key: overlay.key,
      label: overlay.label,
      note: `gestrichelt im Chart „${chart.label}“`,
    });
  });
  if (chart.direction) {
    PANEL_PARAMS.push({
      key: chart.direction.key,
      label: chart.direction.label,
      note: `als Pfeile im Chart „${chart.label}“`,
    });
  }
});

const HOURLY_WINDOW_DAYS = 3;

const CARDINALS = [
  "N",
  "NNO",
  "NO",
  "ONO",
  "O",
  "OSO",
  "SO",
  "SSO",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

const DISPLAY_NAMES = {
  icon_seamless: "DWD ICON",
  gfs_seamless: "NOAA GFS",
  ecmwf_ifs025: "ECMWF IFS",
  gem_seamless: "Kanada GEM",
  ukmo_seamless: "UK Met Office",
  meteofrance_seamless: "Météo-France",
  jma_seamless: "Japan JMA",
};

const state = {
  mode: "hourly",
  data: null,
  selected: null,
  plots: {},
  favorites: [],
};

let dragIndex = null;
let suppressClick = false;

const searchInput = document.getElementById("search");
const suggestions = document.getElementById("suggestions");
const statusEl = document.getElementById("status");
const windowHint = document.getElementById("window-hint");
const locationMeta = document.getElementById("location-meta");
const chartsEl = document.getElementById("charts");
const modelsPanel = document.getElementById("models-panel");
const modelsSummary = document.getElementById("models-summary");
const modelsList = document.getElementById("models-list");
const resetZoomBtn = document.getElementById("reset-zoom");
const favoritesEl = document.getElementById("favorites");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function displayName(model) {
  return DISPLAY_NAMES[model] || model;
}

function startBound() {
  const now = state.data && state.data.now;
  if (!now) return null;
  return state.mode === "hourly" ? now : `${now.slice(0, 10)}T00:00`;
}

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

async function searchLocations(query) {
  if (query.trim().length < 2) {
    closeSuggestions();
    return;
  }
  try {
    const response = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    renderSuggestions(data.results || []);
  } catch (error) {
    setStatus(`Ortssuche fehlgeschlagen: ${error.message}`, true);
  }
}

function renderSuggestions(results) {
  suggestions.innerHTML = "";
  if (!results.length) {
    closeSuggestions();
    return;
  }
  results.forEach((result) => {
    const item = document.createElement("div");
    item.className = "suggestion";
    const title = document.createElement("div");
    title.textContent = result.name;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = [result.admin1, result.country].filter(Boolean).join(", ");
    item.append(title, meta);
    item.addEventListener("click", () => selectLocation(result));
    suggestions.appendChild(item);
  });
  suggestions.classList.add("open");
}

function closeSuggestions() {
  suggestions.classList.remove("open");
  suggestions.innerHTML = "";
}

function favoriteId(location) {
  return `${Number(location.latitude).toFixed(4)},${Number(location.longitude).toFixed(4)}`;
}

function isFavorite(location) {
  return !!location && state.favorites.some((fav) => fav.id === favoriteId(location));
}

async function loadFavorites() {
  try {
    const response = await fetch("/api/favorites");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.favorites = data.favorites || [];
  } catch (error) {
    state.favorites = [];
    setStatus(`Favoriten konnten nicht geladen werden: ${error.message}`, true);
  }
  renderFavorites();
}

function renderFavorites() {
  favoritesEl.innerHTML = "";
  if (!state.favorites.length) {
    const empty = document.createElement("span");
    empty.className = "favorites-empty";
    empty.textContent = "Noch keine Favoriten – Ort suchen und mit ☆ hinzufügen.";
    favoritesEl.appendChild(empty);
    return;
  }

  state.favorites.forEach((favorite, index) => {
    const chip = document.createElement("div");
    chip.className = "fav-chip";
    if (state.selected && favoriteId(state.selected) === favorite.id) {
      chip.classList.add("active");
    }
    chip.draggable = true;
    chip.title = [favorite.admin1, favorite.country].filter(Boolean).join(", ");

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = favorite.name;
    chip.appendChild(label);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.textContent = "×";
    remove.title = "Favorit entfernen";
    remove.addEventListener("click", (event) => removeFavorite(favorite.id, event));
    chip.appendChild(remove);

    chip.addEventListener("click", () => {
      if (suppressClick) return;
      selectLocation(favorite);
    });

    chip.addEventListener("dragstart", (event) => {
      dragIndex = index;
      suppressClick = true;
      chip.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", favorite.id);
    });
    chip.addEventListener("dragend", () => {
      chip.classList.remove("dragging");
      dragIndex = null;
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    });
    chip.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    chip.addEventListener("drop", (event) => {
      event.preventDefault();
      if (dragIndex === null || dragIndex === index) return;
      const moved = state.favorites.splice(dragIndex, 1)[0];
      state.favorites.splice(index, 0, moved);
      dragIndex = null;
      renderFavorites();
      persistOrder();
    });

    favoritesEl.appendChild(chip);
  });
}

async function toggleFavorite() {
  if (!state.selected) return;
  const id = favoriteId(state.selected);
  try {
    let response;
    if (isFavorite(state.selected)) {
      response = await fetch(`/api/favorites/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } else {
      const { name, country, admin1, latitude, longitude, timezone } = state.selected;
      response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, country, admin1, latitude, longitude, timezone }),
      });
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.favorites = data.favorites || [];
    renderFavorites();
    renderLocationMeta();
  } catch (error) {
    setStatus(`Favorit konnte nicht gespeichert werden: ${error.message}`, true);
  }
}

async function removeFavorite(id, event) {
  if (event) event.stopPropagation();
  try {
    const response = await fetch(`/api/favorites/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.favorites = data.favorites || [];
    renderFavorites();
    renderLocationMeta();
  } catch (error) {
    setStatus(`Favorit konnte nicht entfernt werden: ${error.message}`, true);
  }
}

async function persistOrder() {
  try {
    const response = await fetch("/api/favorites/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: state.favorites.map((favorite) => favorite.id) }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.favorites = data.favorites || [];
    renderFavorites();
  } catch (error) {
    setStatus(`Reihenfolge konnte nicht gespeichert werden: ${error.message}`, true);
  }
}

async function selectLocation(location) {
  state.selected = location;
  searchInput.value = location.name;
  closeSuggestions();
  setStatus("Lade Vorhersage …");
  try {
    const params = new URLSearchParams({
      lat: location.latitude,
      lon: location.longitude,
      days: 7,
    });
    if (location.name) params.set("name", location.name);
    if (location.country) params.set("country", location.country);
    if (location.admin1) params.set("admin1", location.admin1);
    if (location.timezone) params.set("tz", location.timezone);

    const response = await fetch(`/api/forecast?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok) {
      const detail = typeof payload.detail === "string" ? payload.detail : payload.detail?.message;
      throw new Error(detail || `HTTP ${response.status}`);
    }
    state.data = payload;
    render();
  } catch (error) {
    setStatus(`Vorhersage fehlgeschlagen: ${error.message}`, true);
  }
}

function bandColor(hex) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.18)`;
}

function buildTraces(x, series, color) {
  const lower = series.mean.map((value, index) =>
    value === null || series.std[index] === null ? null : value - series.std[index]
  );
  const upper = series.mean.map((value, index) =>
    value === null || series.std[index] === null ? null : value + series.std[index]
  );
  return [
    {
      x,
      y: lower,
      type: "scatter",
      mode: "lines",
      line: { width: 0 },
      hoverinfo: "skip",
      showlegend: false,
    },
    {
      x,
      y: upper,
      type: "scatter",
      mode: "lines",
      line: { width: 0 },
      fill: "tonexty",
      fillcolor: bandColor(color),
      hoverinfo: "skip",
      name: "1σ Abweichung",
    },
    {
      x,
      y: series.mean,
      customdata: series.model_count,
      type: "scatter",
      mode: "lines",
      line: { color, width: 2.5 },
      name: "Mittelwert",
      hovertemplate: "<b>%{x}</b><br>Mittelwert: %{y:.2f}<br>%{customdata} Modelle<extra></extra>",
    },
  ];
}

function overlayTrace(x, series, overlay) {
  const unit = series.unit ? ` ${series.unit}` : "";
  return {
    x,
    y: series.mean,
    customdata: series.model_count,
    type: "scatter",
    mode: "lines",
    line: { color: overlay.color, width: 2, dash: "dash" },
    name: overlay.label,
    yaxis: overlay.secondary ? "y2" : "y",
    hovertemplate:
      `<b>%{x}</b><br>${overlay.label}: %{y:.2f}${unit}` +
      "<br>%{customdata} Modelle<extra></extra>",
  };
}

function toCardinal(degrees) {
  if (degrees === null || degrees === undefined) return "–";
  const normalized = ((degrees % 360) + 360) % 360;
  return CARDINALS[Math.round(normalized / 22.5) % 16];
}

function directionTrace(x, series, color, step = 1) {
  const directions = series.mean;
  const spreads = series.std || [];
  const counts = series.model_count || [];
  const arrowX = [];
  const angles = [];
  const opacities = [];
  const customdata = [];
  for (let index = 0; index < x.length; index += step) {
    const value = directions[index];
    if (value === null || value === undefined) continue;
    const spread = spreads[index];
    arrowX.push(x[index]);
    angles.push((value + 180) % 360);
    opacities.push(
      spread === null || spread === undefined
        ? 0.9
        : Math.max(0.15, 1 - Math.min(spread, 45) / 45)
    );
    customdata.push([
      Math.round(value),
      toCardinal(value),
      spread === null || spread === undefined ? null : Math.round(spread),
      counts[index] || 0,
    ]);
  }
  return {
    x: arrowX,
    y: arrowX.map(() => 0.9),
    customdata,
    type: "scatter",
    mode: "markers",
    yaxis: "y2",
    marker: {
      symbol: "arrow",
      angle: angles,
      angleref: "up",
      size: 11,
      color,
      opacity: opacities,
      line: { width: 0 },
    },
    name: "Windrichtung (Pfeile)",
    hovertemplate:
      "<b>%{x}</b><br>Wind aus %{customdata[1]} (%{customdata[0]}°)" +
      "<br>Streuung: ±%{customdata[2]}°<br>%{customdata[3]} Modelle<extra></extra>",
  };
}

function nextDayString(day) {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + 1));
  return next.toISOString().slice(0, 10);
}

function dayShapes(timestamps, mode) {
  if (!timestamps.length) return [];
  const days = [];
  timestamps.forEach((timestamp) => {
    const day = timestamp.slice(0, 10);
    if (!days.length || days[days.length - 1].day !== day) {
      days.push({ day, start: timestamp });
    }
  });
  const shapes = [];
  days.forEach((entry, index) => {
    if (index % 2 === 0) return;
    const end =
      index + 1 < days.length
        ? days[index + 1].start
        : mode === "hourly"
        ? `${nextDayString(entry.day)}T00:00`
        : nextDayString(entry.day);
    shapes.push({
      type: "rect",
      xref: "x",
      yref: "paper",
      x0: entry.start,
      x1: end,
      y0: 0,
      y1: 1,
      fillcolor: "rgba(148, 163, 184, 0.08)",
      line: { width: 0 },
      layer: "below",
    });
  });
  return shapes;
}

function extractXRange(eventData, el) {
  if (eventData["xaxis.autorange"]) return null;
  if ("xaxis.range[0]" in eventData && "xaxis.range[1]" in eventData) {
    return [eventData["xaxis.range[0]"], eventData["xaxis.range[1]"]];
  }
  if (Array.isArray(eventData["xaxis.range"])) {
    return [eventData["xaxis.range"][0], eventData["xaxis.range"][1]];
  }
  const full = el._fullLayout && el._fullLayout.xaxis;
  if (full && full.range) return [full.range[0], full.range[1]];
  return null;
}

function applyRangeToAll(sourceKey) {
  const source = state.plots[sourceKey];
  if (!source || !source.range) return;
  Object.entries(state.plots).forEach(([key, plot]) => {
    if (key === sourceKey) return;
    plot.range = [source.range[0], source.range[1]];
    Plotly.relayout(plot.el, { "xaxis.range": plot.range });
  });
}

function resetZoom() {
  Object.values(state.plots).forEach((plot) => {
    const range = plot.defaultRange;
    plot.range = range ? [range[0], range[1]] : null;
    if (range) {
      Plotly.relayout(plot.el, { "xaxis.range": range });
    } else {
      Plotly.relayout(plot.el, { "xaxis.autorange": true });
    }
  });
}

function renderChart(param, block, series) {
  if (series.models_used.length === 0) {
    return null;
  }
  const card = document.createElement("div");
  card.className = "chart-card";

  const head = document.createElement("div");
  head.className = "chart-head";
  const title = document.createElement("span");
  title.className = "chart-title";
  title.textContent = param.label;
  head.appendChild(title);
  if (param.info) {
    const info = document.createElement("span");
    info.className = "info";
    info.textContent = "i";
    info.title = param.info;
    info.setAttribute("aria-label", param.info);
    head.appendChild(info);
  }
  const applyZoom = document.createElement("button");
  applyZoom.className = "apply-zoom";
  applyZoom.textContent = "Zoom auf alle anwenden";
  applyZoom.title = "Aktuellen X-Zoom dieses Charts auf alle anderen Charts anwenden";
  applyZoom.addEventListener("click", () => applyRangeToAll(param.key));
  head.appendChild(applyZoom);
  card.appendChild(head);

  const badges = document.createElement("div");
  badges.className = "badges";
  if (series.resolution !== state.mode) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "nur täglich aufgelöst";
    badges.appendChild(badge);
  }
  if (series.models_used.length === 1) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "nur 1 Modell";
    badges.appendChild(badge);
  }
  const counts = series.model_count || [];
  if (counts.length && Math.min(...counts) < Math.max(...counts)) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `Modellanzahl ${Math.min(...counts)}–${Math.max(...counts)}`;
    badges.appendChild(badge);
  }
  card.appendChild(badges);

  const plot = document.createElement("div");
  card.appendChild(plot);

  const timestamps = block.timestamps;
  const bound = startBound();
  let xRange;
  if (state.mode === "hourly" && timestamps.length) {
    const start = bound && bound > timestamps[0] ? bound : timestamps[0];
    xRange = [start, timestamps[Math.min(24 * HOURLY_WINDOW_DAYS, timestamps.length - 1)]];
  }

  const traces = buildTraces(timestamps, series, param.color);
  let secondaryUnit = null;
  (param.overlays || []).forEach((overlay) => {
    const overlaySeries = block.parameters[overlay.key];
    if (!overlaySeries || overlaySeries.models_used.length === 0) return;
    traces.push(overlayTrace(timestamps, overlaySeries, overlay));
    if (overlay.secondary) secondaryUnit = overlaySeries.unit || "";
  });

  let hasDirection = false;
  if (param.direction) {
    const directionSeries = block.parameters[param.direction.key];
    if (directionSeries && directionSeries.models_used.length > 0) {
      const arrowStep = state.mode === "hourly" ? 3 : 1;
      traces.push(directionTrace(timestamps, directionSeries, param.color, arrowStep));
      hasDirection = true;
    }
  }

  const layout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#cbd5e1" },
    margin: { l: 54, r: secondaryUnit !== null || hasDirection ? 48 : 18, t: 42, b: 46 },
    height: 300,
    showlegend: true,
    legend: { orientation: "h", x: 0.5, xanchor: "center", y: 1.0, yanchor: "bottom" },
    xaxis: {
      gridcolor: "#334155",
      type: "date",
      nticks: 7,
      automargin: true,
      tickformat: state.mode === "hourly" ? "%d.%m. %Hh" : "%a %d.%m.",
      tickangle: state.mode === "hourly" ? -45 : 0,
      minallowed: bound || undefined,
      maxallowed: timestamps.length ? timestamps[timestamps.length - 1] : undefined,
    },
    yaxis: {
      gridcolor: "#334155",
      title: { text: series.unit || "" },
      rangemode: param.zero ? "tozero" : "normal",
    },
    shapes: dayShapes(timestamps, state.mode),
  };
  if (xRange) {
    layout.xaxis.range = xRange;
  }
  if (secondaryUnit !== null) {
    layout.yaxis2 = {
      overlaying: "y",
      side: "right",
      showgrid: false,
      rangemode: "tozero",
      range: [0, 100],
      color: "#94a3b8",
      title: { text: secondaryUnit },
    };
  } else if (hasDirection) {
    layout.yaxis2 = {
      overlaying: "y",
      side: "right",
      showgrid: false,
      showticklabels: false,
      zeroline: false,
      fixedrange: true,
      range: [0, 1],
    };
  }

  Plotly.newPlot(plot, traces, layout, {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  }).then(() => {
    const autoRange =
      plot._fullLayout && plot._fullLayout.xaxis && plot._fullLayout.xaxis.range;
    const defaultRange = xRange
      ? [xRange[0], xRange[1]]
      : autoRange
      ? [autoRange[0], autoRange[1]]
      : null;
    state.plots[param.key] = { el: plot, range: defaultRange, defaultRange };
    plot.on("plotly_relayout", (eventData) => {
      const range = extractXRange(eventData, plot);
      if (range) {
        state.plots[param.key].range = range;
      } else if (eventData["xaxis.autorange"]) {
        state.plots[param.key].range = state.plots[param.key].defaultRange;
      }
    });
  });

  return card;
}

function renderCharts() {
  chartsEl.innerHTML = "";
  state.plots = {};
  const block = state.data[state.mode];
  const rendered = [];
  CHARTS.forEach((chart) => {
    const series = block.parameters[chart.key];
    if (!series) return;
    const card = renderChart(chart, block, series);
    if (card) rendered.push(card);
  });
  if (!rendered.length) {
    const empty = document.createElement("p");
    empty.textContent = "Keine Daten für diese Auflösung verfügbar.";
    chartsEl.appendChild(empty);
  } else {
    rendered.forEach((card) => chartsEl.appendChild(card));
  }
}

function renderModelsPanel() {
  const { models_requested } = state.data;
  modelsSummary.textContent =
    `Abgefragt für diesen Ort: ${models_requested.map(displayName).join(", ")} ` +
    `(${models_requested.length} Modelle).`;

  modelsList.innerHTML = "";
  const block = state.data[state.mode];
  PANEL_PARAMS.forEach((param) => {
    const series = block.parameters[param.key];
    if (!series) return;
    const row = document.createElement("div");
    row.className = "model-row";

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = param.note ? `${param.label} (${param.note})` : param.label;

    const models = document.createElement("span");
    models.className = "models";

    const used = document.createElement("span");
    used.textContent = series.models_used.length
      ? `${series.models_used.length} von ${models_requested.length}: ${series.models_used
          .map(displayName)
          .join(", ")}`
      : `0 von ${models_requested.length}: keine Daten`;
    models.appendChild(used);

    const missing = models_requested.filter((model) => !series.models_used.includes(model));
    if (missing.length) {
      const missingEl = document.createElement("span");
      missingEl.className = "missing";
      missingEl.textContent = `nicht geliefert: ${missing.map(displayName).join(", ")}`;
      models.appendChild(missingEl);
    }

    const counts = series.model_count || [];
    if (counts.length && Math.min(...counts) < Math.max(...counts)) {
      const coverage = document.createElement("span");
      coverage.className = "coverage";
      coverage.textContent = `Modellanzahl über den Zeitraum: ${Math.min(...counts)}–${Math.max(
        ...counts
      )}`;
      models.appendChild(coverage);
    }

    row.append(name, models);
    modelsList.appendChild(row);
  });
  modelsPanel.hidden = false;
}

function renderLocationMeta() {
  const { location, models_requested, models_used, generated_at } = state.data;
  const place = [location.name, location.admin1, location.country].filter(Boolean).join(", ");
  const parts = [
    place,
    `${models_used.length} von ${models_requested.length} Modellen mit Daten`,
    `Aktualisiert: ${new Date(generated_at).toLocaleString("de-DE")}`,
  ];

  locationMeta.innerHTML = "";
  const text = document.createElement("span");
  text.textContent = parts.join(" · ");
  locationMeta.appendChild(text);

  const alreadyFavorite = isFavorite(state.selected);
  const star = document.createElement("button");
  star.type = "button";
  star.className = alreadyFavorite ? "star-btn on" : "star-btn";
  star.textContent = alreadyFavorite ? "★ Favorit" : "☆ Favorit";
  star.title = alreadyFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen";
  star.addEventListener("click", toggleFavorite);
  locationMeta.appendChild(star);
}

function render() {
  renderLocationMeta();
  renderCharts();
  renderModelsPanel();
  renderFavorites();
  resetZoomBtn.hidden = false;
  windowHint.textContent =
    state.mode === "hourly" ? "Anzeige ab jetzt: erste 3 Tage – für alle 7 Tage zoomen" : "";
  setStatus("Fertig.");
}

resetZoomBtn.addEventListener("click", resetZoom);

document.getElementById("resolution-toggle").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.dataset.mode === state.mode) return;
  state.mode = button.dataset.mode;
  document
    .querySelectorAll("#resolution-toggle button")
    .forEach((el) => el.classList.toggle("active", el === button));
  if (state.data) render();
});

searchInput.addEventListener(
  "input",
  debounce((event) => searchLocations(event.target.value), 300)
);

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const first = suggestions.querySelector(".suggestion");
    if (first) first.click();
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-wrap")) closeSuggestions();
});

loadFavorites();
