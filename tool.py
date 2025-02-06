import json

def main():
    with open("model_prices_and_context_window.json", "r") as f:
        data = json.load(f)
    
    unique_models = set()

    for model, model_data in data.items():
        unique_models.add(model.split("/")[-1])
    
    # sort alphabetically
    unique_models = sorted(unique_models)

    print("\n".join(unique_models))


if __name__ == "__main__":
    main()
