import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataProvider } from './provider'
import { useAccount, useAuth, useCourseMutations, useRateTopic, useTopicMutations, useWorkspace, WORKSPACE_QUERY_KEY } from './hooks'
import { createLocalDataSource } from './local'
import { createDemoWorkspace } from './seed'
import { DataError } from './source'
import { DEMO_STORAGE_KEY, SESSION_STORAGE_KEY } from './storage'
import type { DataSource } from './source'
import type { Course, Topic, Workspace } from './types'

const now = new Date('2026-11-07T12:00:00Z')
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail })
  return { resolve, reject, promise }
}
function setup(source: DataSource = createLocalDataSource({ now: () => now })) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } })
  client.setQueryData(WORKSPACE_QUERY_KEY, createDemoWorkspace(now))
  const wrapper = ({ children }: { children: ReactNode }) => <DataProvider dataSource={source} initialSession={{ mode: 'demo' }} queryClient={client} wakeBackend={false}>{children}</DataProvider>
  return { client, wrapper }
}
beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('optimistic workspace transactions', () => {
  it('shows an update immediately, then restores the exact previous cache on failure', async () => {
    const source = createLocalDataSource({ now: () => now })
    const pending = deferred<Course>()
    vi.spyOn(source, 'updateCourse').mockReturnValue(pending.promise)
    const { client, wrapper } = setup(source)
    const before = client.getQueryData<Workspace>(WORKSPACE_QUERY_KEY)!
    const { result } = renderHook(() => ({ mutations: useCourseMutations(), query: useWorkspace() }), { wrapper })
    let task!: Promise<Course>
    act(() => { task = result.current.mutations.update(before.courses[0].id, { name: 'Optimistic course' }) })
    await waitFor(() => expect(result.current.query.data?.courses[0].name).toBe('Optimistic course'))
    const failure = new DataError(503, 'Try again shortly.')
    const caught = task.catch(error => error)
    await act(async () => { pending.reject(failure); expect(await caught).toBe(failure) })
    expect(client.getQueryData(WORKSPACE_QUERY_KEY)).toEqual(before)
  })
  it('replaces temporary ids and resources with the full server response', async () => {
    const source = createLocalDataSource({ now: () => now })
    const pending = deferred<Topic>()
    vi.spyOn(source, 'createTopic').mockReturnValue(pending.promise)
    const { client, wrapper } = setup(source)
    const base = createDemoWorkspace(now).topics[0]
    const { result } = renderHook(() => useTopicMutations(), { wrapper })
    let task!: Promise<Topic>
    act(() => { task = result.current.create({ ...base, title: 'New topic', resources: [{ label: 'Docs', url: 'https://example.com' }] }) })
    await waitFor(() => expect(client.getQueryData<Workspace>(WORKSPACE_QUERY_KEY)?.topics.at(-1)?.id).toMatch(/^temp-/))
    const response = { ...base, id: 'server-topic', title: 'New topic', resources: [{ id: 'server-resource', label: 'Docs', url: 'https://example.com' }] }
    await act(async () => { pending.resolve(response); await task })
    const topics = client.getQueryData<Workspace>(WORKSPACE_QUERY_KEY)!.topics
    expect(topics.at(-1)).toEqual(response)
    expect(topics.some(t => t.id.startsWith('temp-'))).toBe(false)
  })
  it('serializes mutations across hooks so rollback never erases a subsequent edit', async () => {
    const source = createLocalDataSource({ now: () => now })
    const pending = deferred<Course>()
    const originalUpdate = source.updateCourse
    const update = vi.spyOn(source, 'updateCourse').mockImplementationOnce(() => pending.promise).mockImplementation(originalUpdate)
    // mockImplementation above replaces the default only, retaining the one-time response.
    const { client, wrapper } = setup(source)
    const courseId = createDemoWorkspace(now).courses[0].id
    const { result } = renderHook(() => ({ first: useCourseMutations(), second: useCourseMutations() }), { wrapper })
    let first!: Promise<unknown>, second!: Promise<Course>
    act(() => {
      first = result.current.first.update(courseId, { name: 'Will fail' }).catch(error => error)
      second = result.current.second.update(courseId, { name: 'Will stick' })
    })
    await waitFor(() => expect(update).toHaveBeenCalledOnce())
    await act(async () => { pending.reject(new DataError(503, 'Unavailable')); await first; await second })
    expect(client.getQueryData<Workspace>(WORKSPACE_QUERY_KEY)?.courses[0].name).toBe('Will stick')
  })
  it('rates and undoes through the hook, preserving confidence and review time', async () => {
    const { client, wrapper } = setup()
    const original = client.getQueryData<Workspace>(WORKSPACE_QUERY_KEY)!.topics[0]
    const { result } = renderHook(() => useRateTopic(), { wrapper })
    await act(async () => {
      const { undo } = await result.current.rate({ topicId: original.id, rating: 'shaky', source: 'focus' })
      expect(client.getQueryData<Workspace>(WORKSPACE_QUERY_KEY)!.topics[0].confidence).toBe('shaky')
      await undo()
    })
    expect(client.getQueryData<Workspace>(WORKSPACE_QUERY_KEY)!.topics[0]).toEqual(original)
  })
  it('does not restore a previous account cache when an in-flight mutation fails after sign-out', async () => {
    const source = createLocalDataSource({ now: () => now })
    const pending = deferred<Course>()
    vi.spyOn(source, 'updateCourse').mockReturnValue(pending.promise)
    const { client, wrapper } = setup(source)
    const { result } = renderHook(() => ({ mutations: useCourseMutations(), auth: useAuth() }), { wrapper })
    let task!: Promise<unknown>
    act(() => { task = result.current.mutations.update('course-csc369', { name: 'Pending' }).catch(error => error) })
    await waitFor(() => expect(source.updateCourse).toHaveBeenCalledOnce())
    act(() => result.current.auth.signOut())
    await act(async () => { pending.reject(new DataError(401, 'Expired')); await task })
    expect(client.getQueryData(WORKSPACE_QUERY_KEY)).toBeUndefined()
    expect(result.current.auth.state.status).toBe('signed-out')
  })
})

