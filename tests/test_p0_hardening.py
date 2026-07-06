import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.middleware.cors import CORSMiddleware

import main_api


class P0HardeningTests(unittest.TestCase):
    def test_cors_defaults_are_safe_for_api_key_auth(self):
        cors_middleware = next(
            middleware
            for middleware in main_api.app.user_middleware
            if middleware.cls is CORSMiddleware
        )

        self.assertNotIn("*", cors_middleware.kwargs["allow_origins"])
        self.assertFalse(cors_middleware.kwargs["allow_credentials"])
        self.assertIn("X-API-Key", cors_middleware.kwargs["allow_headers"])

    def test_search_history_save_uses_atomic_replace(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            history_path = os.path.join(temp_dir, "search_history.json")

            with patch("main_api.output_dir", temp_dir), patch(
                "main_api.search_history_file", history_path
            ), patch("main_api.os.replace", wraps=os.replace) as replace_mock:
                main_api.save_search_history(
                    [
                        {
                            "search_id": "job_search_20260706_120000",
                            "keywords": "python agent",
                        }
                    ]
                )

            self.assertTrue(replace_mock.called)
            self.assertTrue(os.path.exists(history_path))

    def test_location_filter_helpers_are_defined_once(self):
        source = Path(main_api.__file__).read_text(encoding="utf-8")

        self.assertEqual(source.count("def _has_specific_district("), 1)
        self.assertEqual(source.count("def _filter_jobs_for_specific_location("), 1)


if __name__ == "__main__":
    unittest.main()
