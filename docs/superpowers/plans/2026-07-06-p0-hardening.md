# P0 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the P0 security and data-consistency risks identified in the JobSearch-Agent review.

**Architecture:** Keep the current FastAPI + React architecture intact. Apply narrow fixes to API security defaults, frontend request authentication, search-history persistence, and duplicated location-filter helpers without broad refactors.

**Tech Stack:** Python 3.11+, FastAPI, pytest/unittest, React/Vite, Vitest, Axios.

---

### Task 1: Backend CORS Defaults

**Files:**
- Modify: `main_api.py`
- Test: `tests/test_p0_hardening.py`

- [ ] **Step 1: Write failing test**

Add a test that imports `main_api` with `ALLOWED_ORIGIN` unset and asserts the CORS middleware does not default to wildcard origins and does not enable credentialed browser requests.

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run python -m unittest tests.test_p0_hardening`

- [ ] **Step 3: Implement minimal fix**

Parse `ALLOWED_ORIGIN` as comma-separated origins, default to local frontend origins, reject wildcard in production, and set `allow_credentials=False`.

- [ ] **Step 4: Run targeted test**

Run: `uv run python -m unittest tests.test_p0_hardening`

### Task 2: Search History Atomic Persistence

**Files:**
- Modify: `main_api.py`
- Test: `tests/test_p0_hardening.py`

- [ ] **Step 1: Write failing test**

Add a test that calls `save_search_history()` and verifies the file is replaced through `os.replace`, showing writes are atomic rather than direct truncating writes.

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run python -m unittest tests.test_p0_hardening`

- [ ] **Step 3: Implement minimal fix**

Add a module-level re-entrant lock and write history to a temp file in `output_dir`, then atomically replace `search_history_file`.

- [ ] **Step 4: Run targeted test**

Run: `uv run python -m unittest tests.test_p0_hardening`

### Task 3: Remove Duplicate District Helper Definitions

**Files:**
- Modify: `main_api.py`
- Test: `tests/test_p0_hardening.py`

- [ ] **Step 1: Write failing test**

Add a source-level regression test asserting `_has_specific_district` and `_filter_jobs_for_specific_location` are each defined only once.

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run python -m unittest tests.test_p0_hardening`

- [ ] **Step 3: Implement minimal fix**

Delete the older duplicate definitions and preserve the newer `_extract_requested_districts()` based implementation.

- [ ] **Step 4: Run targeted test**

Run: `uv run python -m unittest tests.test_p0_hardening`

### Task 4: Frontend Unified API Key Header

**Files:**
- Modify: `web/src/api.ts`
- Test: `web/src/api.test.ts`

- [ ] **Step 1: Write failing test**

Add or update a Vitest case that calls representative API functions and asserts every Axios request includes `X-API-Key`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/api.test.ts`

- [ ] **Step 3: Implement minimal fix**

Create a shared Axios client or helper so all API calls include the same `X-API-Key` header without duplicating headers per function.

- [ ] **Step 4: Run frontend targeted test**

Run: `npm test -- --run src/api.test.ts`

### Task 5: Verification

**Files:**
- Verify backend and frontend only.

- [ ] **Step 1: Run backend tests**

Run: `uv run python -m unittest tests.test_p0_hardening tests.test_search_history_api tests.test_boss_deepseek_flow`

- [ ] **Step 2: Run frontend tests**

Run: `npm test -- --run`

- [ ] **Step 3: Run frontend build**

Run: `npm run build`
