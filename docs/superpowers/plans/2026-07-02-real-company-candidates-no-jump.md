# Real Company Candidates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When BOSS automation is off, generate visible company-backed job candidates instead of empty zero-result cards, without auto-opening or redirecting to BOSS.

**Architecture:** Keep strict BOSS automation opt-in. Add a non-BOSS candidate path that uses observed company data and attaches platform/Amap verification links. The UI continues to show result cards, and each card is labeled as a company/search candidate rather than a scraped BOSS detail.

**Tech Stack:** FastAPI backend, Python unittest, React/Vitest frontend.

---

### Task 1: Backend Candidate Fallback Without Browser Jump

**Files:**
- Modify: `main_api.py`
- Test: `tests/test_boss_deepseek_flow.py`

- [ ] Add a test proving `build_fast_boss_candidates` returns company-backed candidates when BOSS automation is off and web search returns no cards.
- [ ] Implement fallback to `build_legacy_candidate_jobs` only when automation is off.
- [ ] Keep automation-on behavior strict: if BOSS is enabled and blocked, do not invent fallback unless explicitly disabled.
- [ ] Verify with backend tests.

### Task 2: UI Copy Consistency

**Files:**
- Modify: `web/src/components/SearchHistoryPanel.tsx` if needed.
- Test: `web/src/components/JobSearchPanel.test.tsx` if labels change.

- [ ] Ensure empty copy no longer promises candidates when strict mode returns none.
- [ ] Keep platform-search and Amap buttons visible for candidate cards.
- [ ] Verify frontend tests.
