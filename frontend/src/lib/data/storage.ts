import type { User, Workspace } from './types'

export const SESSION_STORAGE_KEY = 'lockin.session.v1'
export const DEMO_STORAGE_KEY = 'lockin.demo.v1'
export type StoredSession = { mode: 'demo' } | { mode: 'account'; token: string; user: User }
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function browserStorage(): StorageLike | null {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}
export function readStorage(key: string, storage = browserStorage()): unknown {
  try {
    const value = storage?.getItem(key)
    return value ? JSON.parse(value) as unknown : null
  } catch { return null }
}
export function writeStorage(key: string, value: unknown, storage = browserStorage()): void {
  try {
    if (value === null) storage?.removeItem(key)
    else storage?.setItem(key, JSON.stringify(value))
  } catch { /* Private browsing and quota failures must not prevent in-memory use. */ }
}
export function isUser(value: unknown): value is User {
  return !!value && typeof value === 'object' && 'id' in value && typeof value.id === 'string'
    && 'username' in value && typeof value.username === 'string'
}
export function loadSession(storage = browserStorage()): StoredSession | null {
  const value = readStorage(SESSION_STORAGE_KEY, storage)
  if (!value || typeof value !== 'object' || !('mode' in value)) return null
  if (value.mode === 'demo') return { mode: 'demo' }
  if (value.mode === 'account' && 'token' in value && typeof value.token === 'string' && value.token
    && 'user' in value && isUser(value.user)) return { mode: 'account', token: value.token, user: value.user }
  return null
}
export function isWorkspace(value: unknown): value is Workspace {
  if (!value || typeof value !== 'object') return false
  const w = value as Partial<Workspace>
  return isUser(w.user) && ['courses', 'topics', 'assessments', 'events', 'sessions', 'reviews']
    .every(key => Array.isArray(w[key as keyof Workspace])) && typeof w.generatedAt === 'string'
}
