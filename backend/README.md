# LockIn Backend

API and persistence services for the LockIn workspace.

For the full project setup flow, start with the root [README.md](../README.md).

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

## HTTP API

All study routes require a bearer JWT. IDs from another account return 404.
Authentication binds the token's `uid` to an existing immutable account ID and
requires its `sub` username to match that account. Missing, malformed, deleted or
mismatched identities return 401. Re-registering a deleted username never makes
that account's old tokens valid again. Protected queries use the account ID.
JSON names and responses match `frontend/src/lib/data/types.ts`. POST returns 201,
PATCH and workspace reads return 200, and DELETE returns 204 unless it returns an undo result.
Study DTOs below are defined in `dto/StudyDtos.java`.

| Method and route | Request DTO | Response DTO |
| --- | --- | --- |
| GET `/api/workspace` | none | Workspace |
| POST `/api/courses` | CourseInput | Course |
| PATCH `/api/courses/{id}` | CoursePatch | Course |
| DELETE `/api/courses/{id}` | none | none |
| POST `/api/topics` | TopicInput | Topic |
| POST `/api/topics/bulk` | BulkTopics, `{topics: TopicInput[]}` | Topic[] |
| PATCH `/api/topics/{id}` | TopicPatch | Topic |
| DELETE `/api/topics/{id}` | none | none |
| POST `/api/topics/{id}/reviews` | ReviewInput, `{rating, source}` | RateResult, `{topic: Topic, review: ReviewEvent}` |
| DELETE `/api/reviews/{id}` | none | UndoResult, `{topic: Topic}` |
| POST `/api/assessments` | AssessmentInput | Assessment |
| POST `/api/assessments/bulk` | BulkAssessments, `{assessments: AssessmentInput[]}` | Assessment[] |
| PATCH `/api/assessments/{id}` | AssessmentPatch | Assessment |
| DELETE `/api/assessments/{id}` | none | none |
| POST `/api/events` | EventInput | CalendarEvent |
| PATCH `/api/events/{id}` | EventPatch | CalendarEvent |
| DELETE `/api/events/{id}` | none | none |
| POST `/api/sessions` | SessionInput | StudySession |
| DELETE `/api/sessions/{id}` | none | none |
| POST `/api/auth/signup` | SignupRequest | AuthResponse |
| POST `/api/auth/login` | LoginRequest | AuthResponse |
| GET `/api/auth/me` | none | UserResponse |
| GET `/api/me`, profile alias | none | UserResponse |
| PATCH `/api/me/password` | ChangePasswordRequest | UserResponse |
| DELETE `/api/me` | none | none |
| GET `/api/health`, public | none | `{status, service}` |
| GET `/api/quotes/random`, public | none | QuoteResponse |

Auth signup and login are public. Signup still accepts `username`, `password`,
and `repeatPassword`. Password changes accept `{currentPassword, password}` and
verify the current password before updating the hash. A mismatch returns 400 with
`Your current password is wrong.` Both passwords are required for a change, and
new passwords require at least eight characters for both signup and changes.
Every password field also allows at most 72 UTF-8 bytes, including login and
current-password verification. An oversized value returns 400 with
`Use a password of at most 72 bytes in UTF-8.` after the field name.
AuthResponse includes
`accessToken`, `tokenType`, `expiresAt`, and `user`.

### Data behavior

- PATCH preserves omitted fields. Explicit null clears nullable fields. Required
  fields cannot be cleared. Unknown or immutable fields return 400.
- Topic resources are optional on creation. On PATCH, `resources` replaces the
  entire list; `[]` clears it. Resource IDs come from the server.
- An explicitly supplied `plannedDate` is the learner's local calendar date and
  stays unchanged, including when `plannedStart` is a UTC instant on another day.
  Only when `plannedDate` is omitted does a supplied `plannedStart` derive that
  date from its own offset. A time block defaults `plannedMinutes` to 60.
  Setting `plannedDate` to null clears `plannedStart` and `plannedMinutes` too.
  Moving only `plannedDate` to a different day clears the previous start time.
- Instants require ISO-8601 with an offset or Z and responses use UTC. Dates use
  YYYY-MM-DD. Local times use HH:mm. Confidence, status, kind and palette keys
  use the lowercase values in the data contract.
- Reviews record both the prior confidence and prior last-reviewed timestamp.
  Unrated and retired ratings preserve that timestamp. Only the latest review
  for a topic can be undone; trying an older review returns 409. Undo removes
  that review and returns the restored topic.
- Assessments set `doneAt` when completed and clear it when reopened. Topic links
  must belong to the current account. Session course and topic IDs must belong
  to that account and must agree when both are supplied.
- Course deletion cascades its topics, assessments, reviews and sessions. Topic
  deletion removes its resources, reviews, sessions and assessment links. Account
  deletion cascades all owned data.
- Workspace returns all courses, topics, assessments and personal events, plus
  sessions and reviews from the last 120 days. Older history stays in storage.
  The read uses a consistent transaction snapshot with one profile read and eight
  study-data reads, including batched resources and links. JWT authentication adds
  one account lookup before the workspace transaction.

Validation errors return 400 with the field name and a message. Titles and names
allow 200 characters, course codes 120, term 120, details and session notes 1000,
notes 100000, link labels 200, and URLs 2048. Links require HTTP or HTTPS.
Minutes must be 1 through 1440, positions nonnegative, and weights 0 through 100
with at most two decimal places. A topic allows 100 resources, an assessment 500
unique topic IDs, and a bulk request 1 through 300 items. Each bulk assessment
request allows at most 2000 topic links across all assessments; each bulk topic
request allows at most 2000 resources across all topics. Bulk requests are atomic
and reject oversized totals before inserting any parent rows. Resource and topic
link inserts use JDBC batches with PostgreSQL batch rewriting enabled.

### Migration and tests

Flyway V2 converts distinct trimmed nonblank task courses into active courses
with palette colors assigned round-robin per owner. Tasks become assessments,
retaining IDs, completion, notes, and dates. Missing due dates use the creation
date; unknown task kinds become `task`. Legacy timestamps are interpreted as UTC.
Personal events retain IDs, dates and completion and receive the `slate` color.
V2 drops the old tables after copying. Old task, calendar and dashboard routes,
including their `/api/me` variants, are removed.

Run the same PostgreSQL-backed checks as CI:

```bash
./scripts/start-postgres.sh
mvn -q test
./scripts/stop-postgres.sh
```

Tests use the configured database and remove their own users. The migration test
creates an isolated schema, applies V1, seeds legacy rows, applies V2, checks the
copies and cascades, then drops that schema. No Docker or Testcontainers is needed.
