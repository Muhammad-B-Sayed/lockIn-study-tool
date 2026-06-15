# LockIn Frontend

Web client for the LockIn workspace.

For the full project setup flow, start with the root [README.md](../README.md).

## Requirements

- Node.js 20+

## Run locally

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

By default the app runs at `http://127.0.0.1:5173`.

## Backend connection

The app expects the API to be available at `/api`.

During local development, `/api` requests are proxied to:

```text
http://localhost:8080
```

If you need a different backend URL, set:

```bash
VITE_API_BASE_URL=http://localhost:8080/api
```

## Current features

- Secure login and signup
- Quote, due-soon, task list, and calendar dashboard
- Task creation, editing, completion toggling, filtering, and deletion
- Calendar event creation, editing, completion, and deletion
- Password change and account deletion controls
