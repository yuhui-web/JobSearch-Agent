import os
import tempfile
import unittest

from src.utils.job_database import JobDatabase


class InterviewLogDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "jobsearch.db")
        self.db = JobDatabase(self.db_path)

    def tearDown(self):
        self.db.close()
        self.temp_dir.cleanup()

    def test_interview_log_api_exists(self):
        self.assertTrue(hasattr(self.db, "add_interview_log"))
        self.assertTrue(hasattr(self.db, "get_interview_logs"))

    def test_can_store_and_fetch_interview_failure_log(self):
        log_id = self.db.add_interview_log(
            job_title="Python Intern",
            company_name="Example Inc",
            outcome="rejected",
            failure_reason="base_python",
            notes="Could not answer asyncio question well.",
            next_action="Review async basics",
        )

        self.assertIsInstance(log_id, int)

        logs = self.db.get_interview_logs(company_name="Example Inc")
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0]["job_title"], "Python Intern")
        self.assertEqual(logs[0]["outcome"], "rejected")
        self.assertEqual(logs[0]["failure_reason"], "base_python")
        self.assertEqual(logs[0]["next_action"], "Review async basics")

    def test_can_summarize_interview_logs(self):
        self.db.add_interview_log(
            job_title="Python Intern",
            company_name="Example Inc",
            outcome="rejected",
            failure_reason="base_python",
        )
        self.db.add_interview_log(
            job_title="Java Intern",
            company_name="Example Inc",
            outcome="rejected",
            failure_reason="communication",
        )
        self.db.add_interview_log(
            job_title="ML Intern",
            company_name="Another Co",
            outcome="passed",
            failure_reason=None,
        )

        stats = self.db.get_interview_log_stats()

        self.assertEqual(stats["total_logs"], 3)
        self.assertEqual(stats["by_outcome"]["rejected"], 2)
        self.assertEqual(stats["by_outcome"]["passed"], 1)
        self.assertEqual(stats["top_failure_reasons"][0]["failure_reason"], "base_python")


if __name__ == "__main__":
    unittest.main()
