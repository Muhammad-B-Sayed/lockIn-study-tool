// Data contract shared by the UI, the data layer, and both adapters.
// Owned by the lead. Change only after agreement in docs/redesign-plan.md.

/** Self-reported confidence. Never call it "mastery" in UI copy. */
export type Confidence = 'unrated' | 'shaky' | 'okay' | 'solid' | 'retired'

/** Palette keys. The UI maps these to colors; data never stores hex. */
export type ColorKey =
  | 'ember'
  | 'amber'
  | 'moss'
  | 'teal'
  | 'sky'
  | 'iris'
  | 'orchid'
  | 'slate'

/** ISO date, YYYY-MM-DD, in the learner's local calendar. */
export type DateOnly = string
/** ISO 8601 instant with offset, e.g. 2026-11-07T14:30:00.000Z. */
export type Instant = string

export type User = {
  id: string
  username: string
  createdAt: Instant | null
}

export type Course = {
  id: string
  code: string // "CSC369"
  name: string // "Operating Systems"
  color: ColorKey
  term: string | null // "Fall 2026"
  instructor: string | null
  email: string | null
  website: string | null
  status: 'active' | 'archived'
  createdAt: Instant
}

export type Resource = {
  id: string
  label: string
  url: string
}

export type Topic = {
  id: string
  courseId: string
  title: string
  details: string | null // one-line summary shown in lists
  notes: string // learner's notes, plain text with line breaks
  plannedDate: DateOnly | null // syllabus date; date-only plan
  plannedStart: Instant | null // optional time block; when set, plannedDate matches its local date
  plannedMinutes: number | null // block length, default 60 when plannedStart is set
  confidence: Confidence
  lastReviewedAt: Instant | null
  position: number // order within the course
  resources: Resource[]
  createdAt: Instant
}

export type ReviewEvent = {
  id: string
  topicId: string
  rating: Confidence
  previous: Confidence
  at: Instant
  source: 'review' | 'focus' | 'topic'
}

export type AssessmentKind = 'assignment' | 'exam' | 'quiz' | 'project' | 'task'

export type Assessment = {
  id: string
  courseId: string | null
  title: string
  kind: AssessmentKind
  dueDate: DateOnly // fixed deadline; calendar drags never change it
  dueTime: string | null // "23:59" local time, optional
  weight: number | null // percent of final grade
  done: boolean
  doneAt: Instant | null
  notes: string
  topicIds: string[] // topics this assessment covers
  createdAt: Instant
}

export type StudySession = {
  id: string
  topicId: string | null
  courseId: string | null
  startedAt: Instant
  minutes: number
  note: string | null
}

/** Personal, non-course events (work shift, club meeting). */
export type CalendarEvent = {
  id: string
  title: string
  date: DateOnly
  startTime: string | null // "14:00"
  endTime: string | null // "15:30"
  color: ColorKey
  done: boolean
}

/** Everything the app needs, fetched in one request. */
export type Workspace = {
  user: User
  courses: Course[]
  topics: Topic[]
  assessments: Assessment[]
  events: CalendarEvent[]
  sessions: StudySession[] // last 120 days
  reviews: ReviewEvent[] // last 120 days
  generatedAt: Instant
}

// ---------- write payloads ----------

export type CourseInput = Omit<Course, 'id' | 'createdAt'>
export type TopicInput = Omit<Topic, 'id' | 'createdAt' | 'lastReviewedAt' | 'resources'> & {
  resources?: Omit<Resource, 'id'>[]
}
export type TopicPatch = Partial<Omit<Topic, 'id' | 'createdAt' | 'courseId' | 'resources'>> & {
  resources?: Omit<Resource, 'id'>[] // full replacement when present
}
export type AssessmentInput = Omit<Assessment, 'id' | 'createdAt' | 'doneAt'>
export type AssessmentPatch = Partial<AssessmentInput>
export type EventInput = Omit<CalendarEvent, 'id'>
export type SessionInput = Omit<StudySession, 'id'>
export type RateInput = {
  topicId: string
  rating: Confidence
  source: ReviewEvent['source']
}

export type Credentials = { username: string; password: string }

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; mode: 'account'; user: User }
  | { status: 'signed-in'; mode: 'demo'; user: User }
