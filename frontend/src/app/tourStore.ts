import { useSyncExternalStore } from 'react'

/**
 * The guided tour: which step is showing, and which users have finished or skipped it.
 * "Seen" is per device, in localStorage, so a new account sees the tour once and can
 * replay it from Settings, the account menu or the command palette.
 */

const SEEN_KEY = 'lockin.tour.seen.v1'
/** Set by the screenshot and accessibility scripts so the tour does not cover every screen. */
const OPT_OUT_KEY = 'lockin.tour.optout'

const listeners = new Set<() => void>()
let step: number | null = null

const emit = () => listeners.forEach((l) => l())

export function useTourStep(): number | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => step,
    () => null,
  )
}

export function startTour() {
  step = 0
  emit()
}

export function setTourStep(next: number) {
  step = next
  emit()
}

/** Close the tour, finished or skipped, and remember it for this user on this device. */
export function endTour(userId: string | null) {
  step = null
  if (userId) markSeen(userId)
  emit()
}

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function markSeen(userId: string) {
  const seen = readSeen()
  if (seen.includes(userId)) return
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, userId].slice(-20)))
  } catch {
    // Private mode or full storage: the tour may show again next time, which is harmless.
  }
}

export function hasSeenTour(userId: string): boolean {
  try {
    if (localStorage.getItem(OPT_OUT_KEY)) return true
  } catch {
    return true
  }
  return readSeen().includes(userId)
}

const NEW_ACCOUNT_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Start on its own only for someone new: the demo, an account made in the last week, or an
 * account with no courses yet. A long-time user signing in on a new device is left alone.
 */
export function shouldAutoStart(input: {
  userId: string
  mode: 'demo' | 'account'
  createdAt: string | null
  courseCount: number
  now: number
}): boolean {
  if (import.meta.env.MODE === 'test') return false
  if (hasSeenTour(input.userId)) return false
  if (input.mode === 'demo' || input.courseCount === 0) return true
  const created = input.createdAt ? Date.parse(input.createdAt) : NaN
  return Number.isFinite(created) && input.now - created < NEW_ACCOUNT_MS
}
