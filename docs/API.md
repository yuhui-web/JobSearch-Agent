# JobSearch-Agent API

This document describes the current FastAPI surface used by the React console and BOSS import helper.

## Server

Recommended backend entrypoint:

```bash
uvicorn main_api:app --host 127.0.0.1 --port 8011 --reload
```

Interactive docs:

- Swagger UI: `http://127.0.0.1:8011/docs`
- ReDoc: `http://127.0.0.1:8011/redoc`
- Health check: `http://127.0.0.1:8011/health`

## Authentication

Most product APIs use `X-API-Key`.

Development default:

```env
ENVIRONMENT=development
API_KEY=dev-local-only-change-me
ALLOWED_ORIGIN=http://127.0.0.1:5173
```

Production must set a strong `API_KEY`. The backend refuses to start in production with the development key.

Frontend requests should use:

```env
VITE_API_BASE_URL=http://127.0.0.1:8011
VITE_API_KEY=dev-local-only-change-me
```

## Health

```http
GET /health
```

Response:

```json
{
  "status": "ok",
  "service": "jobsearch-agent",
  "environment": "development"
}
```

## Job Search

```http
POST /search
X-API-Key: <api-key>
```

Request:

```json
{
  "keywords": "python agent intern",
  "locations": ["Wuhan"],
  "job_type": "internship",
  "experience_level": "entry-level",
  "max_jobs": 5,
  "scrapers": ["boss"],
  "candidate_profile": "Python, FastAPI, MySQL"
}
```

Response:

```json
{
  "search_id": "job_search_20260706_120000",
  "status": "Job search started",
  "job_count": 3
}
```

Get search results:

```http
GET /search/{search_id}
X-API-Key: <api-key>
```

## Search History

```http
GET /search/history?limit=20
X-API-Key: <api-key>
```

```http
DELETE /search/history/{search_id}
X-API-Key: <api-key>
```

```http
DELETE /search/history
X-API-Key: <api-key>
```

Search history is stored in `output/search_history.json` with locked atomic writes.

## BOSS Page Import

The project treats BOSS as a browser-side capture source, not a stable public API.

Import visible jobs from a logged-in BOSS page:

```http
POST /imports/jobs
X-API-Key: <api-key>
```

Request:

```json
{
  "keywords": "python",
  "locations": ["Wuhan Jiangxia"],
  "job_type": "internship",
  "experience_level": "entry-level",
  "max_jobs": 15,
  "candidate_profile": "Python FastAPI MySQL",
  "jobs": [
    {
      "name": "Python Intern",
      "company": "Example AI",
      "location": "Wuhan Jiangxia",
      "salary": "150-200/day",
      "link": "https://www.zhipin.com/job_detail/example.html"
    }
  ]
}
```

Fetch page-side collector script:

```http
GET /imports/boss-collector.js
X-API-Key: <api-key>
```

## BOSS Monitor

```http
GET /boss/monitor/status
X-API-Key: <api-key>
```

```http
POST /boss/monitor/start
X-API-Key: <api-key>
```

```http
POST /boss/monitor/stop
X-API-Key: <api-key>
```

The monitor reuses the search/import pipeline and pushes new monitor searches into recent search history.

## Resume And Career Analysis

Extract resume text:

```http
POST /resume/extract
X-API-Key: <api-key>
```

Analyze one BOSS text block:

```http
POST /boss/analyze-text
X-API-Key: <api-key>
```

Analyze career fit:

```http
POST /career/analyze
X-API-Key: <api-key>
```

## Interview Logs

```http
GET /interview-logs
X-API-Key: <api-key>
```

```http
POST /interview-logs
X-API-Key: <api-key>
```

```http
GET /interview-logs/stats
X-API-Key: <api-key>
```

Use this module to record rejection reasons, follow-up actions, and interview learning loops.
