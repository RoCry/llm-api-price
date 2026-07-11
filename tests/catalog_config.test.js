import { describe, expect, test } from "bun:test";

import { buildCatalog } from "../js/catalog.js";
import { config } from "../js/config.js";
import { fixture, fixtureData } from "./helpers/catalog.js";

const EXPECTED_SOTA = [
  "claude-opus-4-8",
  "claude-sonnet-5",
  "deepseek-v4-pro",
  "gemini-3.1-pro",
  "gemini-3.5-flash",
  "glm-5.2",
  "gpt-5.5-pro",
  "gpt-5.6",
  "grok-4.1-fast",
  "kimi-k2-thinking",
  "llama-4-maverick",
  "minimax-m3",
  "mistral-large-3",
  "qwen3-max",
];

function selectedNames() {
  return buildCatalog(fixtureData(), config)
    .groups.filter((group) => group.isSota)
    .map((group) => group.name)
    .sort();
}

describe("shipped Catalog config", () => {
  test("uses a non-empty snapshot of the checked-in price data", () => {
    expect(fixture.source).toBe("model_prices_and_context_window.json");
    expect(fixture.captured_last_updated).toBe("2026-07-09T20:52:02.466510+00:00");
    expect(Object.keys(fixture.variants)).toHaveLength(37);
  });

  for (const rule of config.sota_rules) {
    test(`compiles ${rule.pattern}`, () => {
      expect(() => buildCatalog(fixtureData(), { sota_rules: [rule] })).not.toThrow();
    });
  }

  test("selects the same frontier groups on every run", () => {
    expect(selectedNames()).toEqual(EXPECTED_SOTA);
    expect(selectedNames()).toEqual(EXPECTED_SOTA);
  });
});
