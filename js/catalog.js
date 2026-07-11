const DROP_TOKENS = new Set(["preview", "experimental", "exp", "latest", "beta", "alpha", "rc"]);
const PROVIDER_PREFIXES = new Set([
  "anthropic",
  "openai",
  "google",
  "xai",
  "global",
  "us",
  "eu",
  "au",
  "jp",
  "mistral",
  "azure_ai",
  "bedrock",
  "vertex_ai",
  "oci",
]);
const SORT_KEYS = new Set(["name", "input", "output"]);
const SORT_DIRECTIONS = new Set(["asc", "desc"]);

export function buildCatalog(data, config = {}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Model data is not a JSON object.");
  }

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Catalog config is not an object.");
  }

  const groups = applySotaSelection(buildGroups(data, config), config);
  return {
    groups,
    providers: uniqueSorted(groups.flatMap((group) => group.providers)),
    modes: uniqueSorted(groups.flatMap((group) => group.modes)),
  };
}

export function applyView(groups, criteria = {}) {
  const query = (criteria.query ?? "").trim().toLowerCase();
  const provider = criteria.provider ?? "";
  const mode = criteria.mode ?? "";
  const visionOnly = criteria.visionOnly ?? false;
  const sotaOnly = criteria.sotaOnly ?? false;
  const sortKey = criteria.sortKey ?? "name";
  const sortDir = criteria.sortDir ?? "asc";

  if (!SORT_KEYS.has(sortKey)) {
    throw new Error(`Unsupported sort key: ${sortKey}`);
  }
  if (!SORT_DIRECTIONS.has(sortDir)) {
    throw new Error(`Unsupported sort direction: ${sortDir}`);
  }

  const filtered = groups.filter((group) => {
    if (sotaOnly && !group.isSota) return false;
    if (provider && !group.providers.includes(provider)) return false;
    if (mode && !group.modes.includes(mode)) return false;
    if (visionOnly && !group.supportsVision) return false;
    if (!query) return true;

    if (group.name.includes(query)) return true;
    return group.variants.some((variant) => variant.nameLower.includes(query));
  });

  const direction = sortDir === "asc" ? 1 : -1;
  return filtered.sort((left, right) => {
    if (sortKey === "name") {
      return direction * left.name.localeCompare(right.name);
    }

    if (sortKey === "input") {
      return compareNullable(left.inputRange.min, right.inputRange.min, direction);
    }

    if (sortKey === "output") {
      return compareNullable(left.outputRange.min, right.outputRange.min, direction);
    }

    return 0;
  });
}

function buildGroups(data, config) {
  const blacklist = new Set(config.model_blacklist ?? []);
  const groups = new Map();

  for (const [name, raw] of Object.entries(data)) {
    if (name === "last_updated") continue;
    if (blacklist.has(name)) continue;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
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
        isSota: false,
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

  return Array.from(groups.values()).map((group) => ({
    ...group,
    providers: uniqueSorted([...group.providers]),
    modes: uniqueSorted([...group.modes]),
    inputRange: toRange(group.inputValues),
    outputRange: toRange(group.outputValues),
    variants: group.variants.sort((left, right) => (left.input ?? 0) - (right.input ?? 0)),
  }));
}

function applySotaSelection(groups, config) {
  const sotaSet = buildSotaSet(groups, config);
  return groups.map((group) => ({
    ...group,
    isSota: sotaSet.has(group.name),
  }));
}

function buildSotaSet(groups, config) {
  const names = new Set(
    (config.sota_models ?? [])
      .map((name) => normalizeName(name))
      .filter((name) => name.length > 0),
  );

  for (const rule of config.sota_rules ?? []) {
    const pattern = compileRulePattern(rule);
    const limit = Number.isInteger(rule.limit) && rule.limit > 0 ? rule.limit : 1;
    const matches = groups
      .filter((group) => pattern.test(group.name))
      .sort((left, right) => compareSotaCandidate(right.name, left.name));
    matches.slice(0, limit).forEach((group) => names.add(group.name));
  }

  return names;
}

function compileRulePattern(rule) {
  if (!rule?.pattern) {
    throw new Error("SOTA rule is missing a pattern.");
  }

  try {
    return new RegExp(rule.pattern);
  } catch (error) {
    throw new Error(`Invalid SOTA rule pattern ${rule.pattern}: ${error.message}`);
  }
}

function compareSotaCandidate(left, right) {
  const versionCompare = compareVersionParts(versionParts(left), versionParts(right));
  if (versionCompare !== 0) return versionCompare;
  return left.localeCompare(right);
}

// Version order (CONTEXT.md): dotted tokens are decimal fractions (4.20 = 4.2 < 4.5);
// dash-separated tokens arrive as separate matches and stay integer sequences (4-10 > 4-8).
function versionParts(name) {
  return [...name.matchAll(/p?\d+(?:\.\d+)?/gi)].flatMap((match) => {
    const [whole, fraction] = match[0].toLowerCase().replace(/^p/, "").split(".");
    const parts = [Number.parseInt(whole, 10)];
    if (fraction !== undefined) parts.push(Number.parseFloat(`0.${fraction}`));
    return parts;
  });
}

function compareVersionParts(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index] ?? 0;
    const rightPart = right[index] ?? 0;
    if (leftPart !== rightPart) return leftPart - rightPart;
  }
  return 0;
}

function normalizeName(rawName) {
  let name = rawName.split("/").pop() ?? rawName;
  while (name.includes(".")) {
    const [prefix, rest] = name.split(/\.(.+)/);
    if (!PROVIDER_PREFIXES.has(prefix)) break;
    name = rest;
  }

  name = name.replace(/:.*$/, "");
  name = name.replace(/@.*$/, "");
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

function toRange(values) {
  if (!values.length) return { min: null, max: null };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function compareNullable(left, right, direction) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (left < right) return -direction;
  if (left > right) return direction;
  return 0;
}

function uniqueSorted(values) {
  return [...new Set(values)].filter(Boolean).sort((left, right) => left.localeCompare(right));
}
