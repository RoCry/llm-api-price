import json


def main():
    with open("model_prices_and_context_window.json", "r") as f:
        data = json.load(f)

    unique_models = set()

    for model, model_data in data.items():
        if not isinstance(model_data, dict):
            continue
        provider = model_data.get("litellm_provider")
        if provider in ["openai", "anthropic", "azure"]:
            unique_models.add(model.split("/")[-1])

    # sort alphabetically
    unique_models = sorted(unique_models)

    print("\n".join(unique_models))


if __name__ == "__main__":
    main()
