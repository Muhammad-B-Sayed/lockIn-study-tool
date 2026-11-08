# Domain API

Import public functions and types from `src/lib/domain/index.ts`. `CalendarDate` means `Date | DateOnly`. Date strings must use `YYYY-MM-DD`. Callers supply the clock. The domain never reads the current time.

```ts
today(now: Date): DateOnly
parseDateOnly(value: DateOnly): Date
formatDateOnly(date: Date): DateOnly
addDays(value: CalendarDate, days: number): DateOnly
diffDays(later: CalendarDate, earlier: CalendarDate): number
isSameDay(a: CalendarDate, b: CalendarDate): boolean
startOfWeek(value: CalendarDate): DateOnly
weekDays(value: CalendarDate): DateOnly[]
monthMatrix(value: CalendarDate): DateOnly[][]
formatDate(value: CalendarDate, options?: Intl.DateTimeFormatOptions): string
formatTime(value: string): string
minutesBetween(start: string, end: string): number
relativeDue(date: DateOnly, now: CalendarDate, done?: boolean): DueStatus
rankReview(workspace: Workspace, now: CalendarDate, options?: { courseId?: string }): RankedReview[]
nextDueDate(topic: Topic, workspace: Workspace, now: CalendarDate): DateOnly | null
coverage(topics: readonly Topic[], courseId?: string): Coverage
parseSyllabus(text: string, options: { year: number; courseId: string }): SyllabusDraft[]
parseQuickAdd(text: string, courses: readonly Course[], now: Date): QuickAddDraft
studyMinutesByDay(sessions: readonly StudySession[], now: Date, days?: number): DailyStudy[]
currentStreak(sessions: readonly StudySession[], now: Date): number
```

Public constants are `REVIEW_TARGET_INTERVALS`, `REVIEW_CONFIDENCE_WEIGHTS`, `REVIEW_WEIGHTS` and `REVIEW_PULL_FORWARD_WINDOW_DAYS`. The first two map every `Confidence` to a number. `REVIEW_WEIGHTS` has `elapsed: 10`, `maxIntervals: 4`, `assessment: 2`, and `assessmentWindowDays: 21`. `REVIEW_PULL_FORWARD_WINDOW_DAYS` is 7. The formula is documented at the top of `ranking.ts`. Ties retain the workspace topic order. Archived courses and retired topics are excluded. A past exam does not boost ranking.

`rankReview` includes only due topics. Shaky is due when never reviewed or at least one local calendar day after its last review. Okay is due after three days, and solid after seven. Unrated is due only when its planned date is today or past. An undone exam or quiz in the same course, or explicitly linking the topic, can pull a review forward within the inclusive seven-day window ending on the assessment date. The minimum review age is one day for non-solid topics and three days for solid. This never overrides the planned-date requirement for unrated topics. Okay and solid with missing or invalid review timestamps have no calculable due date and stay out of the queue until a valid check-in.

`nextDueDate` uses these same rules. It returns today for a topic already due, the earliest future queue entry date otherwise, or null for an unscheduled topic. It considers future exam windows as well as windows already open, and assumes no ratings, assessment completions or other edits happen after `now`.

Public result types are:

```ts
type DueStatus = { label: string; tone: 'late' | 'soon' | 'later' | 'done' }
type RankedReview = { topic: Topic; score: number; reasons: string[] }
type Coverage = { counts: Record<Confidence, number>; total: number; eligible: number; covered: number; percent: number }
type SyllabusDraft = { kind: 'topic' | AssessmentKind; title: string; date: DateOnly | null; courseId: string; raw: string; confidence: 'high' | 'low' }
type QuickAddDraft = { kind: 'topic' | AssessmentKind; title: string; courseId: string | null; date: DateOnly | null; time: string | null }
type DailyStudy = { date: DateOnly; minutes: number }
```

Weeks start Monday. Month grids always contain six rows of seven dates, including adjacent months. `diffDays` subtracts calendar dates, so DST does not change its answer. `minutesBetween` is a signed same-day difference, and does not infer an overnight event. Invalid dates, times and day counts throw `RangeError`.

Coverage counts all confidence states. `eligible` excludes retired. `covered` counts shaky, okay and solid. `percent` rounds `covered / eligible * 100`, or returns zero for an empty denominator. This measures whether a topic has a current confidence rating.

Syllabus import retains each original `raw` line. Mixed table rows can produce both a topic with the row's leading date and an assessment with its own deadline. Dates attached to `due`, `by` or `on` take priority for assessments. Mixed assessments and ambiguous wording receive low parsing confidence. An assessment noun must start the title, have a number or ordinal, or have an explicit deadline verb. Lecture and week prefixes preserve topic intent unless the remaining title starts with an assessment noun. Words inside topic titles, such as "Variable assignment", "Unit test design" and "Final value theorem", stay topics. Undated lines remain editable with low confidence.

Syllabus dates start with `options.year`. Walk lines in source order. When a yearless date is more than 60 calendar days earlier than the previous dated line, infer the next year for it and later lines. Exactly 60 days does not trigger rollover. Undated lines leave this context unchanged. Explicit years stay as written and establish the year for following yearless dates. In a mixed row, the leading schedule date anchors the line order. An assessment deadline may roll into the next year without advancing the year of the next schedule row. Numeric slash dates mean month/day.

Quick add matches explicit course codes before course names, preferring longer matches within each group. Yearless dates use the current local calendar year. An explicit calendar date wins over relative words and weekdays, and an adjacent preceding weekday is consumed with that date. A bare weekday means the next occurrence, including today. `next Friday` means Friday in the following Monday-based week, and `this Friday` means Friday in the current week. An empty quick-add input returns an empty title for the caller to validate.

Daily study totals default to the last 21 days, including today, in chronological order. Sessions count toward their local start date. Invalid, future, zero-minute and negative-minute sessions are ignored. Yesterday can anchor a current streak when the learner has not studied today.
