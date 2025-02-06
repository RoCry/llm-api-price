import requests
import json
import os
from datetime import datetime, timezone


def get_remote_content():
    url = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()


def generate_diff_message(old_content, new_content):
    added = []
    removed = []
    modified = []

    # Find added and modified models
    for model in new_content:
        if model not in old_content:
            added.append(model)
        elif new_content[model] != old_content[model]:
            modified.append(model)

    # Find removed models
    for model in old_content:
        if model not in new_content:
            removed.append(model)

    # Build concise message
    changes = []
    if added:
        changes.append(f"Added: {', '.join(added)}")
    if modified:
        changes.append(f"Modified: {', '.join(modified)}")
    if removed:
        changes.append(f"Removed: {', '.join(removed)}")

    if not changes:
        return "No model changes"

    return "\n".join(changes)


def main():
    try:
        # Get remote content
        remote_content = get_remote_content()

        # Check if local file exists
        local_path = "model_prices_and_context_window.json"
        local_content = {}
        if os.path.exists(local_path):
            with open(local_path, "r") as f:
                local_content = json.load(f)

            if local_content == remote_content:
                print("No updates needed")
                return

        # Generate diff message
        diff_message = generate_diff_message(local_content, remote_content)

        # Save new content
        remote_content['last_updated'] = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
        with open(local_path, "w") as f:
            json.dump(remote_content, f, indent=2)

        # Configure git
        os.system('git config --global user.name "GitHub Action"')
        os.system('git config --global user.email "action@github.com"')

        # Commit and push changes
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        os.system("git add model_prices_and_context_window.json")
        commit_message = f"Update prices: {timestamp}\n\nChanges:\n{diff_message}"
        os.system(f'git commit -m "{commit_message}"')
        os.system("git push")

        print("Successfully updated prices")
        print("Changes:\n" + diff_message)

    except Exception as e:
        print(f"Error: {str(e)}")
        exit(1)


if __name__ == "__main__":
    main()
