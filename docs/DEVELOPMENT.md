# Development Guide

This guide reflects the current JobSearch-Agent codebase: FastAPI backend, React/Vite frontend, BOSS browser-side import, local/AI matching, and interview logs.

## Current Entrypoints

- Backend API: `main_api.py`
- Frontend app: `web/`
- BOSS browser helper: `boss-collector-extension/`
- Legacy CLI: `main.py`

Treat `main_api.py` as the supported product entrypoint. `main.py` is legacy CLI code and should not be presented as the primary path.

## Prerequisites

- Python 3.11+
- Node.js 22+
- npm
- uv
- Chromium/Chrome if using BOSS page capture or Playwright-backed flows

## Backend Setup

```bash
uv sync
copy .env.example .env
```

Minimum local `.env`:

```env
ENVIRONMENT=development
API_KEY=dev-local-only-change-me
ALLOWED_ORIGIN=http://127.0.0.1:5173
```

Optional AI settings:

```env
DEEPSEEK_API_KEY=your_deepseek_key_here
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

Start backend:

```bash
uv run uvicorn main_api:app --host 127.0.0.1 --port 8011 --reload
```

Check health:

```bash
curl http://127.0.0.1:8011/health
```

## Frontend Setup

```bash
cd web
npm install
```

Optional `web/.env.local`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8011
VITE_API_KEY=dev-local-only-change-me
```

Start frontend:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## BOSS Import Workflow

1. Log in to BOSS in the browser.
2. Search target roles such as `python intern`, `Java backend intern`, or `AI Agent intern`.
3. Use the extension or collector script to import visible job cards into JobSearch-Agent.
4. Review imported jobs in the recent search panel.
5. Use resume matching, company map links, and interview logs to decide next actions.

BOSS is not treated as a stable public API. It is a browser-side capture layer.

## Verification Commands

Backend focused regressions:

```bash
uv run python -m unittest tests.test_p2_release_readiness tests.test_p1_result_trust tests.test_p0_hardening tests.test_search_history_api tests.test_boss_deepseek_flow
```

Backend compile check:

```bash
uv run python -m py_compile main_api.py src\utils\job_database.py src\utils\job_search_pipeline.py
```

Frontend tests:

```bash
cd web
npm test -- --run
```

Frontend production build:

```bash
cd web
npm run build
```

## CI

`.github/workflows/ci.yml` runs:

- Backend compile and unittest regressions
- Frontend Vitest and production build
- Gitleaks secret scan

`.github/workflows/deploy.yml` is deployment-only. Do not rely on deployment as the first quality gate.

## Environment Variable Groups

Required for production:

- `ENVIRONMENT=production`
- `API_KEY`
- `ALLOWED_ORIGIN`

Required by frontend deployment:

- `VITE_API_BASE_URL`
- `VITE_API_KEY`

Optional AI providers:

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`
- `DEEPSEEK_BASE_URL`
- `AI_PROVIDER`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

Optional browser/import settings:

- `BOSS_AUTOMATION_ENABLED`
- `PLAYWRIGHT_BROWSERS_PATH`

Legacy/optional third-party search settings:

- `LINKEDIN_USERNAME`
- `LINKEDIN_PASSWORD`
- `TAVILY_API_KEY`
- `GLASSDOOR_*`

## Git Hygiene

Do not commit:

- `.env`
- `output/`
- `jobs/*.db`
- `*.log`
- `browser-data/`
- `*.pem`
- `*.crx`
- `web/node_modules/`
- `web/dist/`

Run a local secret scan before public upload when available:

```bash
gitleaks dir . -v
```
