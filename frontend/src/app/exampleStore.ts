import { useSyncExternalStore } from 'react'

/**
 * Whether the app is showing the view-only example workspace instead of the learner's own.
 * In memory only, so a reload always returns to the learner's own workspace.
 */

const FOCUS_KEY = 'lockin.focus.v1'
const BREAK_KEY = 'lockin.break.v1'

const listeners = new Set<() => void>()
let active = false
let saved: { focus: string | null; brk: string | null } = { focus: null, brk: null }

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const restore = (key: string, value: string | null) => {
  try {
    if (read(key) === value) return
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Nothing to restore when storage is unavailable.
  }
}

export function useExampleMode(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => active,
    () => false,
  )
}

export function enterExample() {
  if (active) return
  // A focus timer or break started inside the example must not follow the learner back out.
  saved = { focus: read(FOCUS_KEY), brk: read(BREAK_KEY) }
  active = true
  listeners.forEach((l) => l())
}

export function exitExample() {
  if (!active) return
  restore(FOCUS_KEY, saved.focus)
  restore(BREAK_KEY, saved.brk)
  active = false
  listeners.forEach((l) => l())
}
