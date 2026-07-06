import os
import tempfile
import unittest
from unittest.mock import patch

from src.utils.job_database import JobDatabase
from src.utils.job_search_pipeline import JobSearchPipeline


class FakeLinkedInScraper:
    def collect_job_links(self, keywords, location, max_pages):
        return ["https://example.test/jobs/1"]

    def get_job_details(self, job_url):
        return {
            "job_title": "Python Intern",
            "company_name": "Example AI",
            "job_location": "Wuhan",
            "job_description": "Python FastAPI internship",
        }

    def close(self):
        pass


class P1ResultTrustTests(unittest.TestCase):
    def test_duplicate_job_feedback_reports_already_existed(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            db = JobDatabase(os.path.join(temp_dir, "jobs.db"))
            job = {
                "source_url": "https://example.test/jobs/python-intern",
                "source": "boss_import",
                "job_title": "Python Intern",
                "company_name": "Example AI",
                "job_location": "Wuhan",
            }

            first = db.add_job_with_immediate_feedback(job)
            second = db.add_job_with_immediate_feedback(job)
            db.close()

        self.assertTrue(first["success"])
        self.assertEqual(first["action"], "added_to_database")
        self.assertTrue(second["success"])
        self.assertEqual(second["action"], "already_existed")

    def test_pipeline_returns_real_saved_jobs_not_placeholder_objects(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            pipeline = JobSearchPipeline(
                keywords="python",
                locations=["Wuhan"],
                max_jobs_per_site=1,
                output_dir=temp_dir,
                scrapers=["fake"],
                use_database=True,
            )
            pipeline.scrapers = ["linkedin"]
            pipeline.linkedin_scraper = FakeLinkedInScraper()
            pipeline.db.close()
            pipeline.db = JobDatabase(os.path.join(temp_dir, "pipeline_jobs.db"))

            with patch("builtins.print"):
                results = pipeline.search_jobs()

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["source"], "linkedin")
        self.assertEqual(results[0]["job_title"], "Python Intern")
        self.assertNotIn("saved", results[0])


if __name__ == "__main__":
    unittest.main()
