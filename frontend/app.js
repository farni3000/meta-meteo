const t = (key, vars) => I18n.t(key, vars);
const locale = () => I18n.locale();

const CHARTS = [
  {
    key: "temperature_2m",
    labelKey: "chart.temperature.label",
    infoKey: "chart.temperature.info",
    color: "#f97316",
    zero: false,
    // Feels-like temperature is temporarily disabled on purpose; keep for later.
    // overlays: [
    //   { key: "apparent_temperature", labelKey: "chart.temperature.overlay", color: "#fca5a5" },
    // ],
    annotations: { type: "max", dynamicArrow: true },
    dailyExtremes: true,
    dailyAnnotations: { min: true, max: true },
  },
  {
    key: "sunshine_duration",
    labelKey: "chart.sunshine.label",
    infoKey: "chart.sunshine.info",
    color: "#fbbf24",
    zero: true,
    sunCeiling: true,
    overlays: [
      {
        key: "cloud_cover",
        labelKey: "chart.sunshine.overlay",
        color: "#60a5fa",
        secondary: true,
        axisMax: 100,
      },
    ],
    annotations: { type: "sum", pinToTop: true },
    dailyAnnotations: { min: true, max: true, sum: true, pinSum: true },
  },
  {
    key: "wind_speed_10m",
    labelKey: "chart.wind.label",
    infoKey: "chart.wind.info",
    color: "#38bdf8",
    zero: true,
    direction: { key: "wind_direction_10m", labelKey: "chart.wind.direction" },
    annotations: { type: "max", dynamicArrow: true },
    dailyAnnotations: { max: true },
  },
  {
    key: "precipitation_probability",
    titleKey: "chart.precip.title",
    labelKey: "chart.precipProb.label",
    meanLabelKey: "chart.precipProb.label",
    infoKey: "chart.precip.info",
    color: "#818cf8",
    zero: true,
    reserveTop: true,
    annotations: { type: "max", dynamicArrow: true },
    dailyAnnotations: { max: true },
    overlays: [
      {
        key: "precipitation",
        labelKey: "chart.precip.label",
        color: "#4ade80",
        secondary: true,
        bars: true,
        annotations: { type: "sum", pinToTop: true },
        dailyAnnotations: { max: true, sum: true, pinSum: true },
      },
    ],
  },
  {
    key: "uv_index",
    labelKey: "chart.uv.label",
    infoKey: "chart.uv.info",
    color: "#ec4899",
    zero: true,
    annotations: { type: "max", dynamicArrow: true },
    dailyAnnotations: { max: true },
  },
  {
    key: "pressure_msl",
    labelKey: "chart.pressure.label",
    infoKey: "chart.pressure.info",
    color: "#c084fc",
    zero: false,
    annotations: { type: "max", dynamicArrow: true },
    dailyAnnotations: { min: true, max: true },
    bands: [
      { from: 900, to: 1000, labelKey: "band.low", color: "#60a5fa" },
      { from: 1000, to: 1013, labelKey: "band.slightlyBelow", color: "#22d3ee" },
      { from: 1013, to: 1025, labelKey: "band.normal", color: "#4ade80" },
      { from: 1025, to: 1100, labelKey: "band.high", color: "#f59e0b" },
    ],
  },
];

function buildPanelParams() {
  const params = [];
  CHARTS.forEach((chart) => {
    params.push({ key: chart.key, labelKey: chart.labelKey });
    (chart.overlays || []).forEach((overlay) => {
      params.push({
        key: overlay.key,
        labelKey: overlay.labelKey,
        noteKey: overlay.bars ? "panel.noteBars" : "panel.noteDashed",
        chartLabelKey: chart.titleKey || chart.labelKey,
      });
    });
    if (chart.direction) {
      params.push({
        key: chart.direction.key,
        labelKey: chart.direction.labelKey,
        noteKey: "panel.noteArrows",
        chartLabelKey: chart.labelKey,
      });
    }
  });
  return params;
}

const PANEL_PARAMS = buildPanelParams();

const HOURLY_WINDOW_DAYS = 3;

const DISPLAY_NAMES = {
  icon_seamless: "DWD ICON",
  gfs_seamless: "NOAA GFS",
  ecmwf_ifs025: "ECMWF IFS",
  ukmo_seamless: "UK Met Office",
  meteofrance_seamless: "Météo-France",
  jma_seamless: "Japan JMA",
};

const MODEL_DOCS = {
  icon_seamless: "https://open-meteo.com/en/docs/dwd-api",
  gfs_seamless: "https://open-meteo.com/en/docs/gfs-api",
  ecmwf_ifs025: "https://open-meteo.com/en/docs/ecmwf-api",
  ukmo_seamless: "https://open-meteo.com/en/docs/ukmo-api",
  meteofrance_seamless: "https://open-meteo.com/en/docs/meteofrance-api",
  jma_seamless: "https://open-meteo.com/en/docs/jma-api",
  gem_seamless: "https://open-meteo.com/en/docs/gem-api",
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
const alertsEl = document.getElementById("alerts");
const chartsEl = document.getElementById("charts");
const modelsPanel = document.getElementById("models-panel");
const modelsSummary = document.getElementById("models-summary");
const modelsList = document.getElementById("models-list");
const resetZoomBtn = document.getElementById("reset-zoom");
const refreshBtn = document.getElementById("refresh");
const favoritesEl = document.getElementById("favorites");
const smalltalkBtn = document.getElementById("smalltalk");
const smalltalkModal = document.getElementById("smalltalk-modal");
const smalltalkText = document.getElementById("smalltalk-text");
const smalltalkClose = document.getElementById("smalltalk-close");
const smalltalkAgain = document.getElementById("smalltalk-again");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function displayName(model) {
  if (model === "gem_seamless") return I18n.gemName();
  return DISPLAY_NAMES[model] || model;
}

function chartInfoText(param, series) {
  const hasDailySum =
    state.mode === "daily" &&
    ((param.dailyAnnotations && param.dailyAnnotations.sum) ||
      (param.overlays || []).some(
        (overlay) => overlay.dailyAnnotations && overlay.dailyAnnotations.sum
      ));
  const parts = [t(param.infoKey)];
  if (hasDailySum) parts.push(t("chart.sumRangeNote"));
  if (series.models_used.length) {
    parts.push(
      t("chart.infoModels", {
        used: series.models_used.length,
        total: state.data.models_requested.length,
        models: series.models_used.map(displayName).join(", "),
      })
    );
  }
  const counts = series.model_count || [];
  if (counts.length && Math.min(...counts) < Math.max(...counts)) {
    parts.push(
      t("models.coverage", { min: Math.min(...counts), max: Math.max(...counts) })
    );
  }
  return parts.join("\n\n");
}

function closeInfoPopups() {
  document.querySelectorAll(".info-popup").forEach((popup) => {
    popup.hidden = true;
    popup.dataset.pinned = "0";
  });
}

function modelLink(model) {
  const link = document.createElement("a");
  link.href = MODEL_DOCS[model] || "https://open-meteo.com/en/docs";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = displayName(model);
  link.title = t("models.docsLinkTitle", { model: displayName(model) });
  return link;
}

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || !isFinite(value)) return "–";
  return new Intl.NumberFormat(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatValue(value, unit) {
  const text = formatNumber(value);
  if (!unit) return text;
  return unit === "°" ? `${text}${unit}` : `${text} ${unit}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function timeValue(value) {
  if (value === null || value === undefined) return NaN;
  return new Date(value).getTime();
}

function startBound() {
  const now = state.data && state.data.now;
  if (!now) return null;
  return state.mode === "hourly" ? now : `${now.slice(0, 10)}T00:00`;
}

function hourlyWindowEnd(bound, timestamps) {
  if (!timestamps.length) return null;
  const lastMs = wallClockMs(timestamps[timestamps.length - 1]);
  const boundMs = bound ? wallClockMs(bound) : wallClockMs(timestamps[0]);
  let endMs = Math.min(boundMs + HOURLY_WINDOW_DAYS * 24 * 3600000, lastMs);
  const day = isoLocal(endMs).slice(0, 10);
  if ((endMs - localMs(day)) / 3600000 < 3) {
    endMs = localMs(day);
  }
  return isoLocal(endMs);
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
    const params = new URLSearchParams({
      query,
      lang: I18n.getLang(),
    });
    const response = await fetch(`/api/geocode?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    renderSuggestions(data.results || []);
  } catch (error) {
    setStatus(t("status.geocodeError", { message: error.message }), true);
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

const FAVORITES_STORAGE_KEY = "metameteo.favorites";

function readStoredFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeStoredFavorites() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(state.favorites));
  } catch (error) {
    setStatus(t("status.favoriteSaveError", { message: error.message }), true);
  }
}

