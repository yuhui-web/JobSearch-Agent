# AI Search Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make resume upload and job type actively drive job search planning, so keywords represent the desired job title and DeepSeek helps choose suitable search entries.

**Architecture:** Add an AI planning step before smart search job generation. `DeepSeekClient` produces normalized search titles from keyword, city, job type, experience level, and resume; `boss_scraper` turns those plans into BOSS search links and then runs fit analysis.

**Tech Stack:** Python FastAPI backend, DeepSeek OpenAI-compatible chat completions, existing unittest suite, React frontend consuming unchanged search APIs.

---

### Task 1: Add Planner Tests

**Files:**
- Modify: `tests/test_boss_deepseek_flow.py`

- [ ] **Step 1: Write failing tests**

Add tests that prove `全栈` produces full-stack internship search entries and that the DeepSeek planner can parse JSON.

- [ ] **Step 2: Run backend tests**

Run: `.venv\Scripts\python.exe -m unittest tests.test_boss_deepseek_flow`

Expected: FAIL because `DeepSeekClient.plan_job_search` and planner-aware smart search do not exist yet.

### Task 2: Implement DeepSeek Search Planning

**Files:**
- Modify: `src/utils/deepseek_client.py`

- [ ] **Step 1: Add `plan_job_search`**

The method accepts keyword, locations, job type, experience level, candidate profile, and max jobs. It asks DeepSeek for JSON search entries and falls back to deterministic entries when the model is unavailable.

- [ ] **Step 2: Run focused tests**

Run: `.venv\Scripts\python.exe -m unittest tests.test_boss_deepseek_flow`

Expected: Remaining failures only in smart search wiring.

### Task 3: Wire Planner Into Smart Search

**Files:**
- Modify: `src/scraper/search/boss_scraper.py`
- Modify: `main_api.py`

- [ ] **Step 1: Let `build_smart_search_jobs` consume AI plans**

Use AI search plans when provided. Fall back to templates only when the planner is unavailable.

- [ ] **Step 2: Pass job type and experience level from API to search pipeline**

`run_boss_deepseek_search` receives `job_type` and `experience_level`, calls `DeepSeekClient.plan_job_search`, then generates jobs and runs `analyze_job`.

- [ ] **Step 3: Run regression tests**

Run: `.venv\Scripts\python.exe -m unittest tests.test_boss_deepseek_flow tests.test_search_history_api`

Expected: PASS.

### Task 4: Verify Frontend Contract Still Works

**Files:**
- Test only: `web/src/components/JobSearchPanel.test.tsx`

- [ ] **Step 1: Run frontend checks**

Run: `npm test -- src/components/JobSearchPanel.test.tsx src/components/BossTextAnalyzer.test.tsx`

Expected: PASS because the API contract remains unchanged.

- [ ] **Step 2: Run build checks**

Run: `npx tsc -p . --noEmit` and `npm run build`

Expected: PASS.
