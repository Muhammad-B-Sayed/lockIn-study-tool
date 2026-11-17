import { isWorkspace } from './storage'
import { validateAssessment, validateCourse, validateEvent, validateSession, validateTopic } from './validation'
import type { Assessment, CalendarEvent, Course, StudySession, Topic, Workspace } from './types'

/** What an import will add. Nothing here replaces or deletes existing data. */
export type ImportPlan = {
  courses: Course[]
  topics: Topic[]
  assessments: Assessment[]
  events: CalendarEvent[]
  sessions: StudySession[]
  skipped: { courses: number; topics: number; assessments: number; events: number; sessions: number }
  /** Ratings history in the file. The app cannot recreate it, so it is reported and left out. */
  reviewsInFile: number
  /** For each course in the file that already exists here, the existing course id. */
  existingCourseIds: Record<string, string>
}

export type ImportParse = { ok: true; plan: ImportPlan } | { ok: false; error: string }

export const MAX_IMPORT_BYTES = 5_000_000

const norm = (value: string) => value.trim().toLowerCase()
const courseKey = (c: Pick<Course, 'code' | 'name'>) => `${norm(c.code)}|${norm(c.name)}`
const eventKey = (e: CalendarEvent) => `${norm(e.title)}|${e.date}|${e.startTime ?? ''}`
const assessmentKey = (a: Assessment, courseId: string | null) => `${courseId ?? ''}|${norm(a.title)}|${a.dueDate}`
/** Same start, same length, same course: the same session, whichever topic it was filed under. */
const sessionKey = (s: StudySession, courseId: string | null) => `${new Date(s.startedAt).getTime()}|${s.minutes}|${courseId ?? ''}`

function check(label: string, index: number, fn: () => void) {
  try {
    fn()
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'is not valid'
    throw new Error(`${label} ${index + 1}: ${reason}`, { cause: error })
  }
}

function requireId(row: unknown, label: string, index: number, seen: Set<string>) {
  if (!row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'string' || !row.id) {
    throw new Error(`${label} ${index + 1}: is missing its id`)
  }
  if (seen.has(row.id)) throw new Error(`${label} ${index + 1}: repeats the id of an earlier ${label.toLowerCase()}`)
  seen.add(row.id)
}

/**
 * Read an exported LockIn file and work out what importing it would add to `current`.
 * Every record is validated before anything is written. Courses, events, deadlines and
 * sessions that already exist are skipped, so importing the same file twice adds nothing.
 */
export function planImport(text: string, current: Workspace): ImportParse {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: 'That file is too large to be a LockIn export.' }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON. Choose a file made with Export data.' }
  }
  if (!isWorkspace(parsed)) {
    return { ok: false, error: 'That file is not a LockIn export. It needs courses, topics, assessments, events, sessions and reviews.' }
  }
  const file = parsed
  try {
    const courseIds = new Set<string>()
    file.courses.forEach((c, i) => {
      requireId(c, 'Course', i, courseIds)
      check('Course', i, () => validateCourse(c))
    })
    const topicIds = new Set<string>()
    file.topics.forEach((t, i) => {
      requireId(t, 'Topic', i, topicIds)
      check('Topic', i, () => {
        validateTopic(t)
        if (!courseIds.has(t.courseId)) throw new Error('belongs to a course that is not in the file')
      })
    })
    const assessmentIds = new Set<string>()
    file.assessments.forEach((a, i) => {
      requireId(a, 'Deadline', i, assessmentIds)
      check('Deadline', i, () => {
        validateAssessment(a)
        if (a.courseId != null && !courseIds.has(a.courseId)) throw new Error('belongs to a course that is not in the file')
      })
    })
    const eventIds = new Set<string>()
    file.events.forEach((e, i) => {
      requireId(e, 'Event', i, eventIds)
      check('Event', i, () => validateEvent(e))
    })
    const sessionIds = new Set<string>()
    file.sessions.forEach((s, i) => {
      requireId(s, 'Session', i, sessionIds)
      check('Session', i, () => validateSession(s))
    })
  } catch (error) {
    return { ok: false, error: `${error instanceof Error ? error.message : 'A record is not valid'}. Nothing was imported.` }
  }

  const skipped = { courses: 0, topics: 0, assessments: 0, events: 0, sessions: 0 }
  const existingByKey = new Map(current.courses.map((c) => [courseKey(c), c.id]))
  const existingCourseIds: Record<string, string> = {}
  const courses: Course[] = []
  for (const c of file.courses) {
    const existing = existingByKey.get(courseKey(c))
    if (existing) {
      existingCourseIds[c.id] = existing
      skipped.courses += 1
    } else courses.push(c)
  }

  // A course that already exists keeps its own topics; the file's copies are left out.
  const topics: Topic[] = []
  const droppedTopics = new Set<string>()
  for (const t of file.topics) {
    if (existingCourseIds[t.courseId]) {
      droppedTopics.add(t.id)
      skipped.topics += 1
    } else topics.push(t)
  }
  const keptTopics = new Set(topics.map((t) => t.id))

  const haveAssessments = new Set(current.assessments.map((a) => assessmentKey(a, a.courseId)))
  const assessments: Assessment[] = []
  for (const a of file.assessments) {
    const courseId = a.courseId ? existingCourseIds[a.courseId] ?? a.courseId : null
    if (haveAssessments.has(assessmentKey(a, courseId))) skipped.assessments += 1
    else assessments.push({ ...a, topicIds: a.topicIds.filter((id) => keptTopics.has(id)) })
  }

  const haveEvents = new Set(current.events.map(eventKey))
  const events: CalendarEvent[] = []
  for (const e of file.events) {
    if (haveEvents.has(eventKey(e))) skipped.events += 1
    else events.push(e)
  }

  const topicCourse = new Map(current.topics.map((t) => [t.id, t.courseId]))
  const haveSessions = new Set(current.sessions.map((s) => sessionKey(s, s.courseId ?? (s.topicId ? topicCourse.get(s.topicId) ?? null : null))))
  const fileTopicCourse = new Map(file.topics.map((t) => [t.id, t.courseId]))
  const fileCourseIds = new Set(file.courses.map((c) => c.id))
  const sessions: StudySession[] = []
  for (const s of file.sessions) {
    // A session on a topic that is being left out moves up to its course.
    const topicId = s.topicId && keptTopics.has(s.topicId) ? s.topicId : null
    const owner = (s.topicId ? fileTopicCourse.get(s.topicId) : undefined) ?? s.courseId
    const fileCourse = owner && fileCourseIds.has(owner) ? owner : null
    const key = sessionKey(s, fileCourse ? existingCourseIds[fileCourse] ?? fileCourse : null)
    if (haveSessions.has(key)) skipped.sessions += 1
    else {
      haveSessions.add(key)
      sessions.push({ ...s, topicId, courseId: fileCourse })
    }
  }

  return {
    ok: true,
    plan: { courses, topics, assessments, events, sessions, skipped, reviewsInFile: file.reviews.length, existingCourseIds },
  }
}

export function planIsEmpty(plan: ImportPlan): boolean {
  return !plan.courses.length && !plan.topics.length && !plan.assessments.length && !plan.events.length && !plan.sessions.length
}

/** Split a list so each request stays inside the bulk endpoint limits. */
export function chunk<T>(rows: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}
