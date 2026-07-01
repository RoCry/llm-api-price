export const config = {
  // Optional exact normalized model names to always include.
  sota_models: [],
  // Curated frontier families. The app selects the latest priced group per rule.
  sota_rules: [
    { pattern: "^gpt-\\d+(?:\\.\\d+)*$" },
    { pattern: "^gpt-\\d+(?:\\.\\d+)*-pro$" },
    { pattern: "^claude-opus-\\d+(?:-\\d+)*$" },
    { pattern: "^claude-sonnet-\\d+(?:-\\d+)*$" },
    { pattern: "^gemini-\\d+(?:\\.\\d+)*-pro$" },
    { pattern: "^gemini-\\d+(?:\\.\\d+)*-flash$" },
    { pattern: "^glm-\\d+(?:\\.\\d+)*$" },
    { pattern: "^kimi-k\\d+(?:\\.\\d+)?-thinking$" },
    { pattern: "^qwen\\d+(?:\\.\\d+)?-max$" },
    { pattern: "^deepseek-v\\d+(?:\\.\\d+)?-pro$" },
    { pattern: "^grok-\\d+(?:\\.\\d+)*-fast$" },
    { pattern: "^llama-\\d+-maverick$" },
    { pattern: "^mistral-large-[1-9](?:\\.\\d+)?$" },
    { pattern: "^minimax-m\\d+(?:\\.\\d+)?$" },
  ],
  model_blacklist: ["sample_spec"],
};
