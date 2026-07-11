import { applyView, buildCatalog } from "./catalog.js";
import { config } from "./config.js";

const state = {
  groups: [],
  sortDir: "asc",
};

const dom = {
  search: document.getElementById("search"),
  provider: document.getElementById("provider"),
  mode: document.getElementById("mode"),
  vision: document.getElementById("vision"),
  sota: document.getElementById("sota"),
  sort: document.getElementById("sort"),
  sortDir: document.getElementById("sortDir"),
  rows: document.getElementById("rows"),
  summary: document.getElementById("summary"),
  lastUpdated: document.getElementById("last-updated"),
  empty: document.getElementById("empty"),
  error: document.getElementById("error"),
};

const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

init();

function init() {
  bindEvents();
  loadData();
}

function bindEvents() {
  dom.search.addEventListener("input", render);
  dom.provider.addEventListener("change", render);
  dom.mode.addEventListener("change", render);
  dom.vision.addEventListener("change", render);
  dom.sota.addEventListener("change", render);
  dom.sort.addEventListener("change", render);
  dom.sortDir.addEventListener("click", () => {
    state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    dom.sortDir.textContent = state.sortDir === "asc" ? "Asc" : "Desc";
    render();
  });
}

async function loadData() {
  try {
    const response = await fetch("model_prices_and_context_window.json", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Failed to load model data: ${response.status}`);
    }

    const data = await response.json();
    const catalog = buildCatalog(data, config);
    if (!data.last_updated) {
      throw new Error("Missing last_updated field in model data.");
    }

    dom.lastUpdated.textContent = formatDate(data.last_updated);
    state.groups = catalog.groups;
    dom.sota.checked = state.groups.some((group) => group.isSota);

    setSelectOptions(dom.provider, "All providers", catalog.providers);
    setSelectOptions(dom.mode, "All modes", catalog.modes);

    render();
  } catch (error) {
    showError(error);
    throw error;
  }
}

function render() {
  const visible = applyView(state.groups, readCriteria());

  dom.rows.innerHTML = visible.map(renderRow).join("");
  dom.empty.hidden = visible.length > 0;

  const variantCount = visible.reduce((sum, group) => sum + group.variants.length, 0);
  dom.summary.textContent = `Showing ${visible.length} models (${variantCount} variants)`;
}

function readCriteria() {
  return {
    query: dom.search.value,
    provider: dom.provider.value,
    mode: dom.mode.value,
    visionOnly: dom.vision.checked,
    sotaOnly: dom.sota.checked,
    sortKey: dom.sort.value,
    sortDir: state.sortDir,
  };
}

function renderRow(group) {
  const inputLabel = formatRange(group.inputRange);
  const outputLabel = formatRange(group.outputRange);
  const providerLabel = `${group.providers.length} provider${group.providers.length === 1 ? "" : "s"}`;
  const modeLabel = group.modes.join(", ");

  const badges = [
    group.isSota ? '<span class="badge sota">SOTA</span>' : "",
    group.supportsVision ? '<span class="badge">Vision</span>' : "",
  ].join("");

  const providerItems = group.variants
    .map(
      (variant) =>
        `<div><span>${escapeHtml(variant.provider)}</span> ${escapeHtml(variant.name)}</div>`,
    )
    .join("");

  return `
    <tr>
      <td>
        <div class="model-name">${escapeHtml(group.name)} ${badges}</div>
        <div class="model-meta">${group.variants.length} variants</div>
      </td>
      <td>${inputLabel}</td>
      <td>${outputLabel}</td>
      <td>
        <details class="providers">
          <summary>${providerLabel}</summary>
          <div class="provider-list">${providerItems}</div>
        </details>
      </td>
      <td class="col-mode">${escapeHtml(modeLabel)}</td>
    </tr>
  `;
}

function formatRange(range) {
  if (range.min === null || range.max === null) return "-";
  if (range.min === range.max) return currency.format(range.min);
  return `${currency.format(range.min)} - ${currency.format(range.max)}`;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid last_updated date: ${isoString}`);
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function setSelectOptions(select, allLabel, options) {
  select.innerHTML = "";
  select.append(new Option(allLabel, ""));
  options.forEach((option) => select.append(new Option(option, option)));
}

function showError(error) {
  dom.error.hidden = false;
  dom.error.textContent = error instanceof Error ? error.message : String(error);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
