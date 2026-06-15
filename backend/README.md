# LockIn Backend

API and persistence services for the LockIn workspace.

For the full project setup flow, start with the root [README.md](/Users/muhammad/Random_Projects/Java_team_project/README.md:1).

## Requirements

- Java 21
- PostgreSQL 16+

## Run locally

Start the local database:

```bash
./scripts/start-postgres.sh
```

Start the API:

```bash
./scripts/start-backend.sh
```

The app expects these defaults unless you override them:

- `DB_HOST=localhost`
- `DB_PORT=55432`
- `DB_NAME=lockin`
- `DB_USERNAME=lockin`
- `DB_PASSWORD=lockin`
- `FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`

Stop the local database:

```bash
./scripts/stop-postgres.sh
```

## Current endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/me`
- `PATCH /api/me/password`
- `DELETE /api/me`
- `GET /api/me/tasks`
- `POST /api/me/tasks`
- `PUT /api/me/tasks/{taskId}`
- `DELETE /api/me/tasks/{taskId}`
- `GET /api/me/dashboard/due-soon`
- `GET /api/me/calendar?month=2026-06`
- `POST /api/me/calendar/events`
- `PUT /api/me/calendar/events/{eventId}`
- `PATCH /api/me/calendar/events/{eventId}/complete`
- `DELETE /api/me/calendar/events/{eventId}`
- `GET /api/quotes/random`
