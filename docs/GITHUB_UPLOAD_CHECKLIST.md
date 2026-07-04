# GitHub Upload Checklist

Use this checklist before pushing the project to GitHub or deploying it online.

## Safe to Commit

- Backend source code: `main_api.py`, `src/`
- Frontend source code: `web/src/`, `web/public/`, `web/package.json`, `web/package-lock.json`
- Tests: `tests/`
- Documentation: `README.md`, `DEPLOYMENT.md`, `docs/`
- Example environment file: `.env.example`

## Do Not Commit

- Real `.env` files
- Runtime output: `output/`
- Local databases: `jobs/*.db`, `*.sqlite`, `*.sqlite3`
- Logs: `*.log`
- Browser session data: `browser-data/`
- Browser extension private keys or packages: `*.pem`, `*.crx`
- Frontend dependencies or build artifacts: `web/node_modules/`, `web/dist/`

## Required Production Environment Variables

- `ENVIRONMENT=production`
- `API_KEY=<strong-random-api-key>`
- `ALLOWED_ORIGIN=<your-frontend-origin>`
- `VITE_API_BASE_URL=<your-backend-api-url>`
- `VITE_API_KEY=<same-value-as-api-key>`

## Deployment Notes

- The backend is a FastAPI app and can be deployed with the included `Dockerfile`.
- The frontend needs a real backend URL in `VITE_API_BASE_URL`; a static-only GitHub Pages deployment will not be enough for the full app.
- BOSS job capture depends on a user's browser/login context, so treat it as a local assistive sync feature instead of a guaranteed cloud scraper.
