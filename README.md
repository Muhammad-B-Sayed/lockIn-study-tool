# LockIn study tool

LockIn turns a syllabus into a study plan. Organize courses and topics, keep notes and resource links, plan study blocks, track deadlines, and work through a review queue based on self-reported confidence. Focus sessions log study time and end with an optional confidence check-in.

## Try the demo

The demo runs entirely in the browser. No account or backend is needed.

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173` and choose **Try the demo**. It starts with realistic courses, topics, deadlines, review history, and study sessions. Changes stay in this browser's local storage. Signing out keeps the demo data; Settings offers a reset and JSON export.

## What the app does

- Today shows planned study, upcoming deadlines, and topics due for review.
- Courses contain syllabus-ordered topics, confidence coverage, and assessments. Syllabus import creates editable topic and deadline drafts.
- Topics hold notes, links, study plans, and confidence history. Review ratings have undo.
- The calendar has week and month views, movable topic plans, fixed deadlines, and personal events.
- The focus timer logs study sessions. A command palette supports search and quick add.
- Light, dark, and system themes work across desktop and mobile layouts.
- Account mode uses JWT authentication and PostgreSQL persistence. Settings supports password changes, account deletion, and JSON export.

## Stack and layout

- `backend/`: Java 21, Spring Boot 3, Spring Security, Flyway, and PostgreSQL 16.
- `frontend/`: React 19, TypeScript, Vite, TanStack Query, Vitest, and Playwright.
- `scripts/`: setup, local development, and repository checks.
- `.github/workflows/ci.yml`: backend tests, frontend checks, and container builds.

## Run the full local app

Use Java 21+ and Node.js 20.19+ or 22.12+. The local database scripts need `initdb`, `pg_ctl`, `pg_isready`, `psql`, and `createdb`. Docker Compose is an alternative if those tools are unavailable.

```bash
make bootstrap
make dev
```

This starts PostgreSQL on `localhost:55432`, the backend on `http://localhost:8080`, and the frontend on `http://127.0.0.1:5173`. Run `make stop` to stop the managed backend and database. Frontend-only development is available through `make dev-frontend`; backend-only development through `make dev-backend`.

## Checks and review tools

The frontend CI checks are:

```bash
cd frontend
npm run lint
npm test
npm run build
```

For screenshots and the accessibility audit, install Playwright Chromium once:

```bash
npx playwright install chromium
npm run shots
npm run a11y
```

Both tools build once, start an isolated local preview, and use seeded demo data across the configured screens, light and dark themes, and desktop and mobile widths. They close their browser and preview when finished. Screenshots and accessibility reports go in `frontend/.shots/`. The audit's default report mode exits successfully even when it finds violations; `npm run a11y -- --strict` fails for violations or failed scans. See [frontend/README.md](frontend/README.md) for filters and report details.

`make test` runs the repository checks. `make build` builds both apps. `make docker-up` starts the container stack, with the frontend at `http://localhost:4173`, backend at `http://localhost:8080`, and database on port `55432`.

## Deployment

Vercel serves the frontend with `frontend/` as the project root, `npm run build` as the build command, and `dist` as the output directory. `frontend/vercel.json` rewrites SPA routes to `/index.html`, so direct links such as `/app/review` load the app.

For account mode on Vercel, set the build-time `VITE_API_BASE_URL` to the absolute Render backend URL, for example `https://YOUR-BACKEND.onrender.com/api`. The existing `/api` suffix is supported; using just the backend origin also works. Rebuild after changing the variable. Allow the Vercel frontend origin in the backend's `FRONTEND_ORIGINS` setting.

An unset, empty, or `/api` base uses same-origin `/api` requests. This works through the Vite development proxy or the container's Nginx proxy. The Vercel SPA rewrite does not proxy requests to Render, so same-origin API URLs alone do not connect a static Vercel deployment to the backend. Demo mode remains local.

`render.yaml` describes the backend service. The Dockerfiles package both apps, and `docker-compose.yml` runs them together.

## Further documentation

- [Backend setup and API](backend/README.md)
- [Frontend setup and review scripts](frontend/README.md)
- [Frontend data API](frontend/src/lib/data/README.md)
- [Domain API](frontend/src/lib/domain/API.md)
- [Redesign plan](docs/redesign-plan.md)
