import { describe, expect, test } from "bun:test";

import { buildCatalog } from "../js/catalog.js";
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
    name: "4.20 sorts after 4.6",
    data: syntheticData(["frontier-4.6", "frontier-4.20"]),
    pattern: "^frontier-\\d+(?:\\.\\d+)?$",
    expected: "frontier-4.20",
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
