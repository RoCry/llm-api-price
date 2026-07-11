export const fixture = await Bun.file(
  new URL("../fixtures/catalog-variants.json", import.meta.url),
).json();

export function fixtureData(names = Object.keys(fixture.variants)) {
  return Object.fromEntries(
    names.map((name) => {
      const variant = fixture.variants[name];
      if (!variant) throw new Error(`Fixture variant not found: ${name}`);
      return [name, variant];
    }),
  );
}

export function pricedVariant({
  provider = "test-provider",
  input = 0.000001,
  output = 0.000002,
  mode = "chat",
  supportsVision = false,
} = {}) {
  return {
    litellm_provider: provider,
    input_cost_per_token: input,
    output_cost_per_token: output,
    mode,
    supports_vision: supportsVision,
  };
}
