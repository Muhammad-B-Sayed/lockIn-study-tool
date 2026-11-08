import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as localAdapters from './local'
import { DataProvider } from './provider'
import { useAssessmentMutations, useAuth, useCourseMutations, useSessionMutations, useTopicMutations, WORKSPACE_QUERY_KEY } from './hooks'
import { createDemoWorkspace } from './seed'
import { createRemoteDataSource } from './remote'
import type { Course, Topic, TopicInput, Workspace } from './types'

const now = new Date(2026, 10, 7, 12)
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(yes => { resolve = yes })
  return { promise, resolve }
}
function setup() {
  const source = localAdapters.createLocalDataSource({ now: () => now, storage: null })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } })
  const workspace = createDemoWorkspace(now)
  client.setQueryData(WORKSPACE_QUERY_KEY, workspace)
  const wrapper = ({ children }: { children: ReactNode }) => <DataProvider dataSource={source} initialSession={{ mode: 'demo' }} queryClient={client} wakeBackend={false}>{children}</DataProvider>
  return { source, client, workspace, wrapper }
}
beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('session changes during optimistic work', () => {
  it.each(['cancel', 'workspace-read', 'optimistic-write', 'optimistic-read', 'cache-write'] as const)('stops at %s without sending a stale write or restoring the cache', async checkpoint => {
    const { source, client, workspace, wrapper } = setup()
    const gate = deferred<void>()
    const reached = deferred<void>()
    const create = vi.spyOn(source, 'createCourse')
    if (checkpoint === 'cancel') vi.spyOn(client, 'cancelQueries').mockImplementationOnce(async () => { reached.resolve(); await gate.promise })
    if (checkpoint === 'workspace-read') {
      client.removeQueries({ queryKey: WORKSPACE_QUERY_KEY })
      vi.spyOn(source, 'getWorkspace').mockImplementationOnce(async () => { reached.resolve(); await gate.promise; return workspace })
    }
    if (checkpoint === 'optimistic-write' || checkpoint === 'optimistic-read') {
      const factory = localAdapters.createLocalDataSource
      vi.spyOn(localAdapters, 'createLocalDataSource').mockImplementation(options => {
        const local = factory(options)
        if (checkpoint === 'optimistic-write') {
          const original = local.createCourse
          local.createCourse = async input => { const result = await original(input); reached.resolve(); await gate.promise; return result }
        } else {
          const original = local.getWorkspace
          local.getWorkspace = async () => { const result = await original(); reached.resolve(); await gate.promise; return result }
        }
        return local
      })
    }
    const { result } = renderHook(() => ({ courses: useCourseMutations(), auth: useAuth() }), { wrapper })
    const unsubscribe = client.getQueryCache().subscribe(event => {
      if (checkpoint === 'cache-write' && event.type === 'updated'
        && (event.query.state.data as Workspace | undefined)?.courses.some(c => c.id.startsWith('temp-'))) {
        result.current.auth.signOut()
        reached.resolve()
      }
    })
    let task!: Promise<unknown>
    act(() => { task = result.current.courses.create(workspace.courses[0]).catch(error => error) })
    await reached.promise
    if (checkpoint !== 'cache-write') act(() => result.current.auth.signOut())
    await act(async () => { gate.resolve(); expect(await task).toMatchObject({ status: 401 }) })
    expect(create).not.toHaveBeenCalled()
    expect(client.getQueryData(WORKSPACE_QUERY_KEY)).toBeUndefined()
    unsubscribe()
  })
})

