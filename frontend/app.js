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
    info: "Windgeschwindigkeit in 10 m Höhe über Grund – die meteorologische Standard-Messhöhe. Wind in 2 m Höhe ist bei Open-Meteo nicht verfügbar.",
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
});

const HOURLY_WINDOW_DAYS = 3;

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
};

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

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function displayName(model) {
  return DISPLAY_NAMES[model] || model;
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
  applyZoom.textContent = "Zoom auf alle";
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
  const xRange =
    state.mode === "hourly" && timestamps.length
      ? [
          timestamps[0],
          timestamps[Math.min(24 * HOURLY_WINDOW_DAYS, timestamps.length - 1)],
        ]
      : undefined;

  const traces = buildTraces(timestamps, series, param.color);
  let secondaryUnit = null;
  (param.overlays || []).forEach((overlay) => {
    const overlaySeries = block.parameters[overlay.key];
    if (!overlaySeries || overlaySeries.models_used.length === 0) return;
    traces.push(overlayTrace(timestamps, overlaySeries, overlay));
    if (overlay.secondary) secondaryUnit = overlaySeries.unit || "";
  });

  const layout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#cbd5e1" },
    margin: { l: 54, r: secondaryUnit !== null ? 48 : 18, t: 42, b: 46 },
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
  locationMeta.textContent = parts.join(" · ");
}

function render() {
  renderLocationMeta();
  renderCharts();
  renderModelsPanel();
  resetZoomBtn.hidden = false;
  windowHint.textContent =
    state.mode === "hourly" ? "Anzeige: erste 3 Tage – für alle 7 Tage zoomen" : "";
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
