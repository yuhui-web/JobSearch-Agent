import json
import os
import unittest


ROOT = os.path.dirname(os.path.dirname(__file__))
EXTENSION_DIR = os.path.join(ROOT, "boss-collector-extension")


class BossCollectorExtensionTests(unittest.TestCase):
    def test_extension_declares_boss_page_content_script(self):
        manifest_path = os.path.join(EXTENSION_DIR, "manifest.json")
        with open(manifest_path, "r", encoding="utf-8") as file:
            manifest = json.load(file)

        self.assertEqual(manifest["manifest_version"], 3)
        self.assertIn("*://zhipin.com/*", manifest["host_permissions"])
        self.assertIn("*://*.zhipin.com/*", manifest["host_permissions"])
        self.assertIn("http://127.0.0.1:8010/*", manifest["host_permissions"])
        self.assertEqual(manifest["content_scripts"][0]["js"], ["content.js"])

    def test_extension_posts_real_page_jobs_to_local_import_api(self):
        script_path = os.path.join(EXTENSION_DIR, "content.js")
        with open(script_path, "r", encoding="utf-8") as file:
            script = file.read()

        self.assertIn("job-card-wrapper", script)
        self.assertIn("search-job-result", script)
        self.assertIn("导入到求职代理", script)
        self.assertIn("/imports/jobs", script)
        self.assertIn("company-name", script)
        self.assertIn("source_page: window.location.href", script)


if __name__ == "__main__":
    unittest.main()