describe('queued temporary ids', () => {
  it('resolves entity ids, courseId, topicId and topicIds at dequeue time', async () => {
    const { source, client, workspace, wrapper } = setup()
    const courseGate = deferred<void>(), topicGate = deferred<void>()
    const originalCourse = source.createCourse, originalTopic = source.createTopic
    vi.spyOn(source, 'createCourse').mockImplementation(async input => { const row = await originalCourse(input); await courseGate.promise; return row })
    const createTopic = vi.spyOn(source, 'createTopic').mockImplementation(async input => { const row = await originalTopic(input); await topicGate.promise; return row })
    const updateCourse = vi.spyOn(source, 'updateCourse'), removeTopic = vi.spyOn(source, 'removeTopic')
    const createAssessments = vi.spyOn(source, 'createAssessments'), createSession = vi.spyOn(source, 'createSession')
    const { result } = renderHook(() => ({ courses: useCourseMutations(), topics: useTopicMutations(), assessments: useAssessmentMutations(), sessions: useSessionMutations() }), { wrapper })
    let courseTask!: Promise<Course>, topicTask!: Promise<Topic>, updateTask!: Promise<Course>
    act(() => { courseTask = result.current.courses.create({ ...workspace.courses[0], code: 'NEW101' }) })
    await waitFor(() => expect(client.getQueryData<Workspace>(WORKSPACE_QUERY_KEY)?.courses.at(-1)?.id).toMatch(/^temp-/))
    const temporaryCourse = client.getQueryData<Workspace>(WORKSPACE_QUERY_KEY)!.courses.at(-1)!.id
    act(() => {
      updateTask = result.current.courses.update(temporaryCourse, { name: 'Queued rename' })
      topicTask = result.current.topics.create({ ...workspace.topics[0], resources: [], courseId: temporaryCourse })
    })
    await act(async () => { courseGate.resolve(); await courseTask; await updateTask })
    await waitFor(() => expect(client.getQueryData<Workspace>(WORKSPACE_QUERY_KEY)?.topics.at(-1)?.id).toMatch(/^temp-/))
    const temporaryTopic = client.getQueryData<Workspace>(WORKSPACE_QUERY_KEY)!.topics.at(-1)!.id
    const realCourse = (await courseTask).id
    let rest!: Promise<unknown>
    act(() => {
      rest = Promise.all([
        result.current.assessments.createMany([{ ...workspace.assessments[0], courseId: temporaryCourse, topicIds: [temporaryTopic], notes: temporaryCourse }]),
        result.current.sessions.create({ topicId: temporaryTopic, courseId: temporaryCourse, startedAt: now.toISOString(), minutes: 25, note: null }),
        result.current.topics.remove(temporaryTopic),
      ])
    })
    await act(async () => { topicGate.resolve(); await rest })
    const realTopic = (await topicTask).id
    expect(updateCourse).toHaveBeenCalledWith(realCourse, { name: 'Queued rename' })
    expect(createTopic).toHaveBeenCalledWith(expect.objectContaining({ courseId: realCourse }))
    expect(removeTopic).toHaveBeenCalledWith(realTopic)
    expect(createAssessments).toHaveBeenCalledWith([expect.objectContaining({ courseId: realCourse, topicIds: [realTopic] })])
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ courseId: realCourse, topicId: realTopic }))
    const cached = client.getQueryData<Workspace>(WORKSPACE_QUERY_KEY)!
    const assessment = cached.assessments.at(-1)!
    expect(assessment.courseId).toBe(realCourse)
    expect(assessment.notes).toBe(temporaryCourse) // Arbitrary text must not be rewritten.
    // Delete cascades remove the session and topic link after both writes succeed.
    expect(assessment.topicIds).toEqual([])
    expect(cached.topics.some(t => t.id === realTopic)).toBe(false)
  })
})

describe('learner-local planned dates', () => {
  it('preserves explicit dates and null in demo creation and updates, deriving only when omitted', async () => {
    const { source, workspace } = setup()
    const base: TopicInput = { ...workspace.topics[0], resources: [], plannedDate: '2026-11-07', plannedStart: '2026-11-08T04:30:00Z' }
    const created = await source.createTopic(base)
    expect(created.plannedDate).toBe('2026-11-07')
    expect((await source.updateTopic(created.id, { plannedDate: '2026-11-06', plannedStart: base.plannedStart })).plannedDate).toBe('2026-11-06')
    expect((await source.updateTopic(created.id, { plannedDate: null, plannedStart: base.plannedStart })).plannedDate).toBeNull()
    const start = new Date(2026, 10, 10, 23, 30).toISOString()
    expect((await source.updateTopic(created.id, { plannedStart: start })).plannedDate).toBe('2026-11-10')
    const omitted: Partial<TopicInput> = { ...base, plannedStart: start }
    delete omitted.plannedDate
    expect((await source.createTopic(omitted as TopicInput)).plannedDate).toBe('2026-11-10')
  })
  it('uses the same rule for remote create, bulk create and patch payloads', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => new Response('{}'))
    const source = createRemoteDataSource({ fetch: fetchMock })
    const base: TopicInput = { ...createDemoWorkspace(now).topics[0], resources: [], plannedDate: '2026-11-07', plannedStart: '2026-11-08T04:30:00Z' }
    await source.createTopic(base)
    await source.updateTopic('topic', { plannedDate: null, plannedStart: base.plannedStart })
    const start = new Date(2026, 10, 10, 23, 30).toISOString()
    await source.updateTopic('topic', { plannedStart: start })
    const omitted: Partial<TopicInput> = { ...base, plannedStart: start }; delete omitted.plannedDate
    await source.createTopics([omitted as TopicInput])
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(init!.body as string))
    expect(bodies[0].plannedDate).toBe('2026-11-07')
    expect(bodies[1].plannedDate).toBeNull()
    expect(bodies[2].plannedDate).toBe('2026-11-10')
    expect(bodies[3].topics[0].plannedDate).toBe('2026-11-10')
  })
})

describe('insertion-ordered undo', () => {
  it('keeps the latest review undoable after clock rollback, reload and out-of-order persisted arrays', async () => {
    let clock = new Date(now)
    let id = 0
    const options = { now: () => clock, makeId: () => `review-clock-${++id}` }
    const source = localAdapters.createLocalDataSource(options)
    const topic = (await source.getWorkspace()).topics[0]
    const first = await source.rateTopic({ topicId: topic.id, rating: 'okay', source: 'review' })
    clock = new Date(clock.getTime() - 86400000)
    const second = await source.rateTopic({ topicId: topic.id, rating: 'shaky', source: 'focus' })
    const raw = JSON.parse(localStorage.getItem('lockin.demo.v1')!)
    raw.reviews.reverse()
    localStorage.setItem('lockin.demo.v1', JSON.stringify(raw))
    const reloaded = localAdapters.createLocalDataSource(options)
    await expect(reloaded.undoReview(first.review.id)).rejects.toMatchObject({ status: 409 })
    expect((await reloaded.undoReview(second.review.id)).topic.lastReviewedAt).toBe(first.review.at)
    expect((await reloaded.undoReview(first.review.id)).topic).toEqual(topic)
  })
})
