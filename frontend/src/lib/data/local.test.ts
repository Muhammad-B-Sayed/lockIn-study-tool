import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalDataSource } from './local'
import { createDemoWorkspace } from './seed'
import { rankReview } from '../domain/ranking'
import { DEMO_STORAGE_KEY, loadSession, SESSION_STORAGE_KEY } from './storage'
import type { StorageLike } from './storage'
import type { TopicInput } from './types'

const start = new Date('2026-11-07T17:00:00Z')
function fixture() {
  let clock = start
  let id = 0
  const options = { now: () => clock, makeId: () => `test-${++id}` }
  const source = createLocalDataSource(options)
  return { source, options, advance: () => { clock = new Date(clock.getTime() + 60_000) } }
}

beforeEach(() => localStorage.clear())
describe('demo persistence and reviews', () => {
  it('clearly rejects password changes in demo mode without modifying the workspace', async () => {
    const { source } = fixture()
    const before = await source.getWorkspace()
    await expect(source.changePassword('current-password', 'new-password')).rejects.toMatchObject({
      name: 'DataError', status: 400,
      message: 'Passwords cannot be changed in demo mode. Sign in to an account to change its password.',
    })
    expect(await source.getWorkspace()).toEqual(before)
  })
  it('restores confidence and the exact previous timestamp, even after reloading', async () => {
    const { source, options } = fixture()
    const topic = (await source.getWorkspace()).topics[0]
    const { review } = await source.rateTopic({ topicId: topic.id, rating: 'okay', source: 'review' })
    const reloaded = createLocalDataSource(options)
    const result = await reloaded.undoReview(review.id)
    expect(result.topic.confidence).toBe(topic.confidence)
    expect(result.topic.lastReviewedAt).toBe(topic.lastReviewedAt)
    expect((await reloaded.getWorkspace()).reviews.some(row => row.id === review.id)).toBe(false)
  })
  it.each(['retired', 'unrated'] as const)('%s does not change lastReviewedAt', async rating => {
    const { source } = fixture()
    const topic = (await source.getWorkspace()).topics[0]
    const result = await source.rateTopic({ topicId: topic.id, rating, source: 'topic' })
    expect(result.topic.lastReviewedAt).toBe(topic.lastReviewedAt)
    expect((await source.undoReview(result.review.id)).topic).toEqual(topic)
  })
  it('rejects undo of a non-latest review with status 409 and no partial changes', async () => {
    const { source, advance } = fixture()
    const topic = (await source.getWorkspace()).topics[0]
    const first = await source.rateTopic({ topicId: topic.id, rating: 'okay', source: 'review' })
    advance()
    const second = await source.rateTopic({ topicId: topic.id, rating: 'shaky', source: 'focus' })
    const before = await source.getWorkspace()
    await expect(source.undoReview(first.review.id)).rejects.toMatchObject({ status: 409 })
    expect(await source.getWorkspace()).toEqual(before)
    expect((await source.undoReview(second.review.id)).topic.confidence).toBe('okay')
    expect((await source.undoReview(first.review.id)).topic.lastReviewedAt).toBe(topic.lastReviewedAt)
  })
  it('uses insertion order when two reviews share an instant', async () => {
    const { source } = fixture()
    const topicId = (await source.getWorkspace()).topics[0].id
    const first = await source.rateTopic({ topicId, rating: 'okay', source: 'review' })
    const second = await source.rateTopic({ topicId, rating: 'solid', source: 'review' })
    await expect(source.undoReview(first.review.id)).rejects.toMatchObject({ status: 409 })
    await expect(source.undoReview(second.review.id)).resolves.toMatchObject({ topic: { confidence: 'okay' } })
  })
  it('reseeds only on reset, preserving existing edits across a new adapter', async () => {
    const { source, options } = fixture()
    const course = (await source.getWorkspace()).courses[0]
    await source.updateCourse(course.id, { name: 'My custom name' })
    expect((await createLocalDataSource(options).getWorkspace()).courses[0].name).toBe('My custom name')
    expect((await source.resetDemo()).courses[0].name).toBe(course.name)
  })
  it('recovers corrupt data and tolerates every storage method throwing', async () => {
    localStorage.setItem(DEMO_STORAGE_KEY, '{broken')
    expect((await createLocalDataSource().getWorkspace()).courses).toHaveLength(6)
    const fail = () => { throw new DOMException('Storage blocked') }
    const storage: StorageLike = { getItem: fail, setItem: fail, removeItem: fail }
    const source = createLocalDataSource({ storage })
    const course = (await source.getWorkspace()).courses[0]
    await expect(source.updateCourse(course.id, { name: 'Still works' })).resolves.toMatchObject({ name: 'Still works' })
    expect(loadSession(storage)).toBeNull()
  })
  it('tolerates localStorage itself being unavailable', () => {
    const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked') })
    try { expect(loadSession()).toBeNull(); expect(() => createLocalDataSource()).not.toThrow() } finally { spy.mockRestore() }
  })
  it('rejects invalid saved sessions', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ mode: 'account', token: 'token', user: {} }))
    expect(loadSession()).toBeNull()
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ mode: 'demo' }))
    expect(loadSession()).toEqual({ mode: 'demo' })
  })
})

