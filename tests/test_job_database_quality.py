import os
import tempfile
import unittest

from src.utils.job_database import JobDatabase


class JobDatabaseQualityTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "jobsearch.db")
        self.db = JobDatabase(self.db_path)

    def tearDown(self):
        self.db.close()
        self.temp_dir.cleanup()

    def test_rejects_placeholder_job_identity(self):
        added = self.db.add_job(
            {
                "source_url": "https://www.linkedin.com/jobs/view/na-company/",
                "source": "linkedin",
                "job_title": "NA",
                "company_name": "NA",
                "job_location": "NA",
            }
        )

        self.assertFalse(added)
        self.assertEqual(self.db.get_jobs(), [])


if __name__ == "__main__":
    unittest.main()
