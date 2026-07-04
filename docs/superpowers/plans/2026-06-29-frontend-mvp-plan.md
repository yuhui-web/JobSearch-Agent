# Frontend MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a small, usable frontend MVP for the job-search product that lets the user search jobs, record interview failure reasons, and review summary stats in one place.

**Architecture:** Keep the backend as the source of truth and add a lightweight React frontend that only consumes the existing FastAPI endpoints. The UI should be split into focused sections: search, interview log entry, log history, and stats, with a tiny API client in between so the pages stay simple and testable.

**Tech Stack:** React, Vite, TypeScript, `axios`, FastAPI backend already in repo, existing SQLite-backed API.

---

### Task 1: Create the frontend app scaffold

**Files:**
- Create: `web/package.json`
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/tsconfig.json`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `web/src/styles.css`
- Create: `web/src/App.test.tsx`
- Create: `web/src/api.ts`

- [ ] **Step 1: Write the failing test**

Create a very small app-level smoke test that imports `App` and asserts the interview log section label renders.

```ts
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders interview log section', () => {
  render(<App />);
  expect(screen.getByText('Interview Log Manager')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` from `web`

Expected: FAIL because the frontend app and test harness do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create a Vite React shell that renders `App` with a placeholder `Interview Log Manager` heading and a shared API base URL constant.

```tsx
export default function App() {
  return <h1>Interview Log Manager</h1>;
}
```

```ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` from `web`

Expected: PASS for the smoke test.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat: add frontend app scaffold"
```

### Task 2: Add a reusable API client for jobs and interview logs

**Files:**
- Create: `web/src/api.ts`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`
- Test: `web/src/api.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests for the API helper functions that call the backend routes already implemented in FastAPI.

```ts
import { fetchInterviewLogs, fetchInterviewStats, createInterviewLog } from './api';

test('builds interview log endpoints', async () => {
  // use fetch mock here
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run npm test -- --runInBand web/src/api.test.ts`

Expected: FAIL because the helper functions do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement `fetchInterviewLogs`, `fetchInterviewStats`, and `createInterviewLog` with `axios` against:
- `GET /interview-logs`
- `GET /interview-logs/stats`
- `POST /interview-logs`

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run npm test -- --runInBand web/src/api.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/api.ts web/src/api.test.ts web/src/App.tsx web/src/styles.css
git commit -m "feat: add api client for interview logs"
```

### Task 3: Build the interview log dashboard

**Files:**
- Create: `web/src/components/InterviewLogManager.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`
- Test: `web/src/components/InterviewLogManager.test.tsx`

- [ ] **Step 1: Write the failing test**

Test that the page shows:
- a form with job title, company name, outcome, failure reason, notes, next action
- a stats card
- a log list

```tsx
render(<InterviewLogManager />);
expect(screen.getByLabelText('Job title')).toBeInTheDocument();
expect(screen.getByText('Interview Stats')).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run npm test -- --runInBand web/src/components/InterviewLogManager.test.tsx`

Expected: FAIL because the component does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement a single component that:
- loads logs on mount
- posts new logs on submit
- reloads after save
- renders summary stats and recent logs

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run npm test -- --runInBand web/src/components/InterviewLogManager.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/InterviewLogManager.tsx web/src/components/InterviewLogManager.test.tsx web/src/App.tsx web/src/styles.css
git commit -m "feat: add interview log dashboard"
```

### Task 4: Add the job search panel and search history view

**Files:**
- Create: `web/src/components/JobSearchPanel.tsx`
- Create: `web/src/components/SearchHistoryPanel.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`
- Test: `web/src/components/JobSearchPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Test that the job search form includes:
- keywords
- location
- job type
- experience level
- max jobs
- search button

```tsx
render(<JobSearchPanel />);
expect(screen.getByLabelText('Keywords')).toBeInTheDocument();
expect(screen.getByRole('button', { name: /search jobs/i })).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run npm test -- --runInBand web/src/components/JobSearchPanel.test.tsx`

Expected: FAIL because the component does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement a panel that calls the existing `/search` flow and shows returned jobs in a compact card list.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run npm test -- --runInBand web/src/components/JobSearchPanel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/JobSearchPanel.tsx web/src/components/SearchHistoryPanel.tsx web/src/components/JobSearchPanel.test.tsx web/src/App.tsx web/src/styles.css
git commit -m "feat: add job search panel"
```

### Task 5: Polish the layout and connect the sections into one product page

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`
- Modify: `web/src/main.tsx`
- Modify: `web/vite.config.ts`

- [ ] **Step 1: Write the failing test**

Add a layout-level test that checks the page renders the three sections together:
- job search
- interview log manager
- history/stats

```tsx
render(<App />);
expect(screen.getByText('Job Search')).toBeInTheDocument();
expect(screen.getByText('Interview Log Manager')).toBeInTheDocument();
expect(screen.getByText('Search History')).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run npm test -- --runInBand web/src/App.test.tsx`

Expected: FAIL until the layout is wired up.

- [ ] **Step 3: Write minimal implementation**

Compose the page with a simple grid:
- left column for search
- right column for interview logs and stats
- bottom area for history

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run npm test -- --runInBand web/src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/App.tsx web/src/main.tsx web/src/styles.css web/vite.config.ts
git commit -m "feat: polish frontend mvp layout"
```

### Task 6: Verify end-to-end behavior against the FastAPI backend

**Files:**
- Modify: `web/src/api.ts`
- Modify: `web/src/components/*.tsx`
- Optional: `main_api.py` only if a missing frontend-friendly endpoint is discovered

- [ ] **Step 1: Write the failing test**

Run an integration test that mounts the React page against mocked backend responses for:
- `GET /interview-logs`
- `GET /interview-logs/stats`
- `POST /interview-logs`

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run npm test -- --runInBand`

Expected: FAIL if any UI field names or API payloads are inconsistent.

- [ ] **Step 3: Write minimal implementation**

Fix the client/server contract only where needed. Avoid expanding scope.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run npm test -- --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web main_api.py
git commit -m "feat: verify frontend and backend integration"
```

## Self-Review Notes

- The plan covers the three user-visible product areas: search, log, and history/stats.
- The backend interview log APIs already exist, so the frontend can stay thin.
- No task introduces a second backend or a large refactor.
- The app should remain useful even if job scraping is noisy, because the interview log loop is independent and valuable on its own.