describe('workspace edits', () => {
  it('cascades a course delete through its topics, reviews, assessments and sessions', async () => {
    const { source } = fixture()
    const before = await source.getWorkspace()
    const courseId = before.courses[0].id
    const topicIds = new Set(before.topics.filter(row => row.courseId === courseId).map(row => row.id))
    await source.removeCourse(courseId)
    const after = await source.getWorkspace()
    expect(after.courses.some(row => row.id === courseId)).toBe(false)
    expect(after.topics.some(row => row.courseId === courseId)).toBe(false)
    expect(after.assessments.some(row => row.courseId === courseId)).toBe(false)
    expect(after.reviews.some(row => topicIds.has(row.topicId))).toBe(false)
    expect(after.sessions.some(row => row.courseId === courseId || !!row.topicId && topicIds.has(row.topicId))).toBe(false)
    expect(after.events).toEqual(before.events)
    expect(after.courses).toHaveLength(5)
  })
  it('removes topic links, reviews and sessions when a topic is deleted', async () => {
    const { source } = fixture()
    const topicId = (await source.getWorkspace()).topics[3].id
    await source.removeTopic(topicId)
    const w = await source.getWorkspace()
    expect(w.assessments.every(row => !row.topicIds.includes(topicId))).toBe(true)
    expect(w.reviews.every(row => row.topicId !== topicId)).toBe(true)
    expect(w.sessions.every(row => row.topicId !== topicId)).toBe(true)
  })
  it('makes bulk creates atomic when a later input is invalid', async () => {
    const { source } = fixture()
    const before = await source.getWorkspace()
    const valid: TopicInput = { ...before.topics[0], resources: [], title: 'Valid topic' }
    await expect(source.createTopics([valid, { ...valid, courseId: 'missing' }])).rejects.toMatchObject({ status: 404 })
    expect(await source.getWorkspace()).toEqual(before)
  })
  it('normalizes time blocks, replaces resources and clears a moved date-only plan', async () => {
    const { source } = fixture()
    const topic = (await source.getWorkspace()).topics[0]
    const plannedStart = new Date(2026, 10, 9, 15).toISOString()
    const blocked = await source.updateTopic(topic.id, { plannedStart, plannedMinutes: null,
      resources: [{ label: 'Guide', url: 'https://example.com/guide' }] })
    expect(blocked.plannedDate).toBe('2026-11-09')
    expect(blocked.plannedMinutes).toBe(60)
    expect(blocked.resources[0]).toMatchObject({ id: expect.any(String), label: 'Guide' })
    expect((await source.updateTopic(topic.id, { plannedDate: blocked.plannedDate })).plannedStart).toBe(plannedStart)
    expect((await source.updateTopic(topic.id, { plannedDate: '2026-11-11', resources: [] })).plannedStart).toBeNull()
  })
  it('retains completion time until reopened and protects the internal workspace from caller changes', async () => {
    const { source, advance } = fixture()
    const assessment = (await source.getWorkspace()).assessments[0]
    const done = await source.updateAssessment(assessment.id, { done: true })
    advance()
    expect((await source.updateAssessment(assessment.id, { notes: 'Finished' })).doneAt).toBe(done.doneAt)
    expect((await source.updateAssessment(assessment.id, { done: false })).doneAt).toBeNull()
    const w = await source.getWorkspace()
    w.courses.splice(0)
    expect((await source.getWorkspace()).courses).toHaveLength(6)
  })
  it('keeps optional session course ids and exposes only 120 days of activity', async () => {
    const { source } = fixture()
    const topic = (await source.getWorkspace()).topics[0]
    const row = await source.createSession({ topicId: topic.id, courseId: null, startedAt: start.toISOString(), minutes: 25, note: null })
    expect(row.courseId).toBeNull()
    const old = await source.createSession({ topicId: topic.id, courseId: topic.courseId, startedAt: '2025-01-01T00:00:00Z', minutes: 25, note: null })
    expect((await source.getWorkspace()).sessions.some(s => s.id === old.id)).toBe(false)
  })
  it('rejects empty imports and duplicate assessment topic links', async () => {
    const { source } = fixture()
    await expect(source.createTopics([])).rejects.toMatchObject({ status: 400 })
    await expect(source.createAssessments([])).rejects.toMatchObject({ status: 400 })
    const assessment = (await source.getWorkspace()).assessments[0]
    await expect(source.updateAssessment(assessment.id, { topicIds: [assessment.topicIds[0], assessment.topicIds[0]] })).rejects.toMatchObject({ status: 400 })
  })
})

