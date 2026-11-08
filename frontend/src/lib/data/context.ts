import { createContext, useContext } from 'react'
import type { AuthState, Credentials, Workspace } from './types'
import type { DataSource, SignupCredentials } from './source'
import type { IdRegistry } from './identity'

export type DataContextValue = {
  source: DataSource
  state: AuthState
  isCurrent: () => boolean
  enqueue: <T>(work: () => Promise<T>) => Promise<T>
  identities: IdRegistry
  signIn: (input: Credentials) => Promise<void>
  signUp: (input: SignupCredentials) => Promise<void>
  startDemo: () => Promise<void>
  signOut: () => void
  resetDemo: () => Promise<Workspace>
}
export const DataContext = createContext<DataContextValue | null>(null)
export function useDataContext(): DataContextValue {
  const context = useContext(DataContext)
  if (!context) throw new Error('Mount DataProvider before using LockIn data hooks.')
  return context
}
