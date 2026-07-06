import unittest

from fastapi.testclient import TestClient

import main_api


class P2ReleaseReadinessTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main_api.app)

    def test_health_endpoint_returns_service_status_without_auth(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "status": "ok",
                "service": "jobsearch-agent",
                "environment": main_api.ENVIRONMENT,
            },
        )


if __name__ == "__main__":
    unittest.main()