function loadFavorites() {
  state.favorites = readStoredFavorites();
  renderFavorites();
}

function renderFavorites() {
  favoritesEl.innerHTML = "";
  if (!state.favorites.length) {
    const empty = document.createElement("span");
    empty.className = "favorites-empty";
    empty.textContent = t("favorites.empty");
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
    remove.title = t("favorites.removeTitle");
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

function toggleFavorite() {
  if (!state.selected) return;
  const id = favoriteId(state.selected);
  if (isFavorite(state.selected)) {
    state.favorites = state.favorites.filter((favorite) => favorite.id !== id);
  } else {
    const { name, country, country_code, admin1, latitude, longitude, timezone } = state.selected;
    state.favorites.push({ id, name, country, country_code, admin1, latitude, longitude, timezone });
  }
  writeStoredFavorites();
  renderFavorites();
  renderLocationMeta();
}

function removeFavorite(id, event) {
  if (event) event.stopPropagation();
  state.favorites = state.favorites.filter((favorite) => favorite.id !== id);
  writeStoredFavorites();
  renderFavorites();
  renderLocationMeta();
}

function persistOrder() {
  writeStoredFavorites();
}

async function selectLocation(location, options = {}) {
  state.selected = location;
  searchInput.value = location.name;
  closeSuggestions();
  setStatus(t("status.loading"));
  try {
    const params = new URLSearchParams({
      lat: location.latitude,
      lon: location.longitude,
      days: 7,
      lang: I18n.getLang(),
    });
    if (options.refresh) {
      params.set("refresh", "1");
      params.set("_", Date.now());
    }
    if (location.name) params.set("name", location.name);
    if (location.country) params.set("country", location.country);
    if (location.country_code) params.set("country_code", location.country_code);
    if (location.admin1) params.set("admin1", location.admin1);
    if (location.timezone) params.set("tz", location.timezone);

    const response = await fetch(`/api/forecast?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok) {
      const detail = typeof payload.detail === "string" ? payload.detail : payload.detail?.message;
      throw new Error(detail || `HTTP ${response.status}`);
    }
    state.data = payload;
    await loadPlotlyLocale(I18n.getLang());
    render();
  } catch (error) {
    setStatus(t("status.forecastError", { message: error.message }), true);
  }
}

async function refreshForecast() {
  if (!state.selected || refreshBtn.disabled) return;
  refreshBtn.disabled = true;
  try {
    await selectLocation(state.selected, { refresh: true });
  } finally {
    refreshBtn.disabled = false;
  }
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function bandColor(hex) {
  return hexToRgba(hex, 0.18);
}

function seriesExtent(series, cap) {
  let min = Infinity;
  let max = -Infinity;
  series.mean.forEach((value, index) => {
    if (value === null || value === undefined) return;
    const spread = (series.std && series.std[index]) || 0;
    let lower = value - spread;
    let upper = value + spread;
    if (cap) {
      const limit = cap[index];
      upper = limit !== null && limit !== undefined ? Math.min(upper, limit) : upper;
      lower = limit !== null && limit !== undefined ? clamp(lower, 0, limit) : Math.max(lower, 0);
    }
    min = Math.min(min, lower);
    max = Math.max(max, upper);
  });
  return isFinite(min) && isFinite(max) ? [min, max] : null;
}

function bandShapes(bands) {
  const shapes = bands.map((band) => ({
    type: "rect",
    xref: "paper",
    x0: 0,
    x1: 1,
    yref: "y",
    y0: band.from,
    y1: band.to,
    fillcolor: hexToRgba(band.color, 0.12),
    line: { width: 0 },
    layer: "below",
  }));
  bands.slice(1).forEach((band) => {
    shapes.push({
      type: "line",
      xref: "paper",
      x0: 0,
      x1: 1,
      yref: "y",
      y0: band.from,
      y1: band.from,
      line: { color: hexToRgba(band.color, 0.45), width: 1 },
      layer: "below",
    });
  });
  return shapes;
}

function bandAnnotations(bands, range) {
  const [yMin, yMax] = range;
  const pad = (yMax - yMin) * 0.06;
  return bands
    .filter((band) => band.to >= yMin && band.from <= yMax)
    .map((band) => {
      const visibleMin = Math.max(band.from, yMin);
      const visibleMax = Math.min(band.to, yMax);
      const center = (visibleMin + visibleMax) / 2;
      const y = Math.min(Math.max(center, yMin + pad), yMax - pad);
      return {
        xref: "paper",
        x: 0.995,
        xanchor: "right",
        yref: "y",
        y,
        text: t(band.labelKey),
        showarrow: false,
        font: { size: 10, color: band.color },
        opacity: 0.9,
      };
    });
}

function localMs(value) {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return Date.UTC(year, month - 1, day, hour, minute);
}

function isoLocal(ms) {
  return new Date(ms).toISOString().slice(0, 16);
}

function wallClockMs(value) {
  if (typeof value === "number" && isFinite(value)) return value;
  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):?(\d{2})?)?/
  );
  if (!match) return NaN;
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || 0),
    Number(match[5] || 0)
  );
}

function weekdayName(value) {
  const ms = wallClockMs(value);
  if (!isFinite(ms)) return String(value);
  return I18n.weekdays()[new Date(ms).getUTCDay()];
}

function hoverXLabel(value) {
  const ms = wallClockMs(value);
  if (!isFinite(ms)) return String(value);
  const date = new Date(ms);
  const day = I18n.weekdays()[date.getUTCDay()];
  if (state.mode === "daily") return day;
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${hours}:${minutes}`;
}

function hourlyTicks(start, end) {
  const startMs = wallClockMs(start);
  const endMs = wallClockMs(end);
  if (!isFinite(startMs) || !isFinite(endMs) || endMs <= startMs) {
    return { tickvals: [], ticktext: [] };
  }
  const spanHours = (endMs - startMs) / 3600000;
  const step = [1, 2, 3, 6, 12, 24].find((hours) => spanHours / hours <= 8) || 24;
  let tickMs = Math.floor(startMs / 86400000) * 86400000;
  if (tickMs < startMs) {
    const index = Math.ceil((startMs - tickMs) / 3600000 / step);
    tickMs += index * step * 3600000;
  }
  const tickvals = [];
  const ticktext = [];
  while (tickMs <= endMs) {
    const iso = isoLocal(tickMs);
    const hour = Number(iso.slice(11, 13));
    tickvals.push(iso);
    if (hour === 0) {
      ticktext.push(weekdayName(iso));
    } else {
      ticktext.push(`${iso.slice(11, 13)}:00`);
    }
    tickMs += step * 3600000;
  }
  return { tickvals, ticktext };
}

function hourlyTickLayout(range) {
  if (!range || range[0] === undefined || range[1] === undefined) return {};
  const { tickvals, ticktext } = hourlyTicks(range[0], range[1]);
  if (!tickvals.length) return {};
  return { "xaxis.tickvals": tickvals, "xaxis.ticktext": ticktext };
}

function dailyHighlights(param, context) {
  const hourly = state.data.hourly;
  const source = hourly && hourly.parameters && hourly.parameters[param.key];
  if (!source || !source.mean || !source.mean.length) return [];
  const unit = source.unit || "";
  const mode = context && context.mode;
  const bound = context && context.bound;
  const endBound = context && context.endBound;
  const startedDay = mode === "hourly" && bound ? bound.slice(0, 10) : null;
  const endDay = mode === "hourly" && endBound ? endBound.slice(0, 10) : null;
  const groups = new Map();
  hourly.timestamps.forEach((timestamp, index) => {
    const value = source.mean[index];
    if (value === null || value === undefined) return;
    const day = timestamp.slice(0, 10);
    let group = groups.get(day);
    if (!group) {
      group = { day, entries: [] };
      groups.set(day, group);
    }
    group.entries.push({ timestamp, value });
  });
  const highlights = [];
  Array.from(groups.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .forEach((group) => {
      let entries = group.entries;
      if (group.day === startedDay) {
        entries = entries.filter((entry) => entry.timestamp >= bound);
        const remaining = (localMs(nextDayString(group.day)) - localMs(bound)) / 3600000;
        if (remaining <= 3 || !entries.length) return;
      } else if (group.day === endDay) {
        entries = entries.filter((entry) => entry.timestamp <= endBound);
        const visible = (wallClockMs(endBound) - localMs(group.day)) / 3600000;
        if (visible < 3 || !entries.length) return;
      }
      if (!entries.length) return;
      const type = param.annotations.type;
      let value;
      let x;
      if (type === "sum") {
        value = entries.reduce((total, entry) => total + entry.value, 0);
        x = entries[Math.floor(entries.length / 2)].timestamp;
      } else {
        const best = entries.reduce((a, b) => (b.value > a.value ? b : a));
        value = best.value;
        x = best.timestamp;
      }
      if (Math.round(value * 10) === 0) return;
      highlights.push({ day: group.day, x, value, text: formatValue(value, unit) });
    });
  return highlights;
}

const TEMP_MAX_COLOR = "#f97316";
const TEMP_MIN_COLOR = "#60a5fa";

function computeAnnotationPoints(param, config, context) {
  if (!config) return [];
  if (context && context.mode === "daily") {
    return rangeHighlights(param, config, context);
  }
  return dailyHighlights(param, context);
}

function dailyPlotTimestamp(timestamp) {
  return `${timestamp.slice(0, 10)}T12:00`;
}

function dailyGroupedExtremes(param) {
  const daily = state.data && state.data.daily;
  const hourly = state.data && state.data.hourly;
  const source = hourly && hourly.parameters && hourly.parameters[param.key];
  if (!daily || !daily.timestamps || !source || !source.mean) return null;
  const spread = source.std || [];
  const days = new Map();
  hourly.timestamps.forEach((timestamp, index) => {
    const value = source.mean[index];
    if (value === null || value === undefined || !isFinite(value)) return;
    const std = spread[index];
    const day = timestamp.slice(0, 10);
    const entry = days.get(day);
    if (!entry) {
      days.set(day, { max: value, min: value, maxStd: std, minStd: std });
      return;
    }
    if (value > entry.max) {
      entry.max = value;
      entry.maxStd = std;
    }
    if (value < entry.min) {
      entry.min = value;
      entry.minStd = std;
    }
  });
  let hasValue = false;
  const collect = (key, stdKey) =>
    daily.timestamps.map((timestamp) => {
      const entry = days.get(timestamp.slice(0, 10));
      if (!entry) return null;
      hasValue = true;
      return { value: entry[key], std: entry[stdKey] };
    });
  const maxEntries = collect("max", "maxStd");
  const minEntries = collect("min", "minStd");
  if (!hasValue) return null;
  return {
    max: maxEntries.map((entry) => (entry ? entry.value : null)),
    min: minEntries.map((entry) => (entry ? entry.value : null)),
    maxStd: maxEntries.map((entry) => (entry ? entry.std : null)),
    minStd: minEntries.map((entry) => (entry ? entry.std : null)),
  };
}

function dailyBandTraces(x, values, stds, color, name, rank) {
  const lower = values.map((value, index) => {
    const std = stds[index];
    if (value === null || value === undefined || std === null || std === undefined) return null;
    return value - std;
  });
  const upper = values.map((value, index) => {
    const std = stds[index];
    if (value === null || value === undefined || std === null || std === undefined) return null;
    return value + std;
  });
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
      name,
      legendgroup: name,
      legendrank: rank,
      showlegend: !!name,
    },
  ];
}

function dailyExtremesTraces(x, extremes, unit) {
  const customdata = (values) =>
    values.map((value, index) => [
      value === null || value === undefined ? "–" : formatValue(value, unit),
      hoverXLabel(x[index]),
    ]);
  const line = (values, color, labelKey, rank) => ({
    x,
    y: values,
    customdata: customdata(values),
    type: "scatter",
    mode: "lines+markers",
    line: { color, width: 2.5 },
    marker: { size: 6, color, line: { width: 0 } },
    name: t(labelKey),
    legendrank: rank,
    hovertemplate: t("chart.hoverCeilingTemplate", { label: t(labelKey) }),
  });
  return [
    ...dailyBandTraces(
      x,
      extremes.max,
      extremes.maxStd,
      TEMP_MAX_COLOR,
      t("chart.legendStdMax"),
      2
    ),
    line(extremes.max, TEMP_MAX_COLOR, "chart.temperature.maxLine", 1),
    ...dailyBandTraces(
      x,
      extremes.min,
      extremes.minStd,
      TEMP_MIN_COLOR,
      t("chart.legendStdMin"),
      4
    ),
    line(extremes.min, TEMP_MIN_COLOR, "chart.temperature.minLine", 3),
  ];
}

function rangeHighlights(param, config, context) {
  const block = state.data && state.data.daily;
  const series = block && block.parameters && block.parameters[param.key];
  if (!series || !series.mean || !series.mean.length) return [];
  const timestamps = block.timestamps;
  const unit = series.unit || "";
  const range = context && context.range;
  const extremes = param.dailyExtremes ? dailyGroupedExtremes(param) : null;
  const visible = [];
  timestamps.forEach((timestamp, index) => {
    if (inVisibleRange(timestamp, range)) visible.push(index);
  });
  if (!visible.length) return [];
  const highlights = [];
  const pick = (values, findMax) => {
    let best = null;
    visible.forEach((index) => {
      const value = values[index];
      if (value === null || value === undefined || !isFinite(value)) return;
      if (!best || (findMax ? value > best.value : value < best.value)) {
        best = { index, value };
      }
    });
    return best;
  };
  if (config.max) {
    const values = (extremes && extremes.max) || series.mean;
    const best = pick(values, true);
    if (best && Math.round(best.value * 10) !== 0) {
      const timestamp = timestamps[best.index];
      highlights.push({
        day: timestamp.slice(0, 10),
        x: dailyPlotTimestamp(timestamp),
        value: best.value,
        text: formatValue(best.value, unit),
        direction: "up",
        color: extremes ? TEMP_MAX_COLOR : undefined,
      });
    }
  }
  if (config.min) {
    const values = (extremes && extremes.min) || series.mean;
    const best = pick(values, false);
    if (best) {
      const timestamp = timestamps[best.index];
      highlights.push({
        day: timestamp.slice(0, 10),
        x: dailyPlotTimestamp(timestamp),
        value: best.value,
        text: formatValue(best.value, unit),
        direction: "down",
        color: extremes ? TEMP_MIN_COLOR : undefined,
      });
    }
  }
  if (config.sum) {
    let total = 0;
    let count = 0;
    visible.forEach((index) => {
      const value = series.mean[index];
      if (value === null || value === undefined || !isFinite(value)) return;
      total += value;
      count += 1;
    });
    if (count) {
      const timestamp = timestamps[visible[Math.floor(visible.length / 2)]];
      highlights.push({
        day: timestamp.slice(0, 10),
        x: dailyPlotTimestamp(timestamp),
        value: total,
        text: t("chart.sumPrefix", { value: formatValue(total, unit) }),
        direction: "pin",
        pinToTop: !!config.pinSum,
        sumRange: true,
      });
    }
  }
  return highlights;
}

function computeYRange(
  param,
  series,
  points,
  topFactor = 0.22,
  extraMax = null,
  cap = null,
  extraExtent = null,
  bottomFactor = 0.1
) {
  const extent = seriesExtent(series, cap) || [0, 0];
  let min = extent[0];
  let max = extent[1];
  if (extraExtent) {
    if (extraExtent[0] !== null && extraExtent[0] !== undefined) {
      min = Math.min(min, extraExtent[0]);
    }
    if (extraExtent[1] !== null && extraExtent[1] !== undefined) {
      max = Math.max(max, extraExtent[1]);
    }
  }
  if (extraMax !== null && extraMax !== undefined) max = Math.max(max, extraMax);
  points.forEach((point) => {
    if (point.value === null || point.value === undefined) return;
    max = Math.max(max, point.value);
    if (!param.zero) min = Math.min(min, point.value);
  });
  const span = max - min || Math.abs(max) || 1;
  const top = max + span * topFactor;
  if (param.zero) return [0, top];
  return [min - span * bottomFactor, top];
}

function chartXContext(range, timestamps) {
  let xMin = null;
  let xMax = null;
  if (range && range[0] !== undefined && range[1] !== undefined) {
    xMin = timeValue(range[0]);
    xMax = timeValue(range[1]);
  }
  if ((!isFinite(xMin) || !isFinite(xMax)) && timestamps && timestamps.length) {
    xMin = timeValue(timestamps[0]);
    xMax = timeValue(timestamps[timestamps.length - 1]);
  }
  if (!isFinite(xMin) || !isFinite(xMax) || xMax <= xMin) {
    return { xMin: null, xMax: null };
  }
  return { xMin, xMax };
}

function arrowOffset(x, ctx, baseAy) {
  if (!ctx || ctx.xMin === null || ctx.xMax === null) return { ax: 0, ay: baseAy };
  const position = (timeValue(x) - ctx.xMin) / (ctx.xMax - ctx.xMin);
  if (!isFinite(position)) return { ax: 0, ay: baseAy };
  const centered = clamp(position - 0.5, -0.5, 0.5);
  const maxAx = Math.abs(baseAy);
  return { ax: -(centered / 0.5) * maxAx, ay: baseAy };
}

function resolveArrow(config, x, ctx, baseAy) {
  if (config && config.dynamicArrow) return arrowOffset(x, ctx, baseAy);
  return { ax: 0, ay: baseAy };
}

function valueAnnotations(param, points, ctx, config, yref = "y") {
  const active = config || {};
  return points.map((point) => {
    const direction = point.direction || (active.type === "sum" ? "pin" : "up");
    const pinned = direction === "pin";
    const pinToTop =
      pinned && !!(point.pinToTop !== undefined ? point.pinToTop : active.pinToTop);
    const baseAy = direction === "down" ? 28 : -28;
    const color = point.color || param.color;
    const arrow = pinned ? { ax: 0, ay: 0 } : resolveArrow(active, point.x, ctx, baseAy);
    const annotation = {
      x: point.x,
      y: pinToTop ? 0.97 : point.value,
      text: point.text,
      xanchor: "center",
      showarrow: !pinned,
      arrowhead: 0,
      arrowwidth: 1,
      arrowcolor: hexToRgba(color, 0.75),
      ...arrow,
      standoff: 6,
      bgcolor: "rgba(34, 46, 64, 1)",
      bordercolor: hexToRgba(color, 0.8),
      borderwidth: 1,
      borderpad: 3,
      font: { size: 10, color },
    };
    if (pinned) {
      if (pinToTop) {
        annotation.yref = "paper";
        annotation.yanchor = "top";
      } else {
        annotation.yref = yref;
        annotation.yanchor = "middle";
      }
    } else {
      annotation.yref = yref;
    }
    if (point.sumRange) {
      annotation.hovertext = t("chart.sumRangeNote");
      annotation.captureevents = true;
    }
    return annotation;
  });
}

function paintAnnotationsUnderBoxes(plot) {
  plot.querySelectorAll("g.annotation").forEach((group) => {
    const arrow = group.querySelector(".annotation-arrow-g");
    const text = group.querySelector(".annotation-text-g");
    if (arrow && text && arrow.previousElementSibling === text) {
      group.insertBefore(arrow, text);
    }
  });
}

function annotationContext(entry, range) {
  return entry.mode === "daily"
    ? { mode: entry.mode, range }
    : { mode: entry.mode, bound: entry.bound, endBound: entry.endBound };
}

function annotationOverlayConfig(overlay, mode) {
  return mode === "daily" ? overlay.dailyAnnotations : overlay.annotations;
}

function buildAnnotationSet(param, config, context, ctx, yref) {
  if (!config) return { points: [], annotations: [] };
  const points = computeAnnotationPoints(param, config, context);
  const annotations = points.length
    ? valueAnnotations(param, points, ctx, config, yref)
    : [];
  return { points, annotations };
}

function rebuildAnnotations(entry, range) {
  const ctx = chartXContext(range, entry.timestamps);
  const context = annotationContext(entry, range);
  const annotations = [];
  if (entry.param.bands && entry.yRange) {
    annotations.push(...bandAnnotations(entry.param.bands, entry.yRange));
  }
  const primary = buildAnnotationSet(entry.param, entry.config, context, ctx, "y");
  entry.points = primary.points;
  annotations.push(...primary.annotations);
  (entry.annotationOverlays || []).forEach((overlayEntry) => {
    const set = buildAnnotationSet(
      overlayEntry.overlay,
      overlayEntry.config,
      context,
      ctx,
      overlayEntry.yref
    );
    overlayEntry.points = set.points;
    annotations.push(...set.annotations);
  });
  return annotations;
}

function buildTraces(x, series, color, cap = null, options = {}) {
  const yaxis = options.yaxis || "y";
  const name = options.nameKey ? t(options.nameKey) : t("chart.legendMean");
  const hoverTemplate = options.hoverTemplate || t("chart.hoverMeanTemplate");
  const bandName = options.bandKey ? t(options.bandKey) : t("chart.legendStd");
  const capAt = (index) =>
    cap && cap[index] !== null && cap[index] !== undefined ? cap[index] : null;
  const lower = series.mean.map((value, index) => {
    if (value === null || series.std[index] === null) return null;
    const raw = value - series.std[index];
    const bound = capAt(index);
    return bound === null ? raw : clamp(raw, 0, bound);
  });
  const upper = series.mean.map((value, index) => {
    if (value === null || series.std[index] === null) return null;
    const raw = value + series.std[index];
    const bound = capAt(index);
    return bound === null ? raw : clamp(raw, 0, bound);
  });
  const unit = series.unit || "";
  const counts = series.model_count || [];
  const customdata = series.mean.map((value, index) => [
    value === null || value === undefined ? "–" : formatValue(value, unit),
    counts[index] || 0,
    hoverXLabel(x[index]),
  ]);
  return [
    {
      x,
      y: lower,
      type: "scatter",
      mode: "lines",
      line: { width: 0 },
      hoverinfo: "skip",
      showlegend: false,
      yaxis,
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
      name: bandName,
      yaxis,
    },
    {
      x,
      y: series.mean,
      customdata,
      type: "scatter",
      mode: options.markers ? "lines+markers" : "lines",
      line: { color, width: 2.5 },
      ...(options.markers
        ? { marker: { size: 6, color, line: { width: 0 } } }
        : {}),
      name,
      yaxis,
      hovertemplate: hoverTemplate,
    },
  ];
}

function overlayBars(x, series, overlay) {
  const unit = series.unit || "";
  const counts = series.model_count || [];
  const std = series.std || [];
  const customdata = series.mean.map((value, index) => [
    value === null || value === undefined ? "–" : formatValue(value, unit),
    counts[index] || 0,
    hoverXLabel(x[index]),
  ]);
  const errorPlus = series.mean.map((value, index) => {
    if (value === null || value === undefined) return null;
    const spread = std[index];
    return spread === null || spread === undefined ? null : spread;
  });
  const errorMinus = series.mean.map((value, index) => {
    if (value === null || value === undefined) return null;
    const spread = std[index];
    if (spread === null || spread === undefined) return null;
    return Math.min(spread, value);
  });
  return {
    x,
    y: series.mean,
    customdata,
    type: "bar",
    yaxis: "y2",
    marker: { color: overlay.color },
    error_y: {
      type: "data",
      symmetric: false,
      array: errorPlus,
      arrayminus: errorMinus,
      color: "#166534",
      thickness: 1.2,
      width: 4,
    },
    name: t(overlay.labelKey),
    hovertemplate: t("chart.hoverOverlayTemplate", { label: t(overlay.labelKey) }),
  };
}

function overlayTrace(x, series, overlay) {
  const unit = series.unit || "";
  const counts = series.model_count || [];
  const customdata = series.mean.map((value, index) => [
    value === null || value === undefined ? "–" : formatValue(value, unit),
    counts[index] || 0,
    hoverXLabel(x[index]),
  ]);
  return {
    x,
    y: series.mean,
    customdata,
    type: "scatter",
    mode: "lines",
    line: { color: overlay.color, width: 2, dash: "dash" },
    name: t(overlay.labelKey),
    yaxis: overlay.secondary ? "y2" : "y",
    hovertemplate: t("chart.hoverOverlayTemplate", { label: t(overlay.labelKey) }),
  };
}

const SUN_CEILING_COLOR = "#9ca3af";

function sunLineSeries(mode) {
  const sun = state.data && state.data.sun;
  const series = sun && (mode === "hourly" ? sun.ceiling : sun.daily);
  if (!series || !series.mean) return null;
  if (!series.mean.some((value) => value !== null && value !== undefined)) return null;
  return series;
}

function sunCapSeries(mode) {
  const sun = state.data && state.data.sun;
  const series = sun && (mode === "hourly" ? sun.hourly : sun.daily);
  if (!series || !series.mean) return null;
  return series;
}

function ceilingTrace(x, series, label) {
  const unit = series.unit || "";
  const customdata = series.mean.map((value, index) => [
    value === null || value === undefined ? "–" : formatValue(value, unit),
    hoverXLabel(x[index]),
  ]);
  return {
    x,
    y: series.mean,
    customdata,
    type: "scatter",
    mode: "lines",
    line: { color: SUN_CEILING_COLOR, width: 1.2 },
    name: label,
    hovertemplate: t("chart.hoverCeilingTemplate", { label }),
  };
}

function toCardinal(degrees) {
  if (degrees === null || degrees === undefined) return "–";
  const normalized = ((degrees % 360) + 360) % 360;
  const cardinals = I18n.cardinals();
  return cardinals[Math.round(normalized / 22.5) % 16];
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
      formatValue(value, "°"),
      toCardinal(value),
      spread === null || spread === undefined ? "–" : formatValue(spread, "°"),
      counts[index] || 0,
      hoverXLabel(x[index]),
    ]);
  }
  return {
    x: arrowX,
    y: arrowX.map(() => 0.5),
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
    name: t("chart.legendDirection"),
    hovertemplate: t("chart.hoverDirectionTemplate"),
  };
}

