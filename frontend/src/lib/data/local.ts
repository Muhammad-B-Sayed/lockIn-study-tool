import { createDemoWorkspace } from './seed'
import { withLocalPlannedDate } from './planning'
import { DataError } from './source'
import type { DataSource } from './source'
import { browserStorage, DEMO_STORAGE_KEY, isWorkspace, readStorage, writeStorage } from './storage'
import type { StorageLike } from './storage'
import { validateAssessment, validateBulk, validateCourse, validateEvent, validateObject, validatePatch, validateRating, validateSession, validateTopic } from './validation'
import type { AssessmentInput, AssessmentPatch, CourseInput, EventInput, RateInput, SessionInput, Topic, TopicInput, TopicPatch, Workspace } from './types'

type PersistedWorkspace = Workspace & {
  _reviewPreviousDates?: Record<string, string | null>
  _reviewSequences?: Record<string, number>
  _nextReviewSequence?: number
}
type ReviewState = { previousDates: Record<string, string | null>; sequences: Record<string, number>; nextSequence: number }
export type LocalOptions = {
  storage?: StorageLike | null
  initialWorkspace?: Workspace
  now?: () => Date
  makeId?: () => string
  reviewPreviousDates?: Record<string, string | null>
}
export interface LocalDataSource extends DataSource { resetDemo(): Promise<Workspace> }
const clone = <T,>(value: T): T => structuredClone(value)
const courseFields = ['code', 'name', 'color', 'term', 'instructor', 'email', 'website', 'status']
const topicFields = ['title', 'details', 'notes', 'plannedDate', 'plannedStart', 'plannedMinutes', 'confidence', 'lastReviewedAt', 'position', 'resources']
const assessmentFields = ['courseId', 'title', 'kind', 'dueDate', 'dueTime', 'weight', 'done', 'notes', 'topicIds']
const eventFields = ['title', 'date', 'startTime', 'endTime', 'color', 'done']

