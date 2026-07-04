# Real Company Job Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the search flow return real company-name job candidates and make JD analysis consistently render all promised sections.

**Architecture:** Keep BOSS live scraping as the first option when explicitly enabled. When live BOSS is blocked or disabled, use an observed Wuhan job candidate pool with real company names, ranked by keyword, job type, experience level, resume text, and DeepSeek search plan, instead of showing platform placeholder companies.

**Tech Stack:** Python FastAPI backend, DeepSeek OpenAI-compatible API, React frontend, unittest/Vitest.

---

### Task 1: Real Company Candidate Fallback

**Files:**
- Modify: `src/scraper/search/boss_scraper.py`
- Test: `tests/test_boss_deepseek_flow.py`

- [x] **Step 1: Write failing tests**

Added tests that require default search to return `observed_boss` jobs with real company names and prevent Python internship searches from expanding into Agent roles.

- [x] **Step 2: Add observed job pool**

Create `OBSERVED_WUHAN_JOBS` with real company names already seen in user screenshots: 万域动力、可循智能、广置科技、武汉魅鑫信息技术、大晟极、准星科技、微派、领铄智能科技、岚图汽车.

- [x] **Step 3: Rank candidates**

Implement a scorer that combines requested keywords, DeepSeek plan titles/tags, resume terms, location, job type, and experience requirements.

- [x] **Step 4: Replace default fallback**

Use observed candidates before `smart_search`; keep `smart_search` only as an explicit last-resort search-entry fallback.

### Task 2: Stable JD Analysis Sections

**Files:**
- Modify: `src/utils/deepseek_client.py`
- Test: `tests/test_boss_deepseek_flow.py`

- [x] **Step 1: Write failing test**

Added a test that simulates DeepSeek omitting fields and requires all frontend sections to receive stable types.

- [x] **Step 2: Normalize model output**

Add `_normalize_analysis` to ensure `skill_gaps`, `resume_tips`, `resume_rewrite_bullets`, `self_introduction`, and `interview_questions` always exist.

- [x] **Step 3: Strengthen prompt**

Require arrays to contain concrete items whenever resume and JD have enough information.

### Task 3: Frontend Labels

**Files:**
- Modify: `web/src/components/SearchHistoryPanel.tsx`
- Test: `web/src/components/JobSearchPanel.test.tsx`

- [x] **Step 1: Update source labels**

Show `observed_boss` as `已采集样本`, `boss` as `BOSS 实时`, and reserve `smart_search` for `搜索入口`.

- [x] **Step 2: Verify UI tests**

Run component tests and TypeScript build.
