import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

import update_prices


class GenerateDiffMessageTest(unittest.TestCase):
    def test_non_model_metadata_changes_are_reported(self):
        old_content = {
            "fallback_generalizations": {"rules": []},
            "last_updated": "2026-01-01T00:00:00+00:00",
        }
        new_content = {
            "fallback_generalizations": {"rules": [{"name": "future-model", "pattern": "^future-"}]},
            "last_updated": "2026-01-02T00:00:00+00:00",
        }

        diff_message = update_prices.generate_diff_message(old_content, new_content)

        self.assertEqual(diff_message, "Modified metadata: fallback_generalizations")

    def test_reserved_sample_spec_is_metadata(self):
        old_content = {}
        new_content = {
            "sample_spec": {
                "litellm_provider": "one of https://docs.litellm.ai/docs/providers",
                "input_cost_per_token": 0.0,
                "output_cost_per_token": 0.0,
            }
        }

        diff_message = update_prices.generate_diff_message(old_content, new_content)

        self.assertEqual(diff_message, "Added metadata: sample_spec")

    def test_model_and_metadata_changes_are_formatted_separately(self):
        old_content = {
            "existing-model": {
                "litellm_provider": "openai",
                "input_cost_per_token": 1e-6,
            },
            "last_updated": "2026-01-01T00:00:00+00:00",
        }
        new_content = {
            "existing-model": {
                "litellm_provider": "openai",
                "input_cost_per_token": 1e-6,
            },
            "new-model": {
                "litellm_provider": "anthropic",
                "input_cost_per_token": 2e-6,
            },
            "fallback_generalizations": {"rules": []},
            "last_updated": "2026-01-02T00:00:00+00:00",
        }

        diff_message = update_prices.generate_diff_message(old_content, new_content)

        self.assertEqual(
            diff_message,
            "Added: new-model@anthropic\nAdded metadata: fallback_generalizations",
        )

    def test_last_updated_only_does_not_count_as_update(self):
        old_content = {
            "model": {"litellm_provider": "openai"},
            "last_updated": "2026-01-01T00:00:00+00:00",
        }
        new_content = {
            "model": {"litellm_provider": "openai"},
            "last_updated": "2026-01-02T00:00:00+00:00",
        }

        self.assertEqual(update_prices.generate_diff_message(old_content, new_content), "")

    def test_price_bearing_entry_without_provider_fails_fast(self):
        old_content = {}
        new_content = {"priced-model": {"input_cost_per_token": 1e-6}}

        with self.assertRaisesRegex(ValueError, "missing litellm_provider"):
            update_prices.generate_diff_message(old_content, new_content)

    def test_tiered_pricing_entry_without_provider_fails_fast(self):
        old_content = {}
        new_content = {"priced-model": {"tiered_pricing": {}}}

        with self.assertRaisesRegex(ValueError, "missing litellm_provider"):
            update_prices.generate_diff_message(old_content, new_content)


class RemoteContentValidationTest(unittest.TestCase):
    def test_reserved_entries_do_not_count_toward_shrink_guard(self):
        local_content = {
            "model-a": {"litellm_provider": "openai"},
            "model-b": {"litellm_provider": "anthropic"},
            "sample_spec": {},
        }
        remote_content = {
            "model-a": {"litellm_provider": "openai"},
            "model-b": {"litellm_provider": "anthropic"},
            "fallback_generalizations": {"rules": []},
            "sample_spec": {},
        }

        update_prices.validate_remote_content(remote_content, local_content)

    def test_large_remote_shrink_fails_fast(self):
        local_content = {f"model-{index}": {"litellm_provider": "openai"} for index in range(10)}
        remote_content = {
            "model-1": {"litellm_provider": "openai"},
            "fallback_generalizations": {"rules": []},
            "sample_spec": {},
        }

        with self.assertRaisesRegex(ValueError, "shrank unexpectedly"):
            update_prices.validate_remote_content(remote_content, local_content)


class LocalContentTest(unittest.TestCase):
    def test_missing_local_file_fails_fast(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            missing_path = Path(temp_dir) / "missing.json"

            with self.assertRaises(FileNotFoundError):
                update_prices.load_local_content(missing_path)

    def test_save_content_stamps_last_updated_without_mutating_input(self):
        content = {"model": {"litellm_provider": "openai"}}
        now = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "prices.json"
            update_prices.save_content(content, output_path, now=now)

            saved = json.loads(output_path.read_text(encoding="utf-8"))

        self.assertNotIn("last_updated", content)
        self.assertEqual(saved["last_updated"], "2026-01-02T03:04:05+00:00")
        self.assertEqual(saved["model"], {"litellm_provider": "openai"})


class GitCommandTest(unittest.TestCase):
    def test_commit_and_push_uses_checked_git_commands_and_message_file(self):
        commit_message = []

        def capture_git(args):
            if args[0] == "commit":
                commit_message.append(Path(args[2]).read_text(encoding="utf-8"))

        with mock.patch.object(update_prices, "_run_git", side_effect=capture_git) as run_git:
            update_prices.commit_and_push(
                Path("model_prices_and_context_window.json"),
                "Added: new-model@openai",
            )

        self.assertEqual(
            [call.args[0][0] for call in run_git.call_args_list],
            ["add", "commit", "push"],
        )
        self.assertIn("Changes:\nAdded: new-model@openai", commit_message[0])


if __name__ == "__main__":
    unittest.main()
