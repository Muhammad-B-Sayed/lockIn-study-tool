# LockIn frontend

React client for a study workspace built around courses, topics, deadlines, review, and focus sessions. Today, course coverage, topic notes and links, week/month calendars, syllabus import, and command-palette quick add all use the same workspace data. Confidence ratings are self-reported and can be undone.

For the full stack setup, see the root [README.md](../README.md).

## Run locally

Use Node.js 20.19+ or 22.12+.

```bash
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. Choose **Try the demo** to work without a backend or account. The relative-date seed includes active and archived courses, topic notes and resources, assessments, personal events, review history, and study sessions.

Demo edits persist in this browser under `lockin.demo.v1`. The session uses `lockin.session.v1`, and the theme uses `lockin.theme`. Signing out preserves demo edits. Settings can reset the demo or export the workspace as JSON. Account mode stores study data in the backend instead.

## Backend connection

`VITE_API_BASE_URL` is a public build-time setting. The data adapter supports these forms:

| Setting | Workspace request |
| --- | --- |
| Unset, empty, or `/api` | `/api/workspace` on the frontend origin |
| `https://YOUR-BACKEND.onrender.com` | `https://YOUR-BACKEND.onrender.com/api/workspace` |
| `https://YOUR-BACKEND.onrender.com/api` | `https://YOUR-BACKEND.onrender.com/api/workspace` |

Trailing slashes are normalized. Existing deployments that used an absolute backend URL ending in `/api` remain compatible.

During local development, the Vite proxy forwards same-origin `/api` requests to `http://localhost:8080`. Alternatively, copy `.env.example` to `.env.local`; its direct-backend setting is `VITE_API_BASE_URL=http://localhost:8080/api`. The Docker frontend uses Nginx to proxy `/api` to the backend container.

For Vercel, use `frontend/` as the project root, `npm run build`, and output directory `dist`. Set `VITE_API_BASE_URL` to the absolute Render API URL in each Vercel environment that needs account mode, then rebuild. The backend must allow the frontend origin through `FRONTEND_ORIGINS`.

`vercel.json` keeps SPA deep links working by rewriting routes to `/index.html`. It does not proxy `/api` to Render. Leaving the API base relative on a static Vercel deployment will therefore not connect account mode to the backend. Demo mode does not require that connection. The app pings `/api/health` on startup to begin waking a sleeping backend.

## CI checks

Run the same frontend commands as CI:

```bash
npm run lint
npm test
npm run build
```

The build includes TypeScript checking and writes the production app to `dist/`. `npm run preview` serves that build locally.

## Screenshots

Install the Chromium browser once, then capture the configured screens:

```bash
npx playwright install chromium
npm run shots
```

The script builds once and captures light and dark themes at 1440×900 and 390×844. Each screen gets isolated demo storage. Output is `.shots/<theme>/<width>/<screen>.png`. Routes and interaction states are configured in `scripts/screens.mjs` and shared with the accessibility audit.

For a smaller batch or an existing build:

```bash
npm run shots -- --only=today,calendar --theme=dark --width=390
npm run shots -- --no-build
```

## Accessibility audit

```bash
npm run a11y
```

The axe audit uses the same isolated demo screens, themes, and viewports as screenshots. It writes `.shots/a11y-summary.json` and `.shots/a11y-summary.md`, with confirmed violations, incomplete checks requiring review, failed scans, and contrast measurements grouped by component class and theme. Decorative overlays are hidden only in audit pages so axe can measure underlying colors.

The default command reports findings without failing the process. For an exit code that fails on violations or failed scans:

```bash
npm run a11y -- --strict
```

Audit filters also accept `--only=`, `--theme=`, `--width=`, and `--no-build`. Both review tools close their browser and preview server when finished. Automated checks supplement keyboard and screen-reader review.

## Code contracts

- [Data adapters, provider, and hooks](src/lib/data/README.md)
- [Dates, ranking, parsers, coverage, and streak](src/lib/domain/API.md)
- [Product and API plan](../docs/redesign-plan.md)
