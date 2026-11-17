import { useSyncExternalStore } from 'react'

/** Per-device preferences. They never leave this browser, so demo and account mode behave the same. */
export type Prefs = {
  /** Minutes of study to aim for each day. null means no goal. */
  dailyGoalMinutes: number | null
  /** Minutes offered for a break after a focus session. */
  breakMinutes: number
  /** Length of the last focus session started from the Focus page. New sessions start at this length. */
  focusMinutes: number
}

const KEY = 'lockin.prefs.v1'
const DEFAULTS: Prefs = { dailyGoalMinutes: null, breakMinutes: 5, focusMinutes: 50 }
const listeners = new Set<() => void>()
let cache: { raw: string | null; prefs: Prefs } = { raw: null, prefs: DEFAULTS }
let memory: string | null = null

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return memory
  }
}

function parse(raw: string | null): Prefs {
  if (!raw) return DEFAULTS
  try {
    const value = JSON.parse(raw) as Partial<Prefs> | null
    if (!value || typeof value !== 'object') return DEFAULTS
    const goal = value.dailyGoalMinutes
    const rest = value.breakMinutes
    const length = value.focusMinutes
    return {
      dailyGoalMinutes: typeof goal === 'number' && Number.isFinite(goal) && goal >= 5 && goal <= 1440 ? Math.round(goal) : null,
      breakMinutes: typeof rest === 'number' && Number.isFinite(rest) && rest >= 1 && rest <= 60 ? Math.round(rest) : DEFAULTS.breakMinutes,
      focusMinutes: typeof length === 'number' && Number.isFinite(length) && length >= 5 && length <= 240 ? Math.round(length) : DEFAULTS.focusMinutes,
    }
  } catch {
    return DEFAULTS
  }
}

function read(): Prefs {
  const raw = readRaw()
  if (raw === cache.raw) return cache.prefs
  cache = { raw, prefs: parse(raw) }
  return cache.prefs
}

/** The current preferences, for code that runs outside a component. */
export function getPrefs(): Prefs {
  return read()
}

export function setPrefs(patch: Partial<Prefs>) {
  const raw = JSON.stringify({ ...read(), ...patch })
  memory = raw
  try {
    localStorage.setItem(KEY, raw)
  } catch {
    /* Private browsing: the choice lasts until the tab closes. */
  }
  listeners.forEach((l) => l())
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      const onStorage = (e: StorageEvent) => e.key === KEY && cb()
      window.addEventListener('storage', onStorage)
      return () => {
        listeners.delete(cb)
        window.removeEventListener('storage', onStorage)
      }
    },
    read,
    () => DEFAULTS,
  )
}

export const DAILY_GOAL_CHOICES = [30, 45, 60, 90, 120, 180, 240]
