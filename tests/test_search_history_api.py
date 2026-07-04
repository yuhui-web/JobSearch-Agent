import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import main_api
from src.utils.job_database import JobDatabase


class SearchHistoryApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.client = TestClient(main_api.app)

        patcher = patch(
            "main_api.search_history_file",
            os.path.join(self.temp_dir.name, "search_history.json"),
        )
        self.addCleanup(patcher.stop)
        patcher.start()

        output_patcher = patch("main_api.output_dir", self.temp_dir.name)
        self.addCleanup(output_patcher.stop)
        output_patcher.start()

        main_api.boss_monitor_state.update(
            {
                "running": False,
                "keywords": "",
                "locations": [],
                "job_type": "",
                "experience_level": "",
                "max_jobs": 0,
                "scrapers": ["boss"],
                "interval_seconds": 300,
                "last_search_id": None,
                "last_job_count": 0,
                "last_run_at": None,
                "last_error": None,
            }
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_history_includes_started_search_without_results_file(self):
        main_api.add_search_to_history(
            search_id="job_search_20260629_120000",
            keywords="python agent intern",
            locations=["Remote"],
            job_type="internship",
            experience_level="entry-level",
            scrapers=["linkedin"],
            max_jobs=5,
            status="started",
        )

        response = self.client.get("/search/history?limit=5")

        self.assertEqual(response.status_code, 200)
        searches = response.json()["searches"]
        self.assertEqual(len(searches), 1)
        self.assertEqual(searches[0]["search_id"], "job_search_20260629_120000")
        self.assertEqual(searches[0]["status"], "started")
        self.assertEqual(searches[0]["job_count"], 0)
        self.assertFalse(searches[0]["has_results"])

    def test_database_fallback_results_match_current_search_location_and_keyword(self):
        db_path = os.path.join(self.temp_dir.name, "jobsearch.db")
        db = JobDatabase(db_path)
        db.add_job(
            {
                "source_url": "https://www.linkedin.com/jobs/view/old-germany/",
                "source": "linkedin",
                "job_title": "Ausbildung Fachinformatiker",
                "company_name": "Berlin Tech",
                "job_location": "Germany",
            }
        )
        db.add_job(
            {
                "source_url": "https://www.zhipin.com/job_detail/wuhan-python.html",
                "source": "boss",
                "job_title": "Python 实习生",
                "company_name": "武汉智能科技有限公司",
                "job_location": "中国 湖北省 武汉市",
            }
        )
        db.close()

        with patch("main_api.JobDatabase", side_effect=lambda: JobDatabase(db_path)):
            results = main_api.load_search_results_from_database(
                keywords="python实习",
                locations=["中国 湖北省 武汉市"],
                max_jobs=5,
            )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["company_name"], "武汉智能科技有限公司")
        self.assertIn("武汉", results[0]["job_location"])

    def test_search_result_endpoint_filters_existing_file_by_current_search(self):
        search_id = "job_search_20260629_130000"
        main_api.add_search_to_history(
            search_id=search_id,
            keywords="python实习",
            locations=["中国 湖北省 武汉市"],
            job_type="internship",
            experience_level="entry-level",
            scrapers=["linkedin"],
            max_jobs=5,
            status="completed",
        )
        with open(os.path.join(self.temp_dir.name, f"{search_id}.json"), "w", encoding="utf-8") as f:
            f.write(
                """
                [
                  {
                    "job_title": "NA",
                    "company_name": "NA",
                    "job_location": "NA",
                    "source_url": "https://www.linkedin.com/jobs/view/bad/"
                  },
                  {
                    "job_title": "Ausbildung Fachinformatiker",
                    "company_name": "Berlin Tech",
                    "job_location": "Germany",
                    "source_url": "https://www.linkedin.com/jobs/view/old/"
                  },
                  {
                    "job_title": "Python 实习生",
                    "company_name": "武汉智能科技有限公司",
                    "job_location": "中国 湖北省 武汉市",
                    "source_url": "https://www.zhipin.com/job_detail/wuhan-python.html"
                  }
                ]
                """
            )

        response = self.client.get(f"/search/{search_id}")

        self.assertEqual(response.status_code, 200)
        results = response.json()
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["company_name"], "武汉智能科技有限公司")

    def test_search_result_endpoint_matches_split_english_keywords(self):
        search_id = "job_search_20260629_140000"
        main_api.add_search_to_history(
            search_id=search_id,
            keywords="python agent",
            locations=["武汉"],
            job_type="internship",
            experience_level="entry-level",
            scrapers=["boss"],
            max_jobs=5,
            status="completed",
        )
        with open(os.path.join(self.temp_dir.name, f"{search_id}.json"), "w", encoding="utf-8") as f:
            f.write(
                """
                [
                  {
                    "job_title": "AI Agent开发工程师",
                    "company_name": "微派",
                    "job_location": "武汉 洪山区",
                    "job_description": "基于 Python 和 DeepSeek 开发 Agent。",
                    "source_url": "https://www.zhipin.com/job_detail/agent.html"
                  }
                ]
                """
            )

        response = self.client.get(f"/search/{search_id}")

        self.assertEqual(response.status_code, 200)
        results = response.json()
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["job_title"], "AI Agent开发工程师")

    def test_search_result_endpoint_does_not_regenerate_curated_jobs_as_live_results(self):
        search_id = "job_search_20260629_141000"
        main_api.add_search_to_history(
            search_id=search_id,
            keywords="python agent",
            locations=[],
            job_type="internship",
            experience_level="entry-level",
            scrapers=["boss"],
            max_jobs=5,
            status="completed",
        )
        with open(os.path.join(self.temp_dir.name, f"{search_id}.json"), "w", encoding="utf-8") as f:
            f.write(
                """
                [
                  {
                    "source": "curated",
                    "job_title": "AI Agent开发工程师",
                    "company_name": "微派",
                    "job_location": "武汉 洪山区",
                    "job_description": "基于 Python 和 DeepSeek 开发 Agent。",
                    "source_url": "https://www.zhipin.com/job_detail/agent.html"
                  }
                ]
                """
            )

        response = self.client.get(f"/search/{search_id}")

        self.assertEqual(response.status_code, 200)
        results = response.json()
        self.assertEqual(results, [])

    def test_search_result_endpoint_regenerates_completed_empty_results(self):
        search_id = "job_search_20260629_142000"
        main_api.add_search_to_history(
            search_id=search_id,
            keywords="Python FastAPI 数据处理 实习 初级",
            locations=["武汉 东湖新区"],
            job_type="internship",
            experience_level="entry-level",
            scrapers=["boss"],
            max_jobs=5,
            status="completed",
        )
        with open(os.path.join(self.temp_dir.name, f"{search_id}.json"), "w", encoding="utf-8") as f:
            f.write("[]")

        with patch("main_api.build_fast_boss_candidates") as build_candidates:
            build_candidates.return_value = [
                {
                    "source": "observed_boss",
                    "job_title": "Python实习生",
                    "company_name": "可循智能",
                    "job_location": "武汉 江夏区",
                    "amap_company_url": "https://www.amap.com/search?query=test",
                }
            ]

            response = self.client.get(f"/search/{search_id}")

        self.assertEqual(response.status_code, 200)
        results = response.json()
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["company_name"], "可循智能")
        with open(os.path.join(self.temp_dir.name, f"{search_id}.json"), encoding="utf-8") as f:
            saved = f.read()
        self.assertIn("可循智能", saved)

    def test_history_regenerates_completed_empty_result_counts(self):
        search_id = "job_search_20260629_142500"
        main_api.add_search_to_history(
            search_id=search_id,
            keywords="Python FastAPI 数据处理 实习 初级",
            locations=["武汉 东湖新区"],
            job_type="internship",
            experience_level="entry-level",
            scrapers=["boss"],
            max_jobs=5,
            status="completed",
        )
        with open(os.path.join(self.temp_dir.name, f"{search_id}.json"), "w", encoding="utf-8") as f:
            f.write("[]")

        with patch("main_api.build_fast_boss_candidates") as build_candidates:
            build_candidates.return_value = [
                {
                    "source": "observed_boss",
                    "job_title": "Python实习生",
                    "company_name": "广置科技",
                    "job_location": "武汉 江夏区",
                    "amap_company_url": "https://www.amap.com/search?query=test",
                }
            ]
            response = self.client.get("/search/history?limit=1")

        self.assertEqual(response.status_code, 200)
        searches = response.json()["searches"]
        self.assertEqual(searches[0]["job_count"], 1)
        self.assertTrue(searches[0]["has_results"])

    def test_delete_search_history_item_removes_history_and_result_file(self):
        search_id = "job_search_20260629_150000"
        main_api.add_search_to_history(
            search_id=search_id,
            keywords="python实习",
            locations=["武汉"],
            job_type="internship",
            experience_level="entry-level",
            scrapers=["boss"],
            max_jobs=5,
            status="completed",
        )
        result_path = os.path.join(self.temp_dir.name, f"{search_id}.json")
        with open(result_path, "w", encoding="utf-8") as f:
            f.write("[]")

        response = self.client.delete(f"/search/history/{search_id}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["deleted"], 1)
        self.assertFalse(os.path.exists(result_path))
        self.assertEqual(main_api.load_search_history(), [])

    def test_clear_search_history_removes_all_recent_searches(self):
        for index in range(2):
            search_id = f"job_search_20260629_15100{index}"
            main_api.add_search_to_history(
                search_id=search_id,
                keywords="java实习",
                locations=["武汉"],
                job_type="internship",
                experience_level="entry-level",
                scrapers=["boss"],
                max_jobs=5,
                status="completed",
            )
            with open(os.path.join(self.temp_dir.name, f"{search_id}.json"), "w", encoding="utf-8") as f:
                f.write("[]")

        response = self.client.delete("/search/history")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["deleted"], 2)
        self.assertEqual(main_api.load_search_history(), [])

    def test_boss_monitor_tick_saves_results_and_updates_status(self):
        with patch("main_api.run_boss_deepseek_search") as search_boss:
            search_boss.return_value = [
                {
                    "source": "boss",
                    "job_title": "Python Intern",
                    "company_name": "Wuhan AI",
                    "job_location": "Wuhan",
                    "source_url": "https://www.zhipin.com/job_detail/python.html",
                }
            ]

            result = main_api.run_boss_monitor_tick(
                {
                    "keywords": "python",
                    "locations": ["Wuhan"],
                    "job_type": "internship",
                    "experience_level": "entry-level",
                    "max_jobs": 5,
                    "scrapers": ["boss"],
                    "candidate_profile": "Python FastAPI",
                }
            )

        self.assertEqual(result["job_count"], 1)
        self.assertEqual(result["status"], "completed")
        self.assertEqual(main_api.boss_monitor_state["last_search_id"], result["search_id"])
        self.assertEqual(main_api.boss_monitor_state["last_job_count"], 1)
        self.assertTrue(os.path.exists(os.path.join(self.temp_dir.name, f"{result['search_id']}.json")))

        history = main_api.load_search_history()
        self.assertEqual(history[0]["search_id"], result["search_id"])
        self.assertEqual(history[0]["status"], "completed")
        self.assertEqual(history[0]["job_count"], 1)

    def test_boss_monitor_status_endpoint_reports_idle_state(self):
        response = self.client.get("/boss/monitor/status")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["running"])
        self.assertEqual(response.json()["last_job_count"], 0)

    def test_boss_monitor_status_recovers_latest_monitor_batch_from_history(self):
        with open(
            os.path.join(self.temp_dir.name, "boss_monitor_20260703_153000_000000.json"),
            "w",
            encoding="utf-8",
        ) as f:
            f.write("[]")

        main_api.add_search_to_history(
            search_id="job_search_20260703_152900",
            keywords="python",
            locations=["武汉"],
            job_type="internship",
            experience_level="entry-level",
            scrapers=["boss"],
            max_jobs=5,
            status="completed",
        )
        main_api.update_search_status("job_search_20260703_152900", "completed", 5)
        main_api.add_search_to_history(
            search_id="boss_monitor_20260703_153000_000000",
            keywords="python",
            locations=["武汉"],
            job_type="internship",
            experience_level="entry-level",
            scrapers=["boss"],
            max_jobs=5,
            status="completed",
        )
        main_api.update_search_status("boss_monitor_20260703_153000_000000", "completed", 5)

        response = self.client.get("/boss/monitor/status")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["last_search_id"], "boss_monitor_20260703_153000_000000")
        self.assertEqual(body["last_job_count"], 5)
        self.assertEqual(body["keywords"], "python")

    def test_boss_monitor_tick_explains_empty_results_when_automation_is_off(self):
        with patch("main_api.run_boss_deepseek_search", return_value=[]), patch(
            "main_api.is_boss_automation_enabled", return_value=False
        ):
            result = main_api.run_boss_monitor_tick(
                {
                    "keywords": "C# .NET ASP.NET",
                    "locations": ["武汉 东西湖区"],
                    "job_type": "internship",
                    "experience_level": "entry-level",
                    "max_jobs": 5,
                    "scrapers": ["boss"],
                }
            )

        self.assertEqual(result["job_count"], 0)
        self.assertIn("BOSS", main_api.boss_monitor_state["last_error"])
        self.assertIn("not enabled", main_api.boss_monitor_state["last_error"])

    def test_monitor_extension_import_creates_monitor_search(self):
        response = self.client.post(
            "/imports/jobs",
            json={
                "source": "boss_monitor_extension",
                "keywords": "C# .NET",
                "locations": ["武汉"],
                "job_type": "internship",
                "experience_level": "entry-level",
                "max_jobs": 5,
                "jobs": [
                    {
                        "name": "C#开发实习生",
                        "company": "武汉测试科技",
                        "location": "武汉",
                        "salary": "150-200元/天",
                        "link": "https://www.zhipin.com/job_detail/csharp.html",
                    }
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["search_id"].startswith("boss_monitor_"))
        self.assertEqual(body["job_count"], 1)
        self.assertEqual(main_api.load_search_history()[0]["search_id"], body["search_id"])

    def test_imported_job_matching_requires_role_token_not_generic_internship(self):
        job = {
            "source": "boss_import",
            "job_title": "数据分析师实习生",
            "company_name": "多比特",
            "job_location": "武汉",
            "job_description": "实习 4天/周 3个月 本科",
            "tags": ["武汉"],
        }

        self.assertFalse(main_api._job_matches_keyword(job, "Java开发实习生"))
        self.assertFalse(main_api._job_matches_keyword(job, "C# .NET ASP.NET 实习"))


    def test_specific_district_filter_only_keeps_selected_district(self):
        jobs = [
            {
                "source": "boss_import",
                "job_title": "Python\u5b9e\u4e60\u751f",
                "company_name": "\u4e1c\u897f\u6e56\u79d1\u6280",
                "job_location": "\u6b66\u6c49 \u4e1c\u897f\u6e56\u533a",
            },
            {
                "source": "boss_import",
                "job_title": "Python\u5b9e\u4e60\u751f",
                "company_name": "\u6d2a\u5c71\u79d1\u6280",
                "job_location": "\u6b66\u6c49 \u6d2a\u5c71\u533a",
            },
            {
                "source": "boss_import",
                "job_title": "Python\u5b9e\u4e60\u751f",
                "company_name": "\u6b66\u6c49\u79d1\u6280",
                "job_location": "\u6b66\u6c49",
            },
        ]

        filtered = main_api._filter_jobs_for_specific_location(jobs, ["\u6b66\u6c49 \u4e1c\u897f\u6e56\u533a"])

        self.assertEqual([job["company_name"] for job in filtered], ["\u4e1c\u897f\u6e56\u79d1\u6280"])


if __name__ == "__main__":
    unittest.main()
