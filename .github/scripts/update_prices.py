import requests
import json
import os
from datetime import datetime, timezone


def get_remote_content():
    url = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()


def load_local_content(file_path):
    if not os.path.exists(file_path):
        return {}
    with open(file_path, "r") as f:
        return json.load(f)


def clean_content(content):
    """Remove last_updated field for comparison"""
    return {k: v for k, v in content.items() if k != "last_updated"}


def save_content(content, file_path):
    content["last_updated"] = datetime.now(timezone.utc).isoformat()
    with open(file_path, "w") as f:
        json.dump(content, f, indent=2)


def generate_diff_message(old_content, new_content) -> str:
    old_content_clean = clean_content(old_content)
    new_content_clean = clean_content(new_content)

    added = set(new_content_clean) - set(old_content_clean)
    removed = set(old_content_clean) - set(new_content_clean)
    modified = {
        model
        for model in set(new_content_clean) & set(old_content_clean)
        if new_content_clean[model] != old_content_clean[model]
    }

    changes = []

    def _append_fulfill_model(label, models, is_removed=False):
        if not models:
            return
        # Use old_content for removed models, new_content for added/modified models
        content_to_use = old_content_clean if is_removed else new_content_clean
        infos = [
            f"{name}@{content_to_use[name]['litellm_provider']}" for name in models
        ]
        changes.append(f"{label}: {', '.join(infos)}")

    _append_fulfill_model("Added", added)
    _append_fulfill_model("Modified", modified)
    _append_fulfill_model("Removed", removed, is_removed=True)

    return "\n".join(changes) if changes else ""


def setup_git():
    """Configure git locally for this repository"""
    os.system('git config user.name "GitHub Action"')
    os.system('git config user.email "action@github.com"')


def commit_and_push(file_path, diff_message):
    """Commit and push changes to git"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    commit_message = f"Update prices: {timestamp}\n\nChanges:\n{diff_message}"

    os.system(f"git add {file_path}")
    os.system(f'git commit -m "{commit_message}"')
    os.system("git push")


def main():
    try:
        local_path = "model_prices_and_context_window.json"

        # Get both remote and local content
        remote_content = get_remote_content()
        local_content = load_local_content(local_path)

        # Generate diff and save new content
        diff_message = generate_diff_message(local_content, remote_content)
        if not diff_message:
            print("No updates needed")
            return
        save_content(remote_content, local_path)

        # Git operations
        setup_git()
        commit_and_push(local_path, diff_message)

        print("Successfully updated prices")
        print("Changes:\n" + diff_message)

    except Exception as e:
        print(f"Error: {str(e)}")
        exit(1)


if __name__ == "__main__":
    main()
