import { describe, expect, test } from "bun:test";

import * as catalog from "../js/catalog.js";

const { applyView, buildCatalog } = catalog;

function pricedVariant({
  provider,
  input,
  output,
  mode = "chat",
  supportsVision = false,
}) {
  return {
    litellm_provider: provider,
    input_cost_per_token: input,
    output_cost_per_token: output,
    mode,
    supports_vision: supportsVision,
  };
}

describe("Catalog interface", () => {
  test("exports only the two public operations", () => {
    expect(Object.keys(catalog).sort()).toEqual(["applyView", "buildCatalog"]);
  });

  test("normalizes a real Bedrock variant name", () => {
    const { groups } = buildCatalog(
      {
        "anthropic.claude-opus-4-20250514-v1:0": pricedVariant({
          provider: "bedrock_converse",
          input: 0.000015,
          output: 0.000075,
        }),
      },
      {},
    );

    expect(groups.map((group) => group.name)).toEqual(["claude-opus-4"]);
  });

  test("groups variants and derives price ranges", () => {
    const { groups, modes, providers } = buildCatalog(
      {
        "gpt-5.5": pricedVariant({
          provider: "openai",
          input: 0.000002,
          output: 0.00001,
          supportsVision: true,
        }),
        "azure/gpt-5.5-2026-04-23": pricedVariant({
          provider: "azure",
          input: 0.000003,
          output: 0.000012,
        }),
      },
      {},
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("gpt-5.5");
    expect(groups[0].providers).toEqual(["azure", "openai"]);
    expect(groups[0].inputRange).toEqual({ min: 2, max: 3 });
    expect(groups[0].outputRange).toEqual({ min: 10, max: 12 });
    expect(groups[0].supportsVision).toBe(true);
    expect(groups[0].variants).toHaveLength(2);
    expect(providers).toEqual(["azure", "openai"]);
    expect(modes).toEqual(["chat"]);
  });

  test("marks the latest priced SOTA family member", () => {
    const data = Object.fromEntries(
      ["claude-opus-4-7", "claude-opus-4-8"].map((name) => [
        name,
        pricedVariant({ provider: "anthropic", input: 0.000005, output: 0.000025 }),
      ]),
    );

    const { groups } = buildCatalog(data, {
      sota_rules: [{ pattern: "^claude-opus-4-\\d+$" }],
    });

    expect(groups.filter((group) => group.isSota).map((group) => group.name)).toEqual([
      "claude-opus-4-8",
    ]);
  });

  test("fails fast on a malformed SOTA rule", () => {
    const data = {
      "gpt-5.5": pricedVariant({ provider: "openai", input: 0.000002, output: 0.00001 }),
    };

    expect(() => buildCatalog(data, { sota_rules: [{ pattern: "(" }] })).toThrow(
      "Invalid SOTA rule pattern",
    );
  });

  test("combines a provider filter with descending input-price sort", () => {
    const data = {
      "gpt-5.4": pricedVariant({ provider: "openai", input: 0.000001, output: 0.000004 }),
      "gpt-5.5": pricedVariant({ provider: "openai", input: 0.000002, output: 0.00001 }),
      "claude-opus-4-8": pricedVariant({
        provider: "anthropic",
        input: 0.000005,
        output: 0.000025,
      }),
    };
    const { groups } = buildCatalog(data, {});

    const visible = applyView(groups, {
      query: "gpt",
      provider: "openai",
      sortKey: "input",
      sortDir: "desc",
    });

    expect(visible.map((group) => group.name)).toEqual(["gpt-5.5", "gpt-5.4"]);
  });
});
