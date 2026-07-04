# Resume Career Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the JD-only BOSS analyzer with a resume-first career matching center that recommends suitable job/company candidates, missing experience, learning resources, and hot market requirements.

**Architecture:** Add a `/career/analyze` endpoint that accepts resume text, target role, job type, experience level, city, and optional requirement snippets. It reuses observed company candidates for recommendation and DeepSeek for structured career advice, with deterministic fallback sections when the model is unavailable.

**Tech Stack:** FastAPI, DeepSeek OpenAI-compatible API, React, Vitest, unittest.

---

### Task 1: Backend Career Analysis Endpoint

**Files:**
- Modify: `main_api.py`
- Modify: `src/utils/deepseek_client.py`
- Test: `tests/test_boss_deepseek_flow.py`

- [x] **Step 1: Add failing backend test**

Require `/career/analyze` to return `recommended_jobs`, `career_analysis.skill_gaps`, `career_analysis.learning_plan`, and `career_analysis.hot_requirements`.

- [x] **Step 2: Implement request/response flow**

Add `CareerAnalyzeRequest`, call observed company matcher, and call DeepSeek career analysis.

- [x] **Step 3: Add deterministic fallback**

When DeepSeek is unavailable, still return actionable gaps and learning platform search keywords.

### Task 2: Frontend Career Matching Center

**Files:**
- Modify: `web/src/api.ts`
- Modify: `web/src/components/BossTextAnalyzer.tsx`
- Modify: `web/src/components/BossTextAnalyzer.test.tsx`

- [x] **Step 1: Add failing UI test**

Require the component heading to be `简历岗位匹配分析`, and require submit to call `analyzeCareerFit`.

- [x] **Step 2: Replace JD-only form**

Use resume, target role, city, job type, experience level, and optional requirement snippets as inputs.

- [x] **Step 3: Render recommendation report**

Show recommended companies, match reasons, missing skills, learning plan, hot requirements, resume fixes, and platform keywords.

### Task 3: Verification

**Files:**
- Test: backend and frontend test suites

- [x] **Step 1: Run backend tests**

`.\.venv\Scripts\python.exe -m unittest tests.test_boss_deepseek_flow`

- [x] **Step 2: Run frontend tests and build**

`npm test -- src/components/BossTextAnalyzer.test.tsx`
`npx tsc -p . --noEmit`
`npm run build`
