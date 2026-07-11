# Domain Glossary — llm-api-price

Static price-comparison site + hourly sync pipeline. Data source: LiteLLM's `model_prices_and_context_window.json`.

## Terms

- **Variant** — one provider's priced entry for a model, as it appears in the raw LiteLLM data (e.g. `azure/gpt-5.2`, `claude-opus-4-6@20260501`). Carries provider, mode, per-token costs, capability flags.
- **Normalized name** — a variant's name after stripping provider prefixes, date/version suffixes, and drop tokens (`preview`, `latest`, …). The grouping key.
- **Model group** — all variants sharing a normalized name, with derived price ranges (min–max input/output per 1M tokens) and merged capability flags. The row unit of the UI.
- **SOTA rule** — a regex describing a frontier model family (from `js/config.js`); the latest priced model group matching the rule (by version comparison) is marked SOTA. Default view shows SOTA only.
- **Catalog** — the deep module that turns raw LiteLLM data + config into model groups: normalization, grouping, range derivation, SOTA selection. Pure data in/out; interface is `buildCatalog(data, config)` + `applyView(groups, criteria)`. No DOM knowledge.
- **View criteria** — plain object of the user's current filters and sort (`query`, `provider`, `mode`, `visionOnly`, `sotaOnly`, `sortKey`, `sortDir`), passed across the seam from the DOM adapter to the Catalog.
- **Updater** — the Python pipeline (`update_prices.py`, run hourly by GitHub Actions) that fetches upstream data, guards against unexpected shrinkage, diffs, and commits.
- **Reserved keys** — top-level entries in the data file that are not variants (`sample_spec`, `fallback_generalizations`, `last_updated`); upstream metadata the Updater treats separately.
