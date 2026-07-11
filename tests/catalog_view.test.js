import { describe, expect, test } from "bun:test";

import { applyView, buildCatalog } from "../js/catalog.js";
import { fixtureData } from "./helpers/catalog.js";

const VIEW_VARIANTS = [
  "claude-sonnet-5",
  "gpt-5.4",
  "gpt-5.5",
  "moonshot/kimi-k2.5",
  "twelvelabs.pegasus-1-2-v1:0",
  "mistral/mistral-embed",
];

const { groups } = buildCatalog(fixtureData(VIEW_VARIANTS), {
  sota_models: ["gpt-5.4"],
});

function names(criteria) {
  return applyView(groups, criteria).map((group) => group.name);
}

const ISOLATED_CRITERIA_CASES = [
  {
    name: "query also searches raw variant names",
    criteria: { query: "moonshot/" },
    expected: ["kimi-k2.5"],
  },
  {
    name: "provider",
    criteria: { provider: "mistral" },
    expected: ["mistral-embed"],
  },
  {
    name: "mode",
    criteria: { mode: "embedding" },
    expected: ["mistral-embed"],
  },
  {
    name: "visionOnly",
    criteria: { visionOnly: true },
    expected: ["claude-sonnet-5", "gpt-5.4", "gpt-5.5", "kimi-k2.5"],
  },
  {
    name: "sotaOnly",
    criteria: { sotaOnly: true },
    expected: ["gpt-5.4"],
  },
  {
    name: "sortKey defaults to ascending",
    criteria: { sortKey: "input" },
    expected: [
      "mistral-embed",
      "kimi-k2.5",
      "claude-sonnet-5",
      "gpt-5.4",
      "gpt-5.5",
      "twelvelabs.pegasus-1-2",
    ],
  },
  {
    name: "sortDir applies to the default name sort",
    criteria: { sortDir: "desc" },
    expected: [
      "twelvelabs.pegasus-1-2",
      "mistral-embed",
      "kimi-k2.5",
      "gpt-5.5",
      "gpt-5.4",
      "claude-sonnet-5",
    ],
  },
];

const NULL_SORT_CASES = [
  {
    sortKey: "input",
    sortDir: "asc",
    expected: [
      "mistral-embed",
      "kimi-k2.5",
      "claude-sonnet-5",
      "gpt-5.4",
      "gpt-5.5",
      "twelvelabs.pegasus-1-2",
    ],
  },
  {
    sortKey: "input",
    sortDir: "desc",
    expected: [
      "gpt-5.5",
      "gpt-5.4",
      "claude-sonnet-5",
      "kimi-k2.5",
      "mistral-embed",
      "twelvelabs.pegasus-1-2",
    ],
  },
  {
    sortKey: "output",
    sortDir: "asc",
    expected: [
      "kimi-k2.5",
      "twelvelabs.pegasus-1-2",
      "claude-sonnet-5",
      "gpt-5.4",
      "gpt-5.5",
      "mistral-embed",
    ],
  },
  {
    sortKey: "output",
    sortDir: "desc",
    expected: [
      "gpt-5.5",
      "gpt-5.4",
      "claude-sonnet-5",
      "twelvelabs.pegasus-1-2",
      "kimi-k2.5",
      "mistral-embed",
    ],
  },
];

describe("view criteria", () => {
  for (const viewCase of ISOLATED_CRITERIA_CASES) {
    test(`${viewCase.name} works in isolation`, () => {
      expect(names(viewCase.criteria)).toEqual(viewCase.expected);
    });
  }

  for (const sortCase of NULL_SORT_CASES) {
    test(`${sortCase.sortKey} ${sortCase.sortDir} keeps null prices last`, () => {
      expect(names({ sortKey: sortCase.sortKey, sortDir: sortCase.sortDir })).toEqual(
        sortCase.expected,
      );
    });
  }

  test("name sort toggles between ascending and descending", () => {
    const ascending = names({ sortKey: "name", sortDir: "asc" });
    const descending = names({ sortKey: "name", sortDir: "desc" });

    expect(descending).toEqual([...ascending].reverse());
  });

  test("unknown sort keys fail fast", () => {
    expect(() => applyView(groups, { sortKey: "latency" })).toThrow(
      "Unsupported sort key: latency",
    );
  });

  test("unknown sort directions fail fast", () => {
    expect(() => applyView(groups, { sortDir: "sideways" })).toThrow(
      "Unsupported sort direction: sideways",
    );
  });
});
