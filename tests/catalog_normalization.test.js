import { describe, expect, test } from "bun:test";

import { buildCatalog } from "../js/catalog.js";
import { fixture, fixtureData, pricedVariant } from "./helpers/catalog.js";

const CASES = [
  ["anthropic.claude-opus-4-20250514-v1:0", "claude-opus-4", true],
  ["us.anthropic.claude-opus-4-8", "claude-opus-4-8", true],
  ["eu.anthropic.claude-opus-4-8", "claude-opus-4-8", true],
  ["vertex_ai/gemini-3.1-pro-preview", "gemini-3.1-pro", true],
  ["azure/gpt-5.5-2026-04-23", "gpt-5.5", true],
  ["anyscale/HuggingFaceH4/zephyr-7b-beta", "zephyr-7b", true],
  ["azure/gpt-5-chat-latest", "gpt-5-chat", true],
  ["deepinfra/nvidia/NVIDIA-Nemotron-Nano-9B-v2", "nvidia-nemotron-nano-9b", true],
  ["vertex_ai/claude-opus-4-8@default", "claude-opus-4-8", true],
  ["amazon.nova-lite-v1:0", "amazon.nova-lite", true],
  ["moonshot/kimi-k2.5", "kimi-k2.5", true],
  ["bedrock.anthropic.claude-opus-4-8", "claude-opus-4-8", false],
  ["vertex_ai.gemini-3.1-pro-preview", "gemini-3.1-pro", false],
  ["provider/model-2.5", "model-2.5", false],
  ["model-20250514", "model", false],
  ["model-2025-05-14", "model", false],
  ["model-v2", "model", false],
  ["model-preview", "model", false],
  ["model-experimental", "model", false],
  ["model-exp", "model", false],
  ["model-latest", "model", false],
  ["model-beta", "model", false],
  ["model-alpha", "model", false],
  ["model-rc", "model", false],
  ["model:tag", "model", false],
  ["model@version", "model", false],
  ["model-2.5", "model-2.5", false],
];

describe("normalized names", () => {
  for (const [rawName, expected, captured] of CASES) {
    test(`${rawName} -> ${expected}`, () => {
      if (captured) expect(Object.hasOwn(fixture.variants, rawName)).toBe(true);
      const data = captured ? fixtureData([rawName]) : { [rawName]: pricedVariant() };

      const { groups } = buildCatalog(data, {});

      expect(groups.map((group) => group.name)).toEqual([expected]);
    });
  }
});
