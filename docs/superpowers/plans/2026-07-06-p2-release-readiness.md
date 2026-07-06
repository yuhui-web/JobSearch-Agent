# P2 Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce release and onboarding drift by adding a health endpoint, a CI quality gate, and current documentation.

**Architecture:** Keep runtime behavior unchanged except for a lightweight `/health` endpoint. Update docs to make `main_api.py`, port `8011`, API key auth, BOSS import, and current test commands the single source of truth.

**Tech Stack:** Python 3.11+, FastAPI, unittest, GitHub Actions, Vite/Vitest.

---

### Task 1: Health Endpoint

**Files:**
- Modify: `main_api.py`
- Test: `tests/test_p2_release_readiness.py`

- [ ] **Step 1: Write failing test**

Add a FastAPI test client check for `GET /health` returning `{"status": "ok", "service": "jobsearch-agent", "environment": ...}`.

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run python -m unittest tests.test_p2_release_readiness`

- [ ] **Step 3: Implement minimal endpoint**

Add `@app.get("/health")` near the root endpoint. Do not require API key; this is for Cloud Run and CI health probes.

- [ ] **Step 4: Run targeted test**

Run: `uv run python -m unittest tests.test_p2_release_readiness`

### Task 2: CI Quality Gate

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Add CI workflow**

Add a workflow for PRs and main pushes that runs backend compile/tests, frontend tests/build, and Gitleaks secret scan.

- [ ] **Step 2: Verify workflow file exists**

Run: `Get-Content .github/workflows/ci.yml`

### Task 3: Current Documentation

**Files:**
- Modify: `docs/API.md`
- Modify: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Rewrite API docs**

Replace stale LinkedIn/old-route docs with current FastAPI routes: `/health`, `/search`, `/imports/jobs`, `/boss/monitor/*`, `/search/history`, `/career/analyze`, `/resume/extract`, `/interview-logs`.

- [ ] **Step 2: Rewrite development docs**

Replace old repository URL, old Python version, missing `dev-requirements.txt`, and stale architecture notes with current setup and verification commands.

- [ ] **Step 3: Verify docs mention current commands**

Run: `Select-String -Path docs/API.md,docs/DEVELOPMENT.md -Pattern '8011|X-API-Key|uv run python -m unittest|npm test -- --run'`.

### Task 4: Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run backend targeted tests**

Run: `uv run python -m unittest tests.test_p2_release_readiness tests.test_p1_result_trust tests.test_p0_hardening tests.test_search_history_api tests.test_boss_deepseek_flow`

- [ ] **Step 2: Run frontend tests and build**

Run: `npm test -- --run` and `npm run build` in `web/`.

- [ ] **Step 3: Compile changed backend files**

Run: `uv run python -m py_compile main_api.py src\utils\job_database.py src\utils\job_search_pipeline.py`.
