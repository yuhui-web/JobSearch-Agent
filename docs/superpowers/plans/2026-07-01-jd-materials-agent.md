# JD Materials Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn pasted job descriptions into a complete candidate action pack: match score, skill gaps, resume rewrite bullets, self-introduction, and interview questions.

**Architecture:** Keep the existing `/boss/analyze-text` API and enrich the DeepSeek analysis schema. The backend asks DeepSeek for additional structured fields, and the React analyzer renders each section as a readable action pack.

**Tech Stack:** FastAPI, Python DeepSeek client, React, TypeScript, Vitest, unittest.

---

### Task 1: Lock The Output Contract

**Files:**
- Modify: `tests/test_boss_deepseek_flow.py`
- Modify: `web/src/components/BossTextAnalyzer.test.tsx`

- [x] **Step 1: Write failing backend and frontend tests**

Backend test asserts `/boss/analyze-text` returns `skill_gaps`, `resume_rewrite_bullets`, `self_introduction`, and `interview_questions`.

Frontend test asserts the analyzer renders these sections after a pasted JD analysis.

- [x] **Step 2: Verify red state**

Run backend focused test and frontend focused test. Backend mock passthrough passes; frontend fails because new fields are not rendered yet.

### Task 2: Extend The DeepSeek Schema

**Files:**
- Modify: `src/utils/deepseek_client.py`
- Modify: `web/src/api.ts`

- [ ] **Step 1: Add schema fields to DeepSeek prompt and fallback values**

`analyze_job` should request `resume_rewrite_bullets` and `self_introduction`.

- [ ] **Step 2: Add TypeScript fields**

`SearchResultJob.ai_analysis` should include `resume_rewrite_bullets?: string[]` and `self_introduction?: string`.

### Task 3: Render The Candidate Action Pack

**Files:**
- Modify: `web/src/components/BossTextAnalyzer.tsx`

- [ ] **Step 1: Render skill gaps**

Show `analysis.skill_gaps` under a clear "缺少技能" section.

- [ ] **Step 2: Render resume rewrite bullets**

Show `analysis.resume_rewrite_bullets` under "定制简历要点".

- [ ] **Step 3: Render self introduction**

Show `analysis.self_introduction` under "自我介绍".

### Task 4: Verify Full Flow

**Files:**
- Test only.

- [ ] **Step 1: Run backend tests**

Run `.venv\Scripts\python.exe -m unittest tests.test_boss_deepseek_flow tests.test_search_history_api`.

- [ ] **Step 2: Run frontend tests and build**

Run `npm test -- src/components/BossTextAnalyzer.test.tsx src/components/JobSearchPanel.test.tsx`, `npx tsc -p . --noEmit`, and `npm run build`.