function reviewState(w: PersistedWorkspace): ReviewState {
  const sequences: Record<string, number> = {}
  let nextSequence = Number.isSafeInteger(w._nextReviewSequence) ? w._nextReviewSequence! : 0
  for (const review of w.reviews) {
    const sequence = w._reviewSequences?.[review.id]
    if (Number.isSafeInteger(sequence) && sequence! > 0) {
      sequences[review.id] = sequence!
      nextSequence = Math.max(nextSequence, sequence!)
    }
  }
  // Existing v1 demo data already retains insertion order in its review array.
  for (const review of w.reviews) if (!Object.hasOwn(sequences, review.id)) sequences[review.id] = ++nextSequence
  return { previousDates: { ...w._reviewPreviousDates }, sequences, nextSequence }
}
export function createLocalDataSource(options: LocalOptions = {}): LocalDataSource {
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const now = options.now ?? (() => new Date())
  const makeId = options.makeId ?? (() => crypto.randomUUID())
  const stored = readStorage(DEMO_STORAGE_KEY, storage)
  let workspace = clone(options.initialWorkspace ?? (isWorkspace(stored) ? stored : createDemoWorkspace(now())))
  let history = reviewState(workspace)
  Object.assign(history.previousDates, options.reviewPreviousDates)
  delete (workspace as PersistedWorkspace)._reviewPreviousDates
  delete (workspace as PersistedWorkspace)._reviewSequences
  delete (workspace as PersistedWorkspace)._nextReviewSequence
  function persist() {
    writeStorage(DEMO_STORAGE_KEY, { ...workspace, _reviewPreviousDates: history.previousDates,
      _reviewSequences: history.sequences, _nextReviewSequence: history.nextSequence }, storage)
  }
  if (!options.initialWorkspace) persist()
  function requireRecord<T extends { id: string }>(records: T[], id: string, name: string): T {
    const record = records.find(row => row.id === id)
    if (!record) throw new DataError(404, `${name} not found.`)
    return record
  }
  function course(w: Workspace, id: string | null) { if (id != null) requireRecord(w.courses, id, 'Course') }
  async function change<T>(fn: (w: Workspace, h: ReviewState) => T): Promise<T> {
    const next = clone(workspace)
    const nextHistory = clone(history)
    const result = fn(next, nextHistory)
    next.generatedAt = now().toISOString()
    workspace = next; history = nextHistory
    persist()
    return clone(result)
  }
  function resources(input: TopicInput['resources']) {
    if (input == null) return []
    if (!Array.isArray(input)) throw new DataError(400, 'resources must be an array, use [] to clear it.')
    if (input.length > 100) throw new DataError(400, 'resources: size must be between 0 and 100')
    return input.map(resource => ({ ...resource, id: makeId() }))
  }
  function addTopic(w: Workspace, input: TopicInput): Topic {
    validateObject(input)
    const normalized = withLocalPlannedDate(input)
    const topic: Topic = { ...normalized, details: input.details ?? null, plannedDate: normalized.plannedDate ?? null,
      plannedStart: input.plannedStart ?? null, plannedMinutes: input.plannedMinutes ?? (input.plannedStart ? 60 : null),
      id: makeId(), createdAt: now().toISOString(), lastReviewedAt: null, resources: resources(input.resources) }
    validateTopic(topic); course(w, topic.courseId)
    topic.title = topic.title.trim()
    w.topics.push(topic)
    return topic
  }
  function assessmentReferences(w: Workspace, input: AssessmentInput) {
    validateAssessment(input); course(w, input.courseId)
    for (const id of input.topicIds) requireRecord(w.topics, id, 'Topic')
  }
  function addAssessment(w: Workspace, input: AssessmentInput) {
    assessmentReferences(w, input)
    const assessment = { ...input, courseId: input.courseId ?? null, dueTime: input.dueTime ?? null, weight: input.weight ?? null,
      title: input.title.trim(), id: makeId(), createdAt: now().toISOString(), doneAt: input.done ? now().toISOString() : null }
    w.assessments.push(assessment)
    return assessment
  }
  function pruneTopics(w: Workspace, ids: Set<string>, h: ReviewState) {
    w.topics = w.topics.filter(row => !ids.has(row.id))
    w.sessions = w.sessions.filter(row => !row.topicId || !ids.has(row.topicId))
    for (const review of w.reviews) if (ids.has(review.topicId)) { delete h.previousDates[review.id]; delete h.sequences[review.id] }
    w.reviews = w.reviews.filter(row => !ids.has(row.topicId))
    w.assessments.forEach(row => { row.topicIds = row.topicIds.filter(id => !ids.has(id)) })
  }
  const demoAuth = async (): Promise<never> => { throw new DataError(400, 'Sign out of the demo to use an account.') }
  return {
    health: async () => {}, signIn: demoAuth, signUp: demoAuth,
    getProfile: async () => clone(workspace.user),
    changePassword: async (): Promise<void> => { throw new DataError(400, 'Passwords cannot be changed in demo mode. Sign in to an account to change its password.') },
    deleteAccount: demoAuth,
    getWorkspace: async () => {
      const result = clone(workspace)
      const cutoff = now().getTime() - 120 * 24 * 60 * 60 * 1000
      result.generatedAt = now().toISOString()
      result.sessions = result.sessions.filter(row => new Date(row.startedAt).getTime() >= cutoff)
      result.reviews = result.reviews.filter(row => new Date(row.at).getTime() >= cutoff)
      return result
    },
    resetDemo: async () => { workspace = createDemoWorkspace(now()); history = reviewState(workspace); persist(); return clone(workspace) },
    createCourse: (input: CourseInput) => change(w => {
      validateCourse(input)
      const row = { ...input, term: input.term ?? null, instructor: input.instructor ?? null, email: input.email ?? null, website: input.website ?? null,
        code: input.code.trim(), name: input.name.trim(), id: makeId(), createdAt: now().toISOString() }; w.courses.push(row); return row
    }),
    updateCourse: (id: string, patch: Partial<CourseInput>) => change(w => {
      const row = requireRecord(w.courses, id, 'Course')
      validatePatch(patch, courseFields)
      const updated = { ...row, ...patch }; validateCourse(updated)
      updated.code = updated.code.trim(); updated.name = updated.name.trim()
      Object.assign(row, updated); return row
    }),
    removeCourse: (id: string) => change((w, h) => {
      requireRecord(w.courses, id, 'Course')
      pruneTopics(w, new Set(w.topics.filter(row => row.courseId === id).map(row => row.id)), h)
      w.courses = w.courses.filter(row => row.id !== id)
      w.assessments = w.assessments.filter(row => row.courseId !== id)
      w.sessions = w.sessions.filter(row => row.courseId !== id)
    }),
    createTopic: input => change(w => addTopic(w, input)),
    createTopics: async inputs => {
      validateBulk(inputs, 'topics')
      return change(w => inputs.map(input => addTopic(w, input)))
    },
    updateTopic: (id: string, patch: TopicPatch) => change(w => {
      const row = requireRecord(w.topics, id, 'Topic')
      validatePatch(patch, topicFields)
      const previousDate = row.plannedDate
      const { resources: resourceInput, ...rest } = withLocalPlannedDate(patch)
      Object.assign(row, rest)
      if (Object.hasOwn(patch, 'plannedDate') && !Object.hasOwn(patch, 'plannedStart') && patch.plannedDate !== previousDate) row.plannedStart = null
      if (Object.hasOwn(patch, 'resources')) {
        if (resourceInput == null) throw new DataError(400, 'resources must be an array, use [] to clear it.')
        row.resources = resources(resourceInput)
      }
      if (row.plannedStart && row.plannedMinutes === null) row.plannedMinutes = 60
      validateTopic(row); row.title = row.title.trim()
      return row
    }),
    removeTopic: id => change((w, h) => { requireRecord(w.topics, id, 'Topic'); pruneTopics(w, new Set([id]), h) }),
    rateTopic: (input: RateInput) => change((w, h) => {
      validateRating(input)
      const topic = requireRecord(w.topics, input.topicId, 'Topic')
      const review = { id: makeId(), topicId: topic.id, previous: topic.confidence, rating: input.rating, at: now().toISOString(), source: input.source }
      h.previousDates[review.id] = topic.lastReviewedAt
      h.sequences[review.id] = ++h.nextSequence
      topic.confidence = input.rating
      if (input.rating !== 'retired' && input.rating !== 'unrated') topic.lastReviewedAt = review.at
      w.reviews.push(review)
      return { topic, review }
    }),
    undoReview: id => change((w, h) => {
      const review = requireRecord(w.reviews, id, 'Review')
      const topic = requireRecord(w.topics, review.topicId, 'Topic')
      const ordered = w.reviews.filter(row => row.topicId === topic.id).sort((a, b) => h.sequences[a.id] - h.sequences[b.id])
      if (ordered.at(-1)?.id !== id) throw new DataError(409, 'Only the latest review for a topic can be undone.')
      topic.confidence = review.previous
      topic.lastReviewedAt = Object.hasOwn(h.previousDates, id) ? h.previousDates[id]
        : ordered.slice(0, -1).filter(row => row.rating !== 'retired' && row.rating !== 'unrated').at(-1)?.at ?? null
      w.reviews = w.reviews.filter(row => row.id !== id)
      delete h.previousDates[id]; delete h.sequences[id]
      return { topic }
    }),
    createAssessment: input => change(w => addAssessment(w, input)),
    createAssessments: async inputs => {
      validateBulk(inputs, 'assessments')
      return change(w => inputs.map(input => addAssessment(w, input)))
    },
    updateAssessment: (id: string, patch: AssessmentPatch) => change(w => {
      const row = requireRecord(w.assessments, id, 'Assessment')
      validatePatch(patch, assessmentFields)
      const updated = { ...row, ...patch }; assessmentReferences(w, updated)
      updated.title = updated.title.trim()
      updated.doneAt = updated.done ? row.doneAt ?? now().toISOString() : null
      Object.assign(row, updated); return row
    }),
    removeAssessment: id => change(w => { requireRecord(w.assessments, id, 'Assessment'); w.assessments = w.assessments.filter(row => row.id !== id) }),
    createEvent: (input: EventInput) => change(w => {
      validateEvent(input); const row = { ...input, startTime: input.startTime ?? null, endTime: input.endTime ?? null, title: input.title.trim(), id: makeId() }; w.events.push(row); return row
    }),
    updateEvent: (id, patch) => change(w => {
      const row = requireRecord(w.events, id, 'Event'); validatePatch(patch, eventFields)
      const updated = { ...row, ...patch }; validateEvent(updated); Object.assign(row, updated, { title: updated.title.trim() }); return row
    }),
    removeEvent: id => change(w => { requireRecord(w.events, id, 'Event'); w.events = w.events.filter(row => row.id !== id) }),
    createSession: (input: SessionInput) => change(w => {
      validateSession(input); course(w, input.courseId)
      const topic = input.topicId ? requireRecord(w.topics, input.topicId, 'Topic') : null
      if (topic && input.courseId && topic.courseId !== input.courseId) throw new DataError(400, "courseId must match the topic's course.")
      const row = { ...input, topicId: input.topicId ?? null, courseId: input.courseId ?? null, note: input.note ?? null, id: makeId() }; w.sessions.push(row); return row
    }),
    removeSession: id => change(w => { requireRecord(w.sessions, id, 'Session'); w.sessions = w.sessions.filter(row => row.id !== id) }),
  }
}
