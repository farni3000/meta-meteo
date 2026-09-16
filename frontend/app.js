const PARAMS = [
  { key: "temperature_2m", label: "Temperatur (2 m)", color: "#f97316", zero: false },
  { key: "wind_speed_10m", label: "Wind (10 m)", color: "#38bdf8", zero: true },
  { key: "uv_index", label: "UV-Index", color: "#facc15", zero: true },
  { key: "precipitation_probability", label: "Niederschlagswahrscheinlichkeit", color: "#818cf8", zero: true },
  { key: "precipitation", label: "Niederschlagsmenge", color: "#4ade80", zero: true },
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
};

const searchInput = document.getElementById("search");
const suggestions = document.getElementById("suggestions");
const statusEl = document.getElementById("status");
const locationMeta = document.getElementById("location-meta");
const chartsEl = document.getElementById("charts");
const modelsPanel = document.getElementById("models-panel");
const modelsList = document.getElementById("models-list");

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
      name: "Mittelwert ± 1σ",
    },
    {
      x,
      y: series.mean,
      type: "scatter",
      mode: "lines",
      line: { color, width: 2.5 },
      name: "Mittelwert",
      hovertemplate: "<b>%{x}</b><br>Mittelwert: %{y:.2f}<extra></extra>",
    },
  ];
}

function renderChart(param, block, series) {
  if (series.models_used.length === 0) {
    return null;
  }
  const card = document.createElement("div");
  card.className = "chart-card";

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
  card.appendChild(badges);

  const plot = document.createElement("div");
  card.appendChild(plot);

  const layout = {
    title: { text: param.label, font: { size: 14, color: "#e2e8f0" }, x: 0.03 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#cbd5e1" },
    margin: { l: 54, r: 18, t: 44, b: 38 },
    height: 300,
    showlegend: true,
    legend: { orientation: "h", y: 1.14, x: 0 },
    xaxis: {
      gridcolor: "#334155",
      type: "date",
      tickformat: state.mode === "hourly" ? "%d.%m. %Hh" : "%d.%m.",
    },
    yaxis: {
      gridcolor: "#334155",
      title: { text: series.unit || "" },
      rangemode: param.zero ? "tozero" : "normal",
    },
  };

  Plotly.newPlot(plot, buildTraces(block.timestamps, series, param.color), layout, {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  });

  return card;
}

function renderCharts() {
  chartsEl.innerHTML = "";
  const block = state.data[state.mode];
  const rendered = [];
  PARAMS.forEach((param) => {
    const series = block.parameters[param.key];
    if (!series) return;
    const card = renderChart(param, block, series);
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
  modelsList.innerHTML = "";
  const block = state.data[state.mode];
  PARAMS.forEach((param) => {
    const series = block.parameters[param.key];
    if (!series) return;
    const row = document.createElement("div");
    row.className = "model-row";

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = param.label;

    const models = document.createElement("span");
    models.className = "models";
    models.textContent = series.models_used.length
      ? series.models_used.map(displayName).join(", ")
      : "keine Daten";

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
  setStatus("Fertig.");
}

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
