import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import main_api
from src.utils.job_database import JobDatabase


class InterviewLogApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "jobsearch.db")
        self.client = TestClient(main_api.app)

        patcher = patch(
            "main_api.get_job_database",
            side_effect=lambda: JobDatabase(self.db_path),
        )
        self.addCleanup(patcher.stop)
        patcher.start()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_create_and_list_interview_logs(self):
        payload = {
            "job_title": "Python Intern",
            "company_name": "Example Inc",
            "outcome": "rejected",
            "failure_reason": "base_python",
            "notes": "Could not answer asyncio question well.",
            "next_action": "Review async basics",
        }

        create_response = self.client.post("/interview-logs", json=payload)
        self.assertEqual(create_response.status_code, 200)
        self.assertIn("id", create_response.json()["data"])

        list_response = self.client.get("/interview-logs?company_name=Example")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json()["count"], 1)
        self.assertEqual(list_response.json()["data"][0]["company_name"], "Example Inc")

    def test_interview_log_stats(self):
        self.client.post(
            "/interview-logs",
            json={
                "job_title": "Python Intern",
                "company_name": "Example Inc",
                "outcome": "rejected",
                "failure_reason": "base_python",
            },
        )
        self.client.post(
            "/interview-logs",
            json={
                "job_title": "Data Intern",
                "company_name": "Example Inc",
                "outcome": "passed",
            },
        )

        response = self.client.get("/interview-logs/stats")
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["total_logs"], 2)
        self.assertEqual(data["by_outcome"]["rejected"], 1)
        self.assertEqual(data["by_outcome"]["passed"], 1)


if __name__ == "__main__":
    unittest.main()