function nextDayString(day) {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + 1));
  return next.toISOString().slice(0, 10);
}

function dayShapes(timestamps) {
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
        : `${nextDayString(entry.day)}T00:00`;
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

function directionShapes() {
  const rect = {
    type: "rect",
    xref: "paper",
    yref: "y2",
    x0: 0,
    x1: 1,
    y0: 0,
    y1: 1,
    line: { width: 0 },
    layer: "below",
  };
  return [
    { ...rect, fillcolor: "#1e293b" },
    { ...rect, fillcolor: "rgba(148, 163, 184, 0.18)" },
    {
      type: "line",
      xref: "paper",
      yref: "y2",
      x0: 0,
      x1: 1,
      y0: 0,
      y1: 0,
      line: { color: "rgba(148, 163, 184, 0.4)", width: 1 },
      layer: "below",
    },
  ];
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

function inVisibleRange(timestamp, range) {
  if (!range) return true;
  const value = wallClockMs(timestamp);
  const start = wallClockMs(range[0]);
  const end = wallClockMs(range[1]);
  if (!isFinite(value) || !isFinite(start) || !isFinite(end)) return true;
  return value >= start && value <= end;
}

function visibleAverage(series, timestamps, range) {
  const values = [];
  timestamps.forEach((timestamp, index) => {
    if (!inVisibleRange(timestamp, range)) return;
    const value = series.mean[index];
    if (value === null || value === undefined || !isFinite(value)) return;
    values.push(value);
  });
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function collectSmalltalkMetrics() {
  if (!state.data) return [];
  const block = state.data[state.mode];
  if (!block) return [];
  const metrics = [];
  CHARTS.forEach((chart) => {
    const entry = state.plots[chart.key];
    const series = block.parameters[chart.key];
    if (!entry || !series || !series.models_used.length) return;
    const average = visibleAverage(series, block.timestamps, entry.range);
    if (average !== null) {
      metrics.push({
        label: t("smalltalk.avgLabel", { label: t(chart.labelKey) }),
        value: formatValue(average, series.unit),
        kind: "average",
      });
    }
    (chart.overlays || []).forEach((overlay) => {
      const overlaySeries = block.parameters[overlay.key];
      if (!overlaySeries || !overlaySeries.models_used.length) return;
      const overlayAverage = visibleAverage(overlaySeries, block.timestamps, entry.range);
      if (overlayAverage === null) return;
      metrics.push({
        label: t("smalltalk.avgLabel", { label: t(overlay.labelKey) }),
        value: formatValue(overlayAverage, overlaySeries.unit),
        kind: "average",
      });
    });
    (entry.points || []).forEach((point) => {
      metrics.push({
        label: `${t(chart.labelKey)} (${weekdayName(point.day)})`,
        value: point.text,
        kind: "highlight",
      });
    });
    (entry.annotationOverlays || []).forEach((overlayEntry) => {
      (overlayEntry.points || []).forEach((point) => {
        metrics.push({
          label: `${t(overlayEntry.overlay.labelKey)} (${weekdayName(point.day)})`,
          value: point.text,
          kind: "highlight",
        });
      });
    });
  });
  return metrics;
}

const SMALLTALK_ALERT_LIMIT = 5;

function collectSmalltalkAlerts() {
  const alerts = (state.data && state.data.alerts) || [];
  return alerts.slice(0, SMALLTALK_ALERT_LIMIT).map((alert) => ({
    severity: t(`alerts.${alert.severity}`),
    event: alert.event || null,
    headline: alert.headline || null,
    area: alert.area || null,
    onset: alert.onset || null,
    expires: alert.expires || null,
  }));
}

function openSmalltalkModal() {
  smalltalkModal.hidden = false;
}

function closeSmalltalkModal() {
  smalltalkModal.hidden = true;
}

async function requestSmalltalk() {
  if (!state.data || !state.selected || smalltalkBtn.disabled) return;
  const metrics = collectSmalltalkMetrics();
  if (!metrics.length) {
    setStatus(t("status.noData"), true);
    return;
  }
  const location = state.selected;
  smalltalkText.textContent = t("toolbar.smalltalkLoading");
  smalltalkText.classList.add("loading");
  openSmalltalkModal();
  smalltalkBtn.disabled = true;
  smalltalkAgain.disabled = true;
  try {
    const response = await fetch("/api/smalltalk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: I18n.getLang(),
        location: location.name,
        admin1: location.admin1 || null,
        country: location.country || null,
        mode: state.mode,
        metrics,
        alerts: collectSmalltalkAlerts(),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      const detail =
        typeof payload.detail === "string" ? payload.detail : payload.detail?.message;
      throw new Error(detail || `HTTP ${response.status}`);
    }
    smalltalkText.classList.remove("loading");
    smalltalkText.textContent = payload.text;
  } catch (error) {
    closeSmalltalkModal();
    setStatus(t("smalltalk.error", { message: error.message }), true);
  } finally {
    smalltalkBtn.disabled = false;
    smalltalkAgain.disabled = false;
  }
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
  title.textContent = t(param.titleKey || param.labelKey);
  head.appendChild(title);
  if (param.infoKey) {
    const info = document.createElement("span");
    info.className = "info";
    info.textContent = "i";
    info.setAttribute("role", "button");
    info.setAttribute("tabindex", "0");
    const infoText = chartInfoText(param, series);
    info.setAttribute("aria-label", infoText.replace(/\n+/g, " "));
    const popup = document.createElement("div");
    popup.className = "info-popup";
    popup.textContent = infoText;
    popup.hidden = true;
    popup.setAttribute("role", "tooltip");
    const show = () => {
      popup.hidden = false;
    };
    const hide = () => {
      if (popup.dataset.pinned !== "1") popup.hidden = true;
    };
    info.addEventListener("mouseenter", show);
    info.addEventListener("mouseleave", hide);
    info.addEventListener("focus", show);
    info.addEventListener("blur", hide);
    info.addEventListener("click", (event) => {
      event.stopPropagation();
      const pinned = popup.dataset.pinned === "1";
      popup.dataset.pinned = pinned ? "0" : "1";
      popup.hidden = pinned;
    });
    head.append(info, popup);
  }
  const applyZoom = document.createElement("button");
  applyZoom.className = "apply-zoom";
  applyZoom.textContent = t("chart.applyZoom");
  applyZoom.title = t("chart.applyZoomTitle");
  applyZoom.addEventListener("click", () => applyRangeToAll(param.key));
  head.appendChild(applyZoom);
  card.appendChild(head);

  const badges = document.createElement("div");
  badges.className = "badges";
  if (series.resolution !== state.mode) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = t("badge.dailyOnly");
    badges.appendChild(badge);
  }
  if (badges.children.length) {
    card.appendChild(badges);
  }

  const plot = document.createElement("div");
  card.appendChild(plot);

  const timestamps = block.timestamps;
  const bound = startBound();
  let xRange;
  let dailyEnd = null;
  if (timestamps.length) {
    const start = bound && bound > timestamps[0] ? bound : timestamps[0];
    let end;
    if (state.mode === "hourly") {
      end = hourlyWindowEnd(bound, timestamps);
    } else {
      dailyEnd = nextDayString(timestamps[timestamps.length - 1].slice(0, 10));
      end = dailyEnd;
    }
    xRange = [start, end];
  }

  const xTimestamps = state.mode === "daily" ? timestamps.map(dailyPlotTimestamp) : timestamps;
  const activeConfig = state.mode === "daily" ? param.dailyAnnotations : param.annotations;
  const dailyExtremes =
    state.mode === "daily" && param.dailyExtremes ? dailyGroupedExtremes(param) : null;

  const capSeries = param.sunCeiling ? sunCapSeries(state.mode) : null;
  const primaryHover = param.meanLabelKey
    ? t("chart.hoverOverlayTemplate", { label: t(param.meanLabelKey) })
    : null;
  const traces = dailyExtremes
    ? dailyExtremesTraces(xTimestamps, dailyExtremes, series.unit)
    : buildTraces(xTimestamps, series, param.color, capSeries ? capSeries.mean : null, {
        yaxis: "y",
        nameKey: param.meanLabelKey,
        hoverTemplate: primaryHover,
        markers: state.mode === "daily",
      });
  const ceiling = param.sunCeiling ? sunLineSeries(state.mode) : null;
  if (ceiling) {
    const rawCeilingX = ceiling.timestamps || timestamps;
    const ceilingX = state.mode === "daily" ? rawCeilingX.map(dailyPlotTimestamp) : rawCeilingX;
    traces.splice(2, 0, ceilingTrace(ceilingX, ceiling, t("chart.sunshine.max")));
  }
  let secondaryOverlay = null;
  const annotationOverlays = [];
  (param.overlays || []).forEach((overlay) => {
    const overlaySeries = block.parameters[overlay.key];
    if (!overlaySeries || overlaySeries.models_used.length === 0) return;
    if (overlay.bars) {
      traces.unshift(overlayBars(xTimestamps, overlaySeries, overlay));
    } else {
      traces.push(overlayTrace(xTimestamps, overlaySeries, overlay));
    }
    if (overlay.secondary) secondaryOverlay = { overlay, series: overlaySeries };
    const config = annotationOverlayConfig(overlay, state.mode);
    if (config) {
      annotationOverlays.push({
        overlay,
        config,
        yref: overlay.secondary ? "y2" : "y",
        points: [],
        annotations: [],
      });
    }
  });

  let hasDirection = false;
  if (param.direction) {
    const directionSeries = block.parameters[param.direction.key];
    if (directionSeries && directionSeries.models_used.length > 0) {
      const arrowStep = state.mode === "hourly" ? 3 : 1;
      traces.push(directionTrace(xTimestamps, directionSeries, param.color, arrowStep));
      hasDirection = true;
    }
  }

  const xCtx = chartXContext(xRange, xTimestamps);
  const context = {
    mode: state.mode,
    bound,
    endBound: xRange && xRange[1],
    range: xRange,
  };
  const primarySet = buildAnnotationSet(param, activeConfig, context, xCtx, "y");
  const points = primarySet.points;
  annotationOverlays.forEach((overlayEntry) => {
    const set = buildAnnotationSet(
      overlayEntry.overlay,
      overlayEntry.config,
      context,
      xCtx,
      overlayEntry.yref
    );
    overlayEntry.points = set.points;
    overlayEntry.annotations = set.annotations;
  });

  const pointDirection = (point, config) =>
    point.direction || (config && config.type === "sum" ? "pin" : "up");
  const pinnedToTop = (point, config) => {
    if (pointDirection(point, config) !== "pin") return false;
    return !!(point.pinToTop !== undefined ? point.pinToTop : config && config.pinToTop);
  };
  const rangePoints = points.filter((point) => !pinnedToTop(point, activeConfig));
  const hasMinPoint = rangePoints.some((point) => point.direction === "down");
  const primaryPinnedTop =
    points.some((point) => pinnedToTop(point, activeConfig)) ||
    !!(activeConfig && activeConfig.pinToTop);
  const overlayPinnedTop = annotationOverlays.some((overlayEntry) =>
    overlayEntry.points.some((point) => pinnedToTop(point, overlayEntry.config))
  );
  const extraExtent = (() => {
    if (!dailyExtremes) return null;
    const shifted = (values, stds, sign) =>
      values.map((value, index) => {
        const std = stds[index];
        if (value === null || value === undefined || !isFinite(value)) return null;
        if (std === null || std === undefined || !isFinite(std)) return value;
        return value + sign * std;
      });
    const values = [
      ...dailyExtremes.max,
      ...dailyExtremes.min,
      ...shifted(dailyExtremes.max, dailyExtremes.maxStd, 1),
      ...shifted(dailyExtremes.min, dailyExtremes.minStd, -1),
    ].filter((value) => value !== null && value !== undefined && isFinite(value));
    if (!values.length) return null;
    return [Math.min(...values), Math.max(...values)];
  })();
  let yRange = null;
  if (param.bands) {
    const extent = seriesExtent(series);
    if (extent) {
      const pad = Math.max(2, (extent[1] - extent[0]) * 0.12);
      yRange = [extent[0] - pad, extent[1] + pad];
    }
  }
  if (primaryPinnedTop) {
    const ceilingExtent = ceiling ? seriesExtent(ceiling) : null;
    yRange = computeYRange(
      param,
      series,
      rangePoints,
      0.3,
      ceilingExtent ? ceilingExtent[1] : null,
      capSeries ? capSeries.mean : null,
      extraExtent,
      hasMinPoint ? 0.22 : 0.1
    );
  } else if (rangePoints.length || extraExtent) {
    yRange = computeYRange(
      param,
      series,
      rangePoints,
      0.22,
      null,
      null,
      extraExtent,
      hasMinPoint ? 0.22 : 0.1
    );
  }

  let y2Range = null;
  if (secondaryOverlay && secondaryOverlay.overlay.axisMax === undefined) {
    const overlayEntry = annotationOverlays.find(
      (item) => item.overlay === secondaryOverlay.overlay
    );
    const overlayRangePoints = overlayEntry
      ? overlayEntry.points.filter((point) => !pinnedToTop(point, overlayEntry.config))
      : [];
    y2Range = computeYRange(
      { zero: true },
      secondaryOverlay.series,
      overlayRangePoints
    );
  }

  const shapes = state.mode === "hourly" ? dayShapes(timestamps) : [];
  if (param.bands) {
    shapes.push(...bandShapes(param.bands));
  }
  if (hasDirection) {
    shapes.push(...directionShapes());
  }

  const layout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#cbd5e1" },
    margin: { l: 54, r: secondaryOverlay !== null || hasDirection ? 48 : 18, t: 42, b: 46 },
    height: 320,
    showlegend: true,
    legend: { orientation: "h", x: 0.5, xanchor: "center", y: 1.0, yanchor: "bottom" },
    xaxis: {
      gridcolor: "#334155",
      type: "date",
      automargin: true,
      tickangle: state.mode === "hourly" ? -45 : 0,
      minallowed: bound || undefined,
      maxallowed: timestamps.length
        ? dailyEnd || timestamps[timestamps.length - 1]
        : undefined,
    },
    yaxis: {
      gridcolor: "#334155",
      title: { text: series.unit || "" },
      rangemode: param.zero ? "tozero" : "normal",
    },
    shapes,
  };
  if (state.mode === "hourly" && xRange) {
    const { tickvals, ticktext } = hourlyTicks(xRange[0], xRange[1]);
    if (tickvals.length) {
      layout.xaxis.tickmode = "array";
      layout.xaxis.tickvals = tickvals;
      layout.xaxis.ticktext = ticktext;
    }
  } else if (state.mode === "daily") {
    layout.xaxis.tickmode = "array";
    layout.xaxis.tickvals = xTimestamps;
    layout.xaxis.ticktext = timestamps.map(weekdayName);
  } else {
    layout.xaxis.nticks = 7;
    layout.xaxis.tickformat = I18n.tickFormat("hourly");
  }
  if (hasDirection) {
    layout.yaxis.domain = [0, 0.86];
  } else if (param.reserveTop && (primaryPinnedTop || overlayPinnedTop)) {
    layout.yaxis.domain = [0, 0.82];
  }
  if (yRange) {
    layout.yaxis.range = yRange;
  }
  const annotations = [];
  if (param.bands && yRange) {
    annotations.push(...bandAnnotations(param.bands, yRange));
  }
  annotations.push(...primarySet.annotations);
  annotationOverlays.forEach((overlayEntry) => {
    annotations.push(...overlayEntry.annotations);
  });
  if (annotations.length) {
    layout.annotations = annotations;
  }
  if (xRange) {
    layout.xaxis.range = xRange;
  }
  if (secondaryOverlay !== null) {
    layout.yaxis2 = {
      overlaying: "y",
      side: "right",
      showgrid: false,
      rangemode: "tozero",
      color: secondaryOverlay.overlay.color,
      title: { text: secondaryOverlay.series.unit || "" },
    };
    const axisMax = secondaryOverlay.overlay.axisMax;
    if (axisMax !== undefined) {
      layout.yaxis2.range = [0, axisMax];
    } else if (y2Range) {
      layout.yaxis2.range = y2Range;
    }
  } else if (hasDirection) {
    layout.yaxis2 = {
      anchor: "x",
      domain: [0.88, 1],
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
    locale: I18n.getLang(),
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  }).then(() => {
    const autoRange =
      plot._fullLayout && plot._fullLayout.xaxis && plot._fullLayout.xaxis.range;
    const defaultRange = xRange
      ? [xRange[0], xRange[1]]
      : autoRange
      ? [autoRange[0], autoRange[1]]
      : null;
    state.plots[param.key] = {
      el: plot,
      range: defaultRange,
      defaultRange,
      param,
      config: activeConfig,
      mode: state.mode,
      bound,
      endBound: xRange && xRange[1],
      points,
      annotationOverlays,
      yRange,
      timestamps,
    };
    plot.on("plotly_relayout", (eventData) => {
      const entry = state.plots[param.key];
      const range = extractXRange(eventData, plot);
      if (range) {
        entry.range = range;
      } else if (eventData["xaxis.autorange"]) {
        entry.range = entry.defaultRange;
      }
      const zoomed =
        "xaxis.range[0]" in eventData ||
        Array.isArray(eventData["xaxis.range"]) ||
        !!eventData["xaxis.autorange"];
      if (!zoomed) return;
      const target = eventData["xaxis.autorange"] ? entry.defaultRange : entry.range;
      if (!target) return;
      const update = {};
      if (state.mode === "hourly") {
        Object.assign(update, hourlyTickLayout(target));
      }
      if (activeConfig || entry.annotationOverlays.length) {
        update.annotations = rebuildAnnotations(entry, target);
      }
      if (Object.keys(update).length) {
        Plotly.relayout(plot, update);
      }
    });
    paintAnnotationsUnderBoxes(plot);
    plot.on("plotly_afterplot", () => paintAnnotationsUnderBoxes(plot));
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
    empty.textContent = t("status.noData");
    chartsEl.appendChild(empty);
  } else {
    rendered.forEach((card) => chartsEl.appendChild(card));
  }
}

function renderModelsPanel() {
  const { models_requested } = state.data;
  const [prefix, suffix] = t("models.summary", {
    count: models_requested.length,
  }).split("{{models}}");
  modelsSummary.innerHTML = "";
  modelsSummary.appendChild(document.createTextNode(prefix || ""));
  models_requested.forEach((model, index) => {
    if (index) modelsSummary.appendChild(document.createTextNode(", "));
    modelsSummary.appendChild(modelLink(model));
  });
  modelsSummary.appendChild(document.createTextNode(suffix || ""));

  modelsList.innerHTML = "";
  const block = state.data[state.mode];
  PANEL_PARAMS.forEach((param) => {
    const series = block.parameters[param.key];
    if (!series) return;
    const row = document.createElement("div");
    row.className = "model-row";

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = param.noteKey
      ? `${t(param.labelKey)} (${t(param.noteKey, { chart: t(param.chartLabelKey) })})`
      : t(param.labelKey);

    const models = document.createElement("span");
    models.className = "models";

    const used = document.createElement("span");
    used.textContent = series.models_used.length
      ? t("models.used", {
          used: series.models_used.length,
          total: models_requested.length,
          models: series.models_used.map(displayName).join(", "),
        })
      : t("models.none", { total: models_requested.length });
    models.appendChild(used);

    const missing = models_requested.filter((model) => !series.models_used.includes(model));
    if (missing.length) {
      const missingEl = document.createElement("span");
      missingEl.className = "missing";
      missingEl.textContent = t("models.missing", {
        models: missing.map(displayName).join(", "),
      });
      models.appendChild(missingEl);
    }

    const counts = series.model_count || [];
    if (counts.length && Math.min(...counts) < Math.max(...counts)) {
      const coverage = document.createElement("span");
      coverage.className = "coverage";
      coverage.textContent = t("models.coverage", {
        min: Math.min(...counts),
        max: Math.max(...counts),
      });
      models.appendChild(coverage);
    }

    row.append(name, models);
    modelsList.appendChild(row);
  });
  modelsPanel.hidden = false;
}

const ALERT_SEVERITY_KEYS = ["minor", "moderate", "severe", "extreme"];

function alertSeverityKey(alert) {
  const level = Math.min(Math.max(alert.severity_level || 1, 1), 4);
  return ALERT_SEVERITY_KEYS[level - 1];
}

function alertSourceLabel(source) {
  const key = `alerts.source.${source}`;
  const label = t(key);
  return label === key ? source : label;
}

function formatAlertTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toLocaleString(locale());
}

function alertValidity(alert) {
  const from = formatAlertTime(alert.onset);
  const to = formatAlertTime(alert.expires);
  if (from && to) return t("alerts.fromTo", { from, to });
  if (to) return t("alerts.until", { datetime: to });
  if (from) return t("alerts.from", { datetime: from });
  return "";
}

function renderAlertCard(alert) {
  const level = Math.min(Math.max(alert.severity_level || 1, 1), 4);
  const card = document.createElement("div");
  card.className = `alert-card level-${level}`;

  const head = document.createElement("div");
  head.className = "alert-head";

  const badge = document.createElement("span");
  badge.className = "alert-sev";
  badge.textContent = t(`alerts.${alertSeverityKey(alert)}`);

  const main = document.createElement("div");
  main.className = "alert-main";

  const headline = document.createElement("div");
  headline.className = "alert-headline";
  headline.textContent = alert.headline || alert.event || "";
  main.appendChild(headline);

  const metaParts = [];
  if (alert.event && alert.event !== headline.textContent) metaParts.push(alert.event);
  if (alert.area) metaParts.push(alert.area);
  metaParts.push(alertSourceLabel(alert.source));
  const meta = document.createElement("div");
  meta.className = "alert-meta";
  meta.textContent = metaParts.join(" · ");
  main.appendChild(meta);

  const validity = alertValidity(alert);
  if (validity) {
    const valid = document.createElement("div");
    valid.className = "alert-meta";
    valid.textContent = validity;
    main.appendChild(valid);
  }

  if (alert.description || alert.instruction) {
    const body = document.createElement("div");
    body.className = "alert-body";
    body.hidden = true;
    if (alert.description) {
      const description = document.createElement("div");
      description.textContent = alert.description;
      body.appendChild(description);
    }
    if (alert.instruction) {
      const instruction = document.createElement("div");
      instruction.className = "alert-instruction";
      instruction.textContent = alert.instruction;
      body.appendChild(instruction);
    }
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "alert-toggle";
    toggle.textContent = t("alerts.more");
    toggle.addEventListener("click", () => {
      body.hidden = !body.hidden;
      toggle.textContent = body.hidden ? t("alerts.more") : t("alerts.less");
    });
    main.appendChild(toggle);
    main.appendChild(body);
  }

  head.append(badge, main);
  card.appendChild(head);

  if (alert.url) {
    const link = document.createElement("a");
    link.href = alert.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "alert-toggle";
    link.textContent = t("alerts.details");
    main.appendChild(link);
  }
  return card;
}

function renderAlerts() {
  const alerts = (state.data && state.data.alerts) || [];
  alertsEl.innerHTML = "";
  alertsEl.hidden = alerts.length === 0;
  if (!alerts.length) return;

  const title = document.createElement("div");
  title.className = "alerts-title";
  title.textContent = t("alerts.title");
  alertsEl.appendChild(title);

  const list = document.createElement("div");
  list.className = "alerts-list";
  alerts.forEach((alert) => list.appendChild(renderAlertCard(alert)));
  alertsEl.appendChild(list);
}

function renderLocationMeta() {
  const { location, models_requested, models_used, generated_at } = state.data;
  const place = [location.name, location.admin1, location.country].filter(Boolean).join(", ");

  locationMeta.innerHTML = "";
  const text = document.createElement("span");
  text.append(
    place,
    " · ",
    t("location.modelsWithData", {
      used: models_used.length,
      total: models_requested.length,
    }),
    " · "
  );
  const updated = document.createElement("span");
  updated.className = "meta-updated";
  updated.textContent = t("location.updated", {
    datetime: new Date(generated_at).toLocaleString(locale()),
  });
  updated.title = t("location.updatedTitle");
  text.appendChild(updated);
  locationMeta.appendChild(text);

  const alreadyFavorite = isFavorite(state.selected);
  const star = document.createElement("button");
  star.type = "button";
  star.className = alreadyFavorite ? "star-btn on" : "star-btn";
  star.textContent = alreadyFavorite ? t("location.starOn") : t("location.starOff");
  star.title = alreadyFavorite ? t("location.starOnTitle") : t("location.starOffTitle");
  star.addEventListener("click", toggleFavorite);
  locationMeta.appendChild(star);
}

function render() {
  renderLocationMeta();
  renderAlerts();
  renderCharts();
  renderModelsPanel();
  renderFavorites();
  resetZoomBtn.hidden = false;
  refreshBtn.hidden = false;
  smalltalkBtn.hidden = false;
  windowHint.textContent = state.mode === "hourly" ? t("window.hint") : "";
  setStatus("");
}

const plotlyLocalePromises = {};

function loadPlotlyLocale(lang) {
  if (lang === "en" || typeof Plotly === "undefined") return Promise.resolve();
  if (plotlyLocalePromises[lang]) return plotlyLocalePromises[lang];
  const promise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://cdn.plot.ly/plotly-locale-${lang}-2.35.2.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  plotlyLocalePromises[lang] = promise;
  return promise;
}

function applyStaticTranslations() {
  document.documentElement.lang = I18n.getLang();
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
}

const languageSelect = document.getElementById("language-select");
I18n.languages.forEach(({ code, name }) => {
  const option = document.createElement("option");
  option.value = code;
  option.textContent = name;
  languageSelect.appendChild(option);
});

async function changeLanguage(lang) {
  if (!I18n.setLang(lang)) return;
  languageSelect.value = I18n.getLang();
  await loadPlotlyLocale(I18n.getLang());
  applyStaticTranslations();
  if (state.data) {
    render();
  } else {
    renderFavorites();
  }
}

languageSelect.addEventListener("change", (event) => changeLanguage(event.target.value));

resetZoomBtn.addEventListener("click", resetZoom);

smalltalkBtn.addEventListener("click", requestSmalltalk);

smalltalkAgain.addEventListener("click", requestSmalltalk);

smalltalkClose.addEventListener("click", closeSmalltalkModal);

smalltalkModal.addEventListener("click", (event) => {
  if (event.target === smalltalkModal) closeSmalltalkModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!smalltalkModal.hidden) closeSmalltalkModal();
  closeInfoPopups();
});

refreshBtn.addEventListener("click", refreshForecast);

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
  if (!event.target.closest(".info") && !event.target.closest(".info-popup")) {
    closeInfoPopups();
  }
});

applyStaticTranslations();
languageSelect.value = I18n.getLang();
loadPlotlyLocale(I18n.getLang());
loadFavorites();
