import { config } from "./config.js";

const DROP_TOKENS = new Set(["preview", "experimental", "exp", "latest", "beta", "alpha", "rc"]);
const PROVIDER_PREFIXES = new Set([
  "anthropic",
  "openai",
  "google",
  "xai",
  "azure_ai",
  "bedrock",
  "vertex_ai",
  "oci",
]);

const state = {
  groups: [],
  providers: [],
  modes: [],
  sortKey: "name",
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
    dom.sota.checked = (config.sota_models ?? []).length > 0;
    const response = await fetch("model_prices_and_context_window.json", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Failed to load model data: ${response.status}`);
    }

    const data = await response.json();
    if (!data || typeof data !== "object") {
      throw new Error("Model data is not a JSON object.");
    }

    if (!data.last_updated) {
      throw new Error("Missing last_updated field in model data.");
    }

    dom.lastUpdated.textContent = formatDate(data.last_updated);

    state.groups = buildGroups(data);
    state.providers = uniqueSorted(state.groups.flatMap((group) => group.providers));
    state.modes = uniqueSorted(state.groups.flatMap((group) => group.modes));

    setSelectOptions(dom.provider, "All providers", state.providers);
    setSelectOptions(dom.mode, "All modes", state.modes);

    render();
  } catch (error) {
    showError(error);
    throw error;
  }
}

function buildGroups(data) {
  const blacklist = new Set(config.model_blacklist ?? []);
  const sotaSet = new Set((config.sota_models ?? []).map((name) => name.toLowerCase()));
  const groups = new Map();

  for (const [name, raw] of Object.entries(data)) {
    if (name === "last_updated") continue;
    if (blacklist.has(name)) continue;
    if (!raw || typeof raw !== "object") {
      throw new Error(`Invalid model entry for ${name}.`);
    }

    const input = raw.input_cost_per_token ? raw.input_cost_per_token * 1_000_000 : null;
    const output = raw.output_cost_per_token ? raw.output_cost_per_token * 1_000_000 : null;
    if (input === null && output === null) continue;

    const provider = raw.litellm_provider ?? "unknown";
    const mode = raw.mode ?? "unknown";
    const normalized = normalizeName(name);

    const variant = {
      name,
      nameLower: name.toLowerCase(),
      provider,
      mode,
      input,
      output,
      supportsVision: Boolean(raw.supports_vision),
    };

    if (!groups.has(normalized)) {
      groups.set(normalized, {
        name: normalized,
        providers: new Set(),
        modes: new Set(),
        variants: [],
        inputValues: [],
        outputValues: [],
        supportsVision: false,
        isSota: sotaSet.has(normalized),
      });
    }

    const group = groups.get(normalized);
    group.providers.add(provider);
    group.modes.add(mode);
    group.variants.push(variant);
    group.supportsVision ||= variant.supportsVision;
    if (input !== null) group.inputValues.push(input);
    if (output !== null) group.outputValues.push(output);
  }

  return Array.from(groups.values()).map((group) => {
    const providers = uniqueSorted([...group.providers]);
    const modes = uniqueSorted([...group.modes]);
    const inputRange = toRange(group.inputValues);
    const outputRange = toRange(group.outputValues);
    return {
      ...group,
      providers,
      modes,
      inputRange,
      outputRange,
      variants: group.variants.sort((a, b) => (a.input ?? 0) - (b.input ?? 0)),
    };
  });
}

function render() {
  state.sortKey = dom.sort.value;

  const filtered = applyFilters(state.groups);
  const sorted = sortGroups(filtered);

  dom.rows.innerHTML = sorted.map(renderRow).join("");
  dom.empty.hidden = sorted.length > 0;

  const variantCount = sorted.reduce((sum, group) => sum + group.variants.length, 0);
  dom.summary.textContent = `Showing ${sorted.length} models (${variantCount} variants)`;
}

function applyFilters(groups) {
  const query = dom.search.value.trim().toLowerCase();
  const provider = dom.provider.value;
  const mode = dom.mode.value;
  const visionOnly = dom.vision.checked;
  const sotaOnly = dom.sota.checked;

  return groups.filter((group) => {
    if (sotaOnly && !group.isSota) return false;
    if (provider && !group.providers.includes(provider)) return false;
    if (mode && !group.modes.includes(mode)) return false;
    if (visionOnly && !group.supportsVision) return false;
    if (!query) return true;

    if (group.name.includes(query)) return true;
    return group.variants.some((variant) => variant.nameLower.includes(query));
  });
}

function sortGroups(groups) {
  const dir = state.sortDir === "asc" ? 1 : -1;
  return [...groups].sort((a, b) => {
    if (state.sortKey === "name") {
      return dir * a.name.localeCompare(b.name);
    }

    if (state.sortKey === "input") {
      return compareNullable(a.inputRange.min, b.inputRange.min, dir);
    }

    if (state.sortKey === "output") {
      return compareNullable(a.outputRange.min, b.outputRange.min, dir);
    }

    return 0;
  });
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

function normalizeName(rawName) {
  let name = rawName.split("/").pop() ?? rawName;
  if (name.includes(".")) {
    const [prefix, rest] = name.split(/\.(.+)/);
    if (PROVIDER_PREFIXES.has(prefix)) {
      name = rest;
    }
  }

  name = name.replace(/:.*$/, "");
  name = name.replace(/-v\d+$/i, "");
  name = name.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  name = name.replace(/-\d{8}$/, "");
  name = name.replace(/-20\d{2}$/, "");

  const parts = name.split(/[-@]/).filter(Boolean);
  while (parts.length > 1) {
    const last = parts[parts.length - 1].toLowerCase();
    if (DROP_TOKENS.has(last)) {
      parts.pop();
      continue;
    }
    break;
  }

  return parts.join("-").toLowerCase();
}

function formatRange(range) {
  if (range.min === null || range.max === null) return "-";
  if (range.min === range.max) return currency.format(range.min);
  return `${currency.format(range.min)} - ${currency.format(range.max)}`;
}

function toRange(values) {
  if (!values.length) return { min: null, max: null };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function compareNullable(a, b, dir) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (a < b) return -dir;
  if (a > b) return dir;
  return 0;
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

function uniqueSorted(values) {
  return [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
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