describe('seed invariants', () => {
  it('has unique ids, valid references, realistic proportions and consistent review history', () => {
    const w = createDemoWorkspace(start)
    const ids = [w.user.id, ...w.courses.map(x => x.id), ...w.topics.flatMap(x => [x.id, ...x.resources.map(r => r.id)]), ...w.reviews.map(x => x.id), ...w.assessments.map(x => x.id), ...w.sessions.map(x => x.id), ...w.events.map(x => x.id)]
    expect(new Set(ids).size).toBe(ids.length)
    expect(w.courses.filter(c => c.status === 'active')).toHaveLength(5)
    expect(w.sessions).toHaveLength(15)
    for (const course of w.courses) {
      const count = w.topics.filter(t => t.courseId === course.id).length
      expect(count).toBeGreaterThanOrEqual(8)
      expect(count).toBeLessThanOrEqual(14)
    }
    for (const topic of w.topics) {
      expect(w.courses.some(c => c.id === topic.courseId)).toBe(true)
      expect(topic.details?.length).toBeGreaterThan(15)
      const reviews = w.reviews.filter(r => r.topicId === topic.id).sort((a, b) => a.at.localeCompare(b.at))
      if (reviews.length) {
        expect(reviews.at(-1)?.rating).toBe(topic.confidence)
        expect(reviews.at(-1)?.at).toBe(topic.lastReviewedAt)
        expect(reviews[0].previous).toBe('unrated')
        expect(reviews[1].previous).toBe(reviews[0].rating)
      }
    }
    for (const row of w.assessments) for (const id of row.topicIds) expect(w.topics.some(t => t.id === id)).toBe(true)
    expect(w.topics.filter(t => t.confidence === 'unrated').every(t => t.plannedDate! > '2026-11-07')).toBe(true)
    expect(w.assessments.some(a => a.dueDate < '2026-11-07' && !a.done)).toBe(true)
    expect(w.assessments.some(a => a.done)).toBe(true)
  })
  it('gives each active course a different workload and confidence profile', () => {
    const w = createDemoWorkspace(start)
    const expected = {
      CSC369: { total: 13, solid: 4, okay: 2, shaky: 3, unrated: 4, retired: 0 },
      CSC324: { total: 11, solid: 1, okay: 6, shaky: 1, unrated: 3, retired: 0 },
      CSC301: { total: 9, solid: 3, okay: 2, shaky: 0, unrated: 2, retired: 2 },
      CSC311: { total: 12, solid: 1, okay: 4, shaky: 4, unrated: 3, retired: 0 },
      AST101: { total: 8, solid: 5, okay: 1, shaky: 0, unrated: 2, retired: 0 },
    }
    for (const course of w.courses.filter(c => c.status === 'active')) {
      const topics = w.topics.filter(t => t.courseId === course.id)
      const counts = { total: topics.length, solid: 0, okay: 0, shaky: 0, unrated: 0, retired: 0 }
      topics.forEach(topic => { counts[topic.confidence] += 1 })
      expect(counts).toEqual(expected[course.code as keyof typeof expected])
      const future = topics.filter(t => t.confidence === 'unrated')
      expect(future.length).toBeGreaterThanOrEqual(2)
      expect(future.length).toBeLessThanOrEqual(4)
      expect(future.every(t => t.plannedDate! > '2026-11-07' && t.lastReviewedAt === null)).toBe(true)
    }
    const operatingSystems = w.topics.filter(t => t.courseId === 'course-csc369')
    expect(operatingSystems.slice(0, 4).every(t => t.confidence === 'solid')).toBe(true)
    expect(operatingSystems.slice(5, 8).map(t => [t.title, t.confidence])).toEqual([
      ['Address translation', 'shaky'], ['Paging and replacement', 'shaky'], ['Virtual memory', 'shaky'],
    ])
    expect(w.assessments.find(a => a.id === 'assessment-ast-midterm')?.dueDate).toBe('2026-11-12')
    expect(w.assessments.find(a => a.id === 'assessment-os-midterm')?.dueDate).toBe('2026-11-19')
    expect(w.assessments.filter(a => a.kind === 'assignment' && !a.done && a.dueDate < '2026-11-07')).toHaveLength(1)
    expect(w.assessments.filter(a => a.done)).toHaveLength(1)
    for (const session of w.sessions) {
      const topic = w.topics.find(t => t.id === session.topicId)
      expect(topic?.courseId).toBe(session.courseId)
      expect(topic?.confidence).not.toBe('unrated')
    }
  })
  it.each([
    new Date(2026, 10, 7, 0, 5), new Date(2026, 10, 7, 23, 55),
    new Date(2026, 2, 8, 12), new Date(2026, 10, 1, 12), new Date(2027, 0, 1, 12),
  ])('keeps the due queue manageable at %s without future review timestamps', now => {
    const w = createDemoWorkspace(now)
    const queue = rankReview(w, now)
    expect(queue.length).toBeGreaterThanOrEqual(10)
    expect(queue.length).toBeLessThanOrEqual(15)
    expect(queue.every(({ topic }) => topic.confidence !== 'unrated' && topic.confidence !== 'retired')).toBe(true)
    expect(w.reviews.every(review => new Date(review.at).getTime() <= now.getTime())).toBe(true)
    expect(new Set(w.topics.flatMap(t => t.lastReviewedAt ? [t.lastReviewedAt] : [])).size).toBeGreaterThan(10)
  })
  it('moves the whole term relative to now instead of fixing dates to a year', () => {
    const a = createDemoWorkspace(new Date(2025, 2, 10, 12))
    const b = createDemoWorkspace(new Date(2030, 2, 10, 12))
    expect(a.assessments[0].dueDate).toBe('2025-03-15')
    expect(b.assessments[0].dueDate).toBe('2030-03-15')
    expect(b.assessments[1].dueDate).toBe('2030-03-22')
    expect(b.generatedAt).toBe(new Date(2030, 2, 10, 12).toISOString())
    for (const session of b.sessions) expect(new Date(session.startedAt).getTime()).toBeGreaterThan(new Date(2030, 1, 16).getTime())
  })
})
