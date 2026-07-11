import { describe, expect, test } from "bun:test";

import { buildCatalog } from "../js/catalog.js";
import { config } from "../js/config.js";
import { fixtureData, pricedVariant } from "./helpers/catalog.js";

function syntheticData(names) {
  return Object.fromEntries(names.map((name) => [name, pricedVariant()]));
}

function selectedNames(data, config) {
  return buildCatalog(data, config)
    .groups.filter((group) => group.isSota)
    .map((group) => group.name)
    .sort();
}

const VERSION_CASES = [
  {
    // Flipped by #5: dotted tokens are decimal fractions, so 4.20 = 4.2 < 4.6.
    name: "4.6 sorts after 4.20 under dotted-decimal order",
    data: syntheticData(["frontier-4.6", "frontier-4.20"]),
    pattern: "^frontier-\\d+(?:\\.\\d+)?$",
    expected: "frontier-4.6",
  },
  {
    name: "dotted-decimal order across 4.20, 4.3, 4.5",
    data: syntheticData(["frontier-4.20", "frontier-4.3", "frontier-4.5"]),
    pattern: "^frontier-\\d+(?:\\.\\d+)?$",
    expected: "frontier-4.5",
  },
  {
    name: "4.3 sorts after 4.20",
    data: syntheticData(["frontier-4.20", "frontier-4.3"]),
    pattern: "^frontier-\\d+(?:\\.\\d+)?$",
    expected: "frontier-4.3",
  },
  {
    name: "dash-separated tokens stay integer sequences",
    data: syntheticData(["frontier-4-8", "frontier-4-10"]),
    pattern: "^frontier-\\d+(?:-\\d+)*$",
    expected: "frontier-4-10",
  },
  {
    name: "dotted version sorts after its bare whole number",
    data: syntheticData(["frontier-4", "frontier-4.5"]),
    pattern: "^frontier-\\d+(?:\\.\\d+)?$",
    expected: "frontier-4.5",
  },
  {
    name: "5 sorts after 4.20",
    data: syntheticData(["frontier-4.20", "frontier-5"]),
    pattern: "^frontier-\\d+(?:\\.\\d+)?$",
    expected: "frontier-5",
  },
  {
    name: "p-prefixed version parts compare numerically",
    data: fixtureData([
      "fireworks_ai/accounts/fireworks/models/glm-4p5",
      "fireworks_ai/accounts/fireworks/models/glm-4p6",
    ]),
    pattern: "^glm-4p\\d+$",
    expected: "glm-4p6",
  },
  {
    name: "Kimi dotted versions compare numerically",
    data: fixtureData(["moonshot/kimi-k2.5", "moonshot/kimi-k2.6"]),
    pattern: "^kimi-k\\d+(?:\\.\\d+)?$",
    expected: "kimi-k2.6",
  },
];

describe("SOTA selection", () => {
  for (const versionCase of VERSION_CASES) {
    test(versionCase.name, () => {
      expect(
        selectedNames(versionCase.data, {
          sota_rules: [{ pattern: versionCase.pattern }],
        }),
      ).toEqual([versionCase.expected]);
    });
  }

  test("rule limit keeps the latest requested family members", () => {
    const data = fixtureData(["gpt-5.4", "gpt-5.5", "gpt-5.6"]);

    expect(
      selectedNames(data, {
        sota_rules: [{ pattern: "^gpt-\\d+(?:\\.\\d+)*$", limit: 2 }],
      }),
    ).toEqual(["gpt-5.5", "gpt-5.6"]);
  });

  test("frontier families from #5 select against the fixture", () => {
    const names = selectedNames(fixtureData(), config);

    expect(names).toContain("claude-fable-5");
    expect(names).toContain("grok-4.5");
    expect(names).toContain("grok-4.1-fast");
    expect(names).toContain("gpt-5.6");
    expect(names).not.toContain("grok-4.20");
    expect(names).not.toContain("gpt-5.6-sol");
    expect(names).not.toContain("gpt-5.6-terra");
    expect(names).not.toContain("gpt-5.6-luna");
  });

  test("exact model inclusion is additive to rule selection", () => {
    const data = fixtureData(["gpt-5.4", "gpt-5.5", "gpt-5.6"]);

    expect(
      selectedNames(data, {
        sota_models: ["gpt-5.4"],
        sota_rules: [{ pattern: "^gpt-\\d+(?:\\.\\d+)*$" }],
      }),
    ).toEqual(["gpt-5.4", "gpt-5.6"]);
  });
});
