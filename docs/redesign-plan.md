# LockIn redesign plan

LockIn turns a syllabus into a living study plan. A learner adds courses, turns syllabus lines into topics and deadlines, studies a topic in a focus session, rates how confident they feel, and the app tells them what to review next and how much of each course they have covered.

One record, many views. A topic lives in its course, sits on the calendar, opens to its notes and links, shows up in the review queue, and counts toward course coverage. The learner never maintains two lists.

## Screens

| Route | Screen | Job |
| --- | --- | --- |
| `/` | Landing | What LockIn is, sign in, sign up, "Try the demo" (no account, data stays in the browser) |
| `/app` | Today | Today's agenda (planned topics, time blocks, events), deadlines in the next 7 days, ranked "Review next" with reasons, one big "Lock in" button |
| `/app/courses` | Courses | Active and archived courses, each with a coverage strip (one cell per topic, colored by confidence) |
| `/app/courses/:id` | Course | Header with code, name, instructor, links. Topics (syllabus order), deadlines, coverage, course review queue. Syllabus import lives here |
| `/app/topics/:id` | Topic | Notes, resources (links), planned date or time block, confidence with review history, linked deadlines, "Lock in on this" |
| `/app/review` | Review | Queue ranked by need, grouped view by confidence, course filter, one-tap rating with undo |
| `/app/calendar` | Calendar | Week (time grid) and month views. Topics are movable plans; deadlines are fixed pins; personal events. Drag a topic to plan or move it |
| `/app/focus` | Focus | Full-screen focus timer on one topic, ends with a confidence check-in and an optional one-line note. Logs a study session |
| `/app/settings` | Settings | Theme, account (password, delete), demo reset, export JSON |

Global: command palette (⌘K / Ctrl K) for search and quick add ("CSC369 midterm nov 12"), toasts with undo, keyboard shortcuts.

## Confidence

`unrated` (Not rated), `shaky`, `okay` (Getting there), `solid`, `retired` (Not tested). Self-reported. Copy never says "mastered". Every state has a label and a glyph, never color alone.

## Data contract

`frontend/src/lib/data/types.ts` is the contract. The lead owns it.

One read: `GET /api/workspace` returns `Workspace`. Mutations are per entity and the client patches the cached workspace optimistically.

### HTTP API (remote adapter ⇄ Spring Boot)

All JSON, camelCase, bearer JWT, owner-scoped. 404 for other users' ids.

- `GET /api/workspace` → `Workspace`
- `POST /api/courses` `CourseInput` → `Course`; `PATCH /api/courses/{id}` partial → `Course`; `DELETE /api/courses/{id}` (cascades topics, assessments, reviews, sessions of that course)
- `POST /api/topics` `TopicInput` → `Topic`; `POST /api/topics/bulk` `{ topics: TopicInput[] }` → `Topic[]`; `PATCH /api/topics/{id}` `TopicPatch` → `Topic`; `DELETE /api/topics/{id}`
- `POST /api/topics/{id}/reviews` `{ rating, source }` → `{ topic: Topic, review: ReviewEvent }` (sets confidence; sets lastReviewedAt to now unless rating is `retired` or `unrated`)
- `DELETE /api/reviews/{id}` → `{ topic: Topic }` (undo: restores `previous` confidence and the prior lastReviewedAt; only the latest review of a topic can be undone, else 409)
- `POST /api/assessments` → `Assessment`; `POST /api/assessments/bulk`; `PATCH /api/assessments/{id}`; `DELETE /api/assessments/{id}`
- `POST /api/events`, `PATCH /api/events/{id}`, `DELETE /api/events/{id}`
- `POST /api/sessions` `SessionInput` → `StudySession`; `DELETE /api/sessions/{id}`
- Auth unchanged: `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`, password change, account delete. Keep `/api/health` public.
- Old `/api/tasks`, `/api/calendar`, `/api/dashboard`: migrate data into the new tables, then remove the endpoints. `/api/quotes/random` may stay but the UI does not use it.

### Migration of old data

Flyway `V2`: create the new tables. For each owner, each distinct non-blank `tasks.course` becomes a `courses` row (code = the string, name = the string, color assigned round-robin, status active). Each task becomes an assessment (kind from `type` when it matches, else `task`; `due_date` null → created date). Each old calendar event becomes a `calendar_events` row with `color = slate`. Drop old tables in the same migration only after copying.

### Frontend data layer (`frontend/src/lib/data/`)

