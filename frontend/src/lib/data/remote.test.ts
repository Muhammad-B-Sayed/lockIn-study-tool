import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRemoteDataSource } from './remote'
import { createDemoWorkspace } from './seed'
import { DataError } from './source'
import type { DataSource } from './source'
import type { AssessmentInput, CourseInput, EventInput, SessionInput, TopicInput } from './types'

const workspace = createDemoWorkspace(new Date('2026-11-07T12:00:00Z'))
const course: CourseInput = workspace.courses[0]
const topic: TopicInput = { ...workspace.topics[0], resources: [{ label: 'Reading', url: 'https://example.com' }] }
const assessment: AssessmentInput = workspace.assessments[0]
const event: EventInput = workspace.events[0]
const session: SessionInput = workspace.sessions[0]
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
afterEach(() => vi.unstubAllEnvs())

describe('remote request contract', () => {
  const cases: [string, (source: DataSource) => Promise<unknown>, string, string, unknown?][] = [
    ['workspace', s => s.getWorkspace(), 'GET', '/workspace'],
    ['profile', s => s.getProfile(), 'GET', '/me'],
    ['password', s => s.changePassword('current-password', 'new-password'), 'PATCH', '/me/password', { currentPassword: 'current-password', password: 'new-password' }],
    ['delete account', s => s.deleteAccount(), 'DELETE', '/me'],
    ['create course', s => s.createCourse(course), 'POST', '/courses', course],
    ['update course', s => s.updateCourse('c/1', { status: 'archived' }), 'PATCH', '/courses/c%2F1', { status: 'archived' }],
    ['delete course', s => s.removeCourse('1'), 'DELETE', '/courses/1'],
    ['create topic', s => s.createTopic(topic), 'POST', '/topics', topic],
    ['bulk topics', s => s.createTopics([topic]), 'POST', '/topics/bulk', { topics: [topic] }],
    ['update topic', s => s.updateTopic('1', { plannedDate: null }), 'PATCH', '/topics/1', { plannedDate: null }],
    ['delete topic', s => s.removeTopic('1'), 'DELETE', '/topics/1'],
    ['rate', s => s.rateTopic({ topicId: '1', rating: 'okay', source: 'focus' }), 'POST', '/topics/1/reviews', { rating: 'okay', source: 'focus' }],
    ['undo review', s => s.undoReview('1'), 'DELETE', '/reviews/1'],
    ['create assessment', s => s.createAssessment(assessment), 'POST', '/assessments', assessment],
    ['bulk assessments', s => s.createAssessments([assessment]), 'POST', '/assessments/bulk', { assessments: [assessment] }],
    ['update assessment', s => s.updateAssessment('1', { done: true }), 'PATCH', '/assessments/1', { done: true }],
    ['delete assessment', s => s.removeAssessment('1'), 'DELETE', '/assessments/1'],
    ['create event', s => s.createEvent(event), 'POST', '/events', event],
    ['update event', s => s.updateEvent('1', { done: true }), 'PATCH', '/events/1', { done: true }],
    ['delete event', s => s.removeEvent('1'), 'DELETE', '/events/1'],
    ['create session', s => s.createSession(session), 'POST', '/sessions', session],
    ['delete session', s => s.removeSession('1'), 'DELETE', '/sessions/1'],
  ]
  it.each(cases)('%s sends the documented method, path, payload and bearer token', async (_name, call, method, path, payload) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json({}))
    const source = createRemoteDataSource({ baseUrl: 'https://lockin.example/api/', token: 'token-123', fetch: fetchMock })
    await call(source)
    expect(fetchMock).toHaveBeenCalledWith(`https://lockin.example/api${path}`, {
      method,
      headers: { Accept: 'application/json', Authorization: 'Bearer token-123', ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    })
  })
  it('uses the same origin by default and the configured environment origin when supplied', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => json(workspace))
    vi.stubEnv('VITE_API_BASE_URL', '')
    await createRemoteDataSource({ fetch: fetchMock }).getWorkspace()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/workspace')
    vi.stubEnv('VITE_API_BASE_URL', 'https://render.example')
    await createRemoteDataSource({ fetch: fetchMock }).getWorkspace()
    expect(fetchMock.mock.calls[1][0]).toBe('https://render.example/api/workspace')
  })
  it('never sends a saved bearer token to login, signup or health', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => json({}))
    const source = createRemoteDataSource({ token: 'stale-token', fetch: fetchMock })
    await source.signIn({ username: 'student', password: 'secret' })
    await source.signUp({ username: 'student', password: 'secret' })
    await source.health()
    for (const [, init] of fetchMock.mock.calls) expect(init?.headers).not.toHaveProperty('Authorization')
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({ username: 'student', password: 'secret', repeatPassword: 'secret' })
    expect(fetchMock.mock.calls[2][0]).toMatch(/\/api\/health$/)
  })
  it('preserves a separate signup password confirmation', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json({}))
    await createRemoteDataSource({ fetch: fetchMock }).signUp({ username: 'a', password: 'b', repeatPassword: 'c' })
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).repeatPassword).toBe('c')
  })
  it('resolves password changes without returning a response payload', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json(workspace.user))
    await expect(createRemoteDataSource({ fetch: fetchMock }).changePassword('current-password', 'new-password')).resolves.toBeUndefined()
  })
  it('throws typed server errors and signs out on protected 401 responses', async () => {
    const onUnauthorized = vi.fn()
    const source = createRemoteDataSource({ onUnauthorized, fetch: vi.fn<typeof fetch>().mockResolvedValue(json({ message: 'Session expired.' }, 401)) })
    await expect(source.getWorkspace()).rejects.toMatchObject({ name: 'DataError', status: 401, message: 'Session expired.' })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
  it('does not sign out an account for invalid login credentials', async () => {
    const onUnauthorized = vi.fn()
    const source = createRemoteDataSource({ onUnauthorized, fetch: vi.fn<typeof fetch>().mockResolvedValue(json({ message: 'Incorrect password.' }, 401)) })
    await expect(source.signIn({ username: 'a', password: 'b' })).rejects.toBeInstanceOf(DataError)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
  it('handles empty 204 deletes, non-JSON errors and network failures', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('Service unavailable', { status: 503 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const source = createRemoteDataSource({ fetch: fetchMock })
    await expect(source.removeEvent('1')).resolves.toBeNull()
    await expect(source.getWorkspace()).rejects.toMatchObject({ status: 503, message: 'Service unavailable' })
    await expect(source.getWorkspace()).rejects.toMatchObject({ status: 0, message: 'Failed to fetch' })
  })
})
