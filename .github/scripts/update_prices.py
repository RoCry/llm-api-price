import json
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import requests

REMOTE_URL = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
REQUEST_TIMEOUT_SECONDS = 30
MODEL_COUNT_SHRINK_THRESHOLD = 0.7
RESERVED_TOP_LEVEL_KEYS = frozenset({"fallback_generalizations", "sample_spec"})


def get_remote_content():
    response = requests.get(REMOTE_URL, timeout=REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()
    content = response.json()
    if not isinstance(content, dict):
        raise ValueError("Remote model price content must be a JSON object")
    return content


def load_local_content(file_path):
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Local model price file not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        content = json.load(f)
    if not isinstance(content, dict):
        raise ValueError(f"Local model price file must be a JSON object: {path}")
    return content


def clean_content(content):
    """Remove last_updated field for comparison"""
    return {k: v for k, v in content.items() if k != "last_updated"}


def _has_top_level_price_field(entry):
    if not isinstance(entry, dict):
        return False
    return any("cost" in key or "pricing" in key for key in entry)


def _is_model_entry(name, entry):
    if name in RESERVED_TOP_LEVEL_KEYS:
        return False
    if not isinstance(entry, dict):
        return False
    provider = entry.get("litellm_provider")
    if isinstance(provider, str) and provider:
        return True
    if _has_top_level_price_field(entry):
        raise ValueError(f"Price-bearing entry {name!r} is missing litellm_provider")
    return False


def _partition_changed_entries(names, content):
    model_names = []
    metadata_names = []
    for name in sorted(names):
        if _is_model_entry(name, content[name]):
            model_names.append(name)
        else:
            metadata_names.append(name)
    return model_names, metadata_names


def _format_model_changes(label, names, content):
    if not names:
        return ""
    infos = [f"{name}@{content[name]['litellm_provider']}" for name in names]
    return f"{label}: {', '.join(infos)}"


def _format_metadata_changes(label, names):
    if not names:
        return ""
    return f"{label} metadata: {', '.join(names)}"


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

    def _append_changes(label, names, is_removed=False):
        content_to_use = old_content_clean if is_removed else new_content_clean
        model_names, metadata_names = _partition_changed_entries(names, content_to_use)
        if model_message := _format_model_changes(label, model_names, content_to_use):
            changes.append(model_message)
        if metadata_message := _format_metadata_changes(label, metadata_names):
            changes.append(metadata_message)

    _append_changes("Added", added)
    _append_changes("Modified", modified)
    _append_changes("Removed", removed, is_removed=True)

    return "\n".join(changes) if changes else ""


def _count_sync_entries(content):
    return sum(1 for name in content if name != "last_updated" and name not in RESERVED_TOP_LEVEL_KEYS)


def validate_remote_content(remote_content, local_content):
    remote_count = _count_sync_entries(remote_content)
    local_count = _count_sync_entries(local_content)
    minimum_remote_count = int(local_count * MODEL_COUNT_SHRINK_THRESHOLD)
    if remote_count < minimum_remote_count:
        raise ValueError(
            "Remote model price content shrank unexpectedly: "
            f"remote={remote_count}, local={local_count}, "
            f"minimum={minimum_remote_count}"
        )


def save_content(content, file_path, now=None):
    content_to_save = dict(content)
    content_to_save["last_updated"] = (now or datetime.now(timezone.utc)).isoformat()
    with Path(file_path).open("w", encoding="utf-8") as f:
        json.dump(content_to_save, f, indent=2, ensure_ascii=False)
        f.write("\n")


def _run_git(args):
    subprocess.run(["git", *args], check=True)


def setup_git():
    """Configure git locally for this repository"""
    _run_git(["config", "user.name", "GitHub Action"])
    _run_git(["config", "user.email", "action@github.com"])


def commit_and_push(file_path, diff_message):
    """Commit and push changes to git"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    commit_message = f"Update prices: {timestamp}\n\nChanges:\n{diff_message}"

    _run_git(["add", str(file_path)])
    with tempfile.NamedTemporaryFile("w", encoding="utf-8") as message_file:
        message_file.write(commit_message)
        message_file.flush()
        _run_git(["commit", "-F", message_file.name])
    _run_git(["push"])


def main():
    try:
        local_path = Path("model_prices_and_context_window.json")

        # Get both remote and local content
        remote_content = get_remote_content()
        local_content = load_local_content(local_path)
        validate_remote_content(remote_content, local_content)

        # Generate diff and save new content
        diff_message = generate_diff_message(local_content, remote_content)
        if not diff_message:
            print("No updates needed")
            return 0
        save_content(remote_content, local_path)

        # Git operations
        setup_git()
        commit_and_push(local_path, diff_message)

        print("Successfully updated prices")
        print("Changes:\n" + diff_message)
        return 0

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