describe('provider and account lifecycle', () => {
  it('forwards both passwords and returns void while preserving typed failures', async () => {
    const source = createLocalDataSource({ now: () => now })
    const failure = new DataError(400, 'Current password is incorrect.')
    const changePassword = vi.spyOn(source, 'changePassword').mockResolvedValueOnce(undefined).mockRejectedValueOnce(failure)
    const { wrapper } = setup(source)
    const { result } = renderHook(() => useAccount(), { wrapper })
    await act(async () => {
      await expect(result.current.changePassword('current-password', 'new-password')).resolves.toBeUndefined()
    })
    expect(changePassword).toHaveBeenCalledWith('current-password', 'new-password')
    await act(async () => {
      await expect(result.current.changePassword('incorrect-password', 'new-password')).rejects.toBe(failure)
    })
  })
  it('wakes the remote server on mount, even while signed out', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = ({ children }: { children: ReactNode }) => <DataProvider initialSession={null}>{children}</DataProvider>
    renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/health$/), expect.anything()))
  })
  it('seeds demo once, retains it after sign-out, and reseeds on reset', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => <DataProvider initialSession={null} wakeBackend={false}>{children}</DataProvider>
    const { result } = renderHook(() => ({ auth: useAuth(), workspace: useWorkspace(), account: useAccount(), courses: useCourseMutations() }), { wrapper })
    await act(async () => { await result.current.auth.startDemo() })
    await waitFor(() => expect(result.current.workspace.data?.courses).toHaveLength(6))
    await act(async () => { await result.current.courses.update('course-csc369', { name: 'Saved in demo' }) })
    act(() => result.current.auth.signOut())
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toContain('Saved in demo')
    await act(async () => { await result.current.auth.startDemo() })
    await waitFor(() => expect(result.current.workspace.data?.courses[0].name).toBe('Saved in demo'))
    await act(async () => { await result.current.account.resetDemo() })
    await waitFor(() => expect(result.current.workspace.data?.courses[0].name).toBe('Operating Systems'))
    expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)!)).toEqual({ mode: 'demo' })
  })
  it('exports a JSON Blob without demo undo metadata', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useAccount(), { wrapper })
    let blob!: Blob
    await act(async () => { blob = await result.current.exportData() })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/json')
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(blob)
    })
    expect(JSON.parse(text).courses).toHaveLength(6)
    expect(text).not.toContain('_reviewPreviousDates')
  })
  it('loads an account session and clears it on a protected 401', async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ mode: 'account', token: 'expired', user: createDemoWorkspace(now).user }))
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ message: 'Expired' }), { status: 401 })))
    const wrapper = ({ children }: { children: ReactNode }) => <DataProvider wakeBackend={false}>{children}</DataProvider>
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.state.status).toBe('signed-out'))
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })
})
