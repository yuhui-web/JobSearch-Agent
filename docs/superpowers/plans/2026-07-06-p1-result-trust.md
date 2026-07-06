# P1 Result Trust Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make imported/search results trustworthy by preventing stale local samples from padding live searches and by fixing database add/duplicate feedback semantics.

**Architecture:** Keep the current FastAPI + SQLite structure. Apply focused changes to result-source selection and database write feedback without restructuring the large API module.

**Tech Stack:** Python 3.11+, FastAPI, SQLite, unittest.

---

### Task 1: Database Add Feedback Semantics

**Files:**
- Modify: `src/utils/job_database.py`
- Test: `tests/test_p1_result_trust.py`

- [ ] **Step 1: Write failing test**

Add a test that inserts the same job twice and expects first feedback action `added_to_database`, second feedback action `already_existed`.

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run python -m unittest tests.test_p1_result_trust`

- [ ] **Step 3: Implement minimal fix**

Change `add_job()` to return an operation status string: `inserted`, `duplicate`, `invalid`, or `failed`. Update `add_job_with_immediate_feedback()` to map that status to user-facing feedback.

- [ ] **Step 4: Run targeted test**

Run: `uv run python -m unittest tests.test_p1_result_trust`

### Task 2: Strict Real Candidate Source Selection

**Files:**
- Modify: `main_api.py`
- Test: existing `tests/test_boss_deepseek_flow.py`

- [ ] **Step 1: Reproduce existing failures**

Run: `uv run python -m unittest tests.test_boss_deepseek_flow.BossDeepSeekFlowTests.test_fast_candidates_do_not_fallback_to_generated_company_candidates tests.test_boss_deepseek_flow.BossDeepSeekFlowTests.test_strict_real_search_keeps_only_live_sources`

- [ ] **Step 2: Implement minimal fix**

Make `build_fast_boss_candidates()` use live BOSS/web search as the strict path. Only use recent imported jobs when no explicit web/live search source is being exercised, and never top off strict live results with observed samples or generated candidates.

- [ ] **Step 3: Run focused tests**

Run the four failing fast-candidate tests from `tests.test_boss_deepseek_flow`.

### Task 3: Pipeline Result Shape

**Files:**
- Modify: `src/utils/job_search_pipeline.py`
- Test: `tests/test_p1_result_trust.py`

- [ ] **Step 1: Write failing test**

Add a test with a fake scraper and fake DB asserting `search_jobs()` returns real job dictionaries, not `{"saved": True}` placeholders.

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run python -m unittest tests.test_p1_result_trust`

- [ ] **Step 3: Implement minimal fix**

Append successfully scraped `job_details` to `location_results` even when a DB is present, and remove placeholder result generation.

- [ ] **Step 4: Run targeted test**

Run: `uv run python -m unittest tests.test_p1_result_trust`
