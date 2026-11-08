import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DataContext } from './context'
import { createLocalDataSource } from './local'
import { createRemoteDataSource } from './remote'
import { createIdRegistry } from './identity'
import { asDataError, DataError } from './source'
import type { DataSource, SignupCredentials } from './source'
import { loadSession, SESSION_STORAGE_KEY, writeStorage } from './storage'
import type { StoredSession } from './storage'
import type { AuthState, Credentials, Workspace } from './types'

export type DataProviderProps = {
  children: ReactNode
  /** Overrides support isolated tests and embedded workspaces. */
  dataSource?: DataSource
  initialSession?: StoredSession | null
  queryClient?: QueryClient
  wakeBackend?: boolean
}
export function DataProvider({ children, dataSource, initialSession, queryClient, wakeBackend = true }: DataProviderProps) {
  const [client] = useState(() => queryClient ?? new QueryClient({ defaultOptions: {
    queries: { staleTime: 30_000, retry: (count, error) => !(error instanceof DataError && error.status >= 400 && error.status < 500) && count < 1 },
    mutations: { retry: false },
  } }))
  const [auth, setAuth] = useState(() => ({ session: initialSession === undefined ? loadSession() : initialSession, revision: 0 }))
  const epoch = useRef(0)
  const [identities] = useState(createIdRegistry)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const transition = useCallback((session: StoredSession | null) => {
    epoch.current += 1
    identities.clear()
    const revision = epoch.current
    writeStorage(SESSION_STORAGE_KEY, session)
    // Cancel reads and erase the previous learner's cached data before switching adapters.
    void client.cancelQueries()
    client.clear()
    queue.current = Promise.resolve()
    setAuth({ session, revision })
  }, [client, identities])
  const signOut = useCallback(() => transition(null), [transition])
  const onUnauthorized = useCallback(() => { if (epoch.current === auth.revision) signOut() }, [auth.revision, signOut])
  // The factory stores onUnauthorized for later requests; it never invokes it during render.
  // eslint-disable-next-line react-hooks/refs
  const remote = useMemo(() => createRemoteDataSource({
    token: auth.session?.mode === 'account' ? auth.session.token : undefined,
    onUnauthorized,
  }), [auth, onUnauthorized])
  const source = useMemo(() => dataSource ?? (auth.session?.mode === 'demo' ? createLocalDataSource() : remote), [dataSource, auth.session, remote])
  const enqueue = useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
    const revision = auth.revision
    const run = queue.current.then(() => {
      if (epoch.current !== revision) throw new DataError(401, 'Your session changed. Please try again.')
      return work()
    })
    queue.current = run.catch(() => {})
    return run
  }, [auth.revision])
  useEffect(() => {
    if (wakeBackend) void createRemoteDataSource().health().catch(() => {})
  }, [wakeBackend])
  useEffect(() => {
    if (auth.session?.mode === 'account' && !dataSource) void remote.getProfile().catch(() => {})
  }, [auth.session, dataSource, remote])
  const authenticate = useCallback(async (kind: 'signIn' | 'signUp', input: SignupCredentials) => {
    const revision = epoch.current
    try {
      const session = await remote[kind](input)
      if (revision === epoch.current) transition({ mode: 'account', token: session.accessToken, user: session.user })
    } catch (error) { throw asDataError(error) }
  }, [remote, transition])
  const startDemo = useCallback(async () => {
    const revision = epoch.current
    const demo = createLocalDataSource()
    const workspace = await demo.getWorkspace()
    if (epoch.current !== revision) throw new DataError(401, 'Your session changed. Please try again.')
    transition({ mode: 'demo' })
    client.setQueryData(['workspace'], workspace)
  }, [client, transition])
  const resetDemo = useCallback(async (): Promise<Workspace> => {
    if (auth.session?.mode !== 'demo' || !('resetDemo' in source) || typeof source.resetDemo !== 'function') throw new DataError(400, 'Only demo workspaces can be reset.')
    const reset = source.resetDemo
    return enqueue(async () => {
      await client.cancelQueries({ queryKey: ['workspace'] })
      if (epoch.current !== auth.revision) throw new DataError(401, 'Your session changed. Please try again.')
      const workspace = await reset() as Workspace
      if (epoch.current === auth.revision) client.setQueryData(['workspace'], workspace)
      return workspace
    })
  }, [auth, source, enqueue, client])
  const state: AuthState = auth.session?.mode === 'account'
    ? { status: 'signed-in', mode: 'account', user: auth.session.user }
    : auth.session?.mode === 'demo'
      ? { status: 'signed-in', mode: 'demo', user: { id: 'demo-student', username: 'Alex', createdAt: null } }
      : { status: 'signed-out' }
  return <QueryClientProvider client={client}>
    <DataContext.Provider value={{ source, state, enqueue, identities, isCurrent: () => epoch.current === auth.revision,
      signIn: (input: Credentials) => authenticate('signIn', input),
      signUp: input => authenticate('signUp', input), startDemo, signOut, resetDemo,
    }}>{children}</DataContext.Provider>
  </QueryClientProvider>
}
