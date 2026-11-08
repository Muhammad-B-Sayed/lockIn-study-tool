import { DataError } from './source'
import type { AssessmentInput, CourseInput, EventInput, RateInput, SessionInput, Topic } from './types'

const colors = ['ember', 'amber', 'moss', 'teal', 'sky', 'iris', 'orchid', 'slate']
const confidences = ['unrated', 'shaky', 'okay', 'solid', 'retired']
const timePattern = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/
function fail(field: string, message: string): never { throw new DataError(400, `${field}: ${message}`) }
export function validateObject(input: unknown): asserts input is object {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DataError(400, 'A JSON object is required.')
}
function text(value: unknown, field: string, max: number, required = false, blankMessage?: string) {
  if (value == null) {
    if (required || blankMessage) fail(field, blankMessage ?? 'must not be null')
    return
  }
  if (typeof value !== 'string') fail(field, 'must be a string')
  if (blankMessage && !value.trim()) fail(field, blankMessage)
  if (value.length > max) fail(field, `size must be between 0 and ${max}`)
}
function choice(value: unknown, field: string, values: string[], message: string) {
  if (value == null) fail(field, 'must not be null')
  if (typeof value !== 'string' || !values.includes(value)) fail(field, message)
}
function integer(value: unknown, field: string, min: number, max: number, nullable = false) {
  if (value == null) { if (!nullable) fail(field, 'must not be null'); return }
  if (typeof value !== 'number' || !Number.isInteger(value)) fail(field, 'must be an integer')
  if (value < min) fail(field, `must be greater than or equal to ${min}`)
  if (value > max) fail(field, `must be less than or equal to ${max}`)
}
function boolean(value: unknown, field: string) { if (typeof value !== 'boolean') fail(field, 'must be a boolean') }
function array(value: unknown, field: string, max: number): asserts value is unknown[] {
  if (!Array.isArray(value)) fail(field, 'must be an array')
  if (value.length > max) fail(field, `size must be between 0 and ${max}`)
}
function validDate(value: string) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
function date(value: unknown, field: string, nullable = true) {
  if (value == null && nullable) return
  if (typeof value !== 'string' || !validDate(value)) fail(field, 'Date must be a valid YYYY-MM-DD string.')
}
function time(value: unknown, field: string) {
  if (value != null && (typeof value !== 'string' || !timePattern.test(value))) fail(field, `${field} must use HH:mm`)
}
function instant(value: unknown, field: string, nullable = true) {
  if (value == null && nullable) return
  const pattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\.[0-9]{1,9})?)?(?:Z|[+-](?:(?:0[0-9]|1[0-7]):[0-5][0-9]|18:00))$/
  if (typeof value !== 'string' || !pattern.test(value) || !validDate(value.slice(0, 10)) || !Number.isFinite(new Date(value).getTime())) {
    fail(field, 'Instant must be an ISO-8601 string with an offset or Z.')
  }
}
function url(value: unknown, field: string, required = false) {
  text(value, field, 2048, required, required ? 'must not be blank' : undefined)
  if (value != null && (typeof value !== 'string' || !/^https?:\/\/[^\s]+$/.test(value))) fail(field, `${field} must be an http or https URL`)
}
function id(value: unknown, field: string, nullable = false) {
  if (nullable && value == null) return
  if (typeof value !== 'string' || !value) fail(field, 'must not be null')
}
export function validateCourse(input: CourseInput) {
  validateObject(input)
  text(input.code, 'code', 120, true, 'code is required')
  text(input.name, 'name', 200, true, 'name is required')
  choice(input.color, 'color', colors, 'color must be a supported color key')
  choice(input.status, 'status', ['active', 'archived'], 'status must be active or archived')
  text(input.term, 'term', 120); text(input.instructor, 'instructor', 200)
  text(input.email, 'email', 254)
  if (input.email && !/^[^\s@]+@[^\s@]+$/.test(input.email)) fail('email', 'email must be valid')
  url(input.website, 'website')
}
export function validateTopic(input: Topic) {
  validateObject(input)
  id(input.courseId, 'courseId')
  text(input.title, 'title', 200, true, 'title is required')
  text(input.details, 'details', 1000); text(input.notes, 'notes', 100000, true)
  date(input.plannedDate, 'plannedDate'); instant(input.plannedStart, 'plannedStart')
  instant(input.lastReviewedAt, 'lastReviewedAt')
  integer(input.plannedMinutes, 'plannedMinutes', 1, 1440, true)
  integer(input.position, 'position', 0, 2147483647)
  choice(input.confidence, 'confidence', confidences, 'confidence must be unrated, shaky, okay, solid or retired')
  array(input.resources, 'resources', 100)
  input.resources.forEach((resource, i) => {
    if (!resource || typeof resource !== 'object') fail(`resources[${i}]`, 'must not be null')
    text(resource.label, `resources[${i}].label`, 200, true, 'must not be blank')
    url(resource.url, `resources[${i}].url`, true)
  })
}
export function validateAssessment(input: AssessmentInput) {
  validateObject(input)
  id(input.courseId, 'courseId', true)
  text(input.title, 'title', 200, true, 'title is required')
  choice(input.kind, 'kind', ['assignment', 'exam', 'quiz', 'project', 'task'], 'kind must be assignment, exam, quiz, project or task')
  date(input.dueDate, 'dueDate', false); time(input.dueTime, 'dueTime')
  if (input.weight != null) {
    if (typeof input.weight !== 'number' || !Number.isFinite(input.weight) || input.weight < 0 || input.weight > 100) fail('weight', 'must be between 0 and 100')
    if (Math.abs(input.weight * 100 - Math.round(input.weight * 100)) > 1e-8) fail('weight', 'numeric value out of bounds (<3 digits>.<2 digits> expected)')
  }
  boolean(input.done, 'done'); text(input.notes, 'notes', 100000, true)
  array(input.topicIds, 'topicIds', 500)
  input.topicIds.forEach(topicId => id(topicId, 'topicIds'))
  if (new Set(input.topicIds).size !== input.topicIds.length) throw new DataError(400, 'topicIds must not contain duplicates.')
}
export function validateEvent(input: EventInput) {
  validateObject(input)
  text(input.title, 'title', 200, true, 'title is required')
  date(input.date, 'date', false); time(input.startTime, 'startTime'); time(input.endTime, 'endTime')
  choice(input.color, 'color', colors, 'color must be a supported color key')
  boolean(input.done, 'done')
  if (input.startTime && input.endTime && input.endTime <= input.startTime) throw new DataError(400, 'endTime must be after startTime.')
}
export function validateSession(input: SessionInput) {
  validateObject(input)
  id(input.courseId, 'courseId', true); id(input.topicId, 'topicId', true)
  instant(input.startedAt, 'startedAt', false)
  integer(input.minutes, 'minutes', 1, 1440)
  text(input.note, 'note', 1000)
}
export function validateRating(input: RateInput) {
  validateObject(input)
  choice(input.rating, 'rating', confidences, 'rating must be unrated, shaky, okay, solid or retired')
  choice(input.source, 'source', ['review', 'focus', 'topic'], 'source must be review, focus or topic')
}
export function validatePatch(patch: object, allowed: string[]) {
  validateObject(patch)
  for (const key of Object.keys(patch)) if (!allowed.includes(key)) throw new DataError(400, `${key} cannot be changed.`)
}

/** Check the whole request before allocating IDs, editing records, or persisting anything. */
export function validateBulk(inputs: unknown, collection: 'topics' | 'assessments') {
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 300) {
    throw new DataError(400, `${collection}: Import between 1 and 300 ${collection} at a time.`)
  }
  const field = collection === 'topics' ? 'resources' : 'topicIds'
  const label = collection === 'topics' ? 'resources' : 'topic links'
  let count = 0
  for (const input of inputs) {
    validateObject(input)
    const children = (input as Record<string, unknown>)[field]
    if (children == null && field === 'resources') continue
    if (!Array.isArray(children)) throw new DataError(400, `${field}: must be an array`)
    count += children.length
    if (count > 2000) throw new DataError(400, `A bulk request can contain at most 2000 ${label}.`)
  }
}