- `DataSource` interface with two adapters: `remote` (fetch to the API, base URL from `VITE_API_BASE_URL`, default same origin) and `local` (demo mode, persisted to `localStorage` key `lockin.demo.v1`, seeded by `seed.ts`, simulated latency 0).
- Seed: courses CSC369 Operating Systems, CSC324 Programming Languages, CSC301 Intro to Software Engineering, CSC311 Intro to Machine Learning, AST101 The Sun and Its Neighbours (active), CSC364 Computability (archived). 8 to 14 topics each with realistic titles, a spread of confidence and review dates, deadlines such as "AST101 Midterm 2", "CSC369 Midterm 2", "CSC324 Assignment 2", tutorials, weekly quizzes. All dates relative to today so the demo always looks current. Some study sessions over the past 3 weeks and review history.
- TanStack Query. One query key `['workspace']`. Hooks:
  - `useAuth()` → `{ state: AuthState, signIn(c), signUp(c), startDemo(), signOut() }`
  - `useWorkspace()` → query result of `Workspace`
  - `useCourseMutations()`, `useTopicMutations()`, `useAssessmentMutations()`, `useEventMutations()`, `useSessionMutations()` returning `{ create, createMany?, update, remove }` (async functions)
  - `useRateTopic()` → `rate(input): Promise<{ undo(): Promise<void> }>`
  - `useAccount()` → `{ changePassword, deleteAccount, exportData, resetDemo }`
  - All mutations optimistic, roll back on error, and surface errors through a returned `Error` the UI can toast.
- Cold start: the remote adapter pings `/api/health` on app load so a sleeping Render instance starts waking while the user types credentials.

### Pure domain logic (`frontend/src/lib/domain/`), unit tested

- `dates.ts`: `today()`, `relativeDue(date, now)` → `{ label: "Due tomorrow" | "In 3 days" | "2 days late" | "Today", tone: 'late'|'soon'|'later'|'done' }`, week and month grids (weeks start Monday), formatters.
- `ranking.ts`: `rankReview(workspace, now, { courseId? })` → `{ topic, score, reasons: string[] }[]`. Inputs: confidence (shaky > unrated-but-planned-in-the-past > okay > solid; retired excluded; unrated with a future plan excluded), days since last review against a target interval (shaky 1, okay 3, solid 7, unrated 0), nearest undone exam or quiz in the same course (or linked through `topicIds`) within 21 days. Reasons read like "Shaky", "Last reviewed 6 days ago", "Never reviewed", "Exam in 10 days". Deterministic and stable for ties.
- `coverage.ts`: counts per confidence for a course or everything, excluding retired from the denominator.
- `syllabus.ts`: `parseSyllabus(text, { year, courseId })` → drafts `{ kind: 'topic' | assessment kind, title, date: DateOnly | null, raw, confidence: 'high'|'low' }[]`. Handles "Week 3 (Sep 22): Scheduling", "Sep 22 - Scheduling", "Lecture 4: Paging", "Assignment 1 due Oct 3", "Midterm — Oct 15", "Final exam Dec 12", bullets, numbered lists, tabs from pasted tables.
- `quickAdd.ts`: `parseQuickAdd(text, courses, now)` → `{ kind, title, courseId, date, time }` for strings like "csc369 midterm nov 12", "AST101 quiz fri 10am", "read ch 4 tomorrow".
- `streak.ts`: study minutes per day for the last N days and current streak.

## Work split

| Owner | Files | Job |
| --- | --- | --- |
| Sol A | `backend/**` | Entities, V2 migration, services, controllers, DTOs, security, tests for every endpoint and the migration |
| Sol B | `frontend/src/lib/data/**` except `types.ts`, `frontend/src/main.tsx` providers only if needed (report first) | DataSource, adapters, seed, query hooks, auth, tests |
| Sol C | `frontend/src/lib/domain/**`, `frontend/package.json`, `frontend/vite.config.ts`, `frontend/scripts/**`, root `scripts/**`, CI | Domain logic with tests, dependencies, fonts, code splitting, the screenshot script |
| Lead | `frontend/src/**` everything else, `frontend/index.html`, `types.ts` | All UI: components, styles, routes, interactions, copy |

## Screenshot script (Sol C)

Storage keys the UI and data layer agree on: `lockin.session.v1` holds `{"mode":"demo"}` or `{"mode":"account","token":"…","user":{…}}`; `lockin.theme` holds `dark`, `light` or `system`; demo data lives in `lockin.demo.v1`.

`npm run shots` in `frontend/`: builds once, serves `vite preview` on a free port, opens Playwright Chromium, enters demo mode by setting `localStorage` (no backend), and captures each route at 1440x900 and 390x844 in dark and light into `frontend/.shots/<theme>/<width>/<route>.png` (gitignored). Routes and a dark/light toggle come from a config array at the top of the script so the lead can add states (palette open, focus running, rating menu open). It stops the server and browser when done.
