import { useEffect, useState, useSyncExternalStore } from 'react'

/** A running focus session. Lives in localStorage so it survives navigation and reloads. */
export type FocusRun = {
  topicId: string | null
  courseId: string | null
  goalMinutes: number
  startedAt: number // ms epoch of the original start
  pausedAt: number | null // ms epoch when paused
  pausedTotal: number // ms spent paused before the current pause
}

const KEY = 'lockin.focus.v1'
const listeners = new Set<() => void>()
let cache: { raw: string | null; run: FocusRun | null } = { raw: null, run: null }

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return cache.raw
  }
}

function parse(raw: string | null): FocusRun | null {
  try {
    return raw ? (JSON.parse(raw) as FocusRun) : null
  } catch {
    return null
  }
}

function read(): FocusRun | null {
  const raw = readRaw()
  if (raw === cache.raw) return cache.run
  cache = { raw, run: parse(raw) }
  return cache.run
}

function write(run: FocusRun | null) {
  try {
    if (run) localStorage.setItem(KEY, JSON.stringify(run))
    else localStorage.removeItem(KEY)
  } catch {
    cache = { raw: run ? JSON.stringify(run) : null, run }
  }
  listeners.forEach((l) => l())
}

export const focus = {
  start(input: { topicId: string | null; courseId: string | null; goalMinutes: number }) {
    write({ ...input, startedAt: Date.now(), pausedAt: null, pausedTotal: 0 })
  },
  pause() {
    const r = read()
    if (r && !r.pausedAt) write({ ...r, pausedAt: Date.now() })
  },
  resume() {
    const r = read()
    if (r?.pausedAt) write({ ...r, pausedTotal: r.pausedTotal + (Date.now() - r.pausedAt), pausedAt: null })
  },
  setGoal(goalMinutes: number) {
    const r = read()
    if (r) write({ ...r, goalMinutes })
  },
  clear() {
    write(null)
  },
}

export function elapsedMs(run: FocusRun, now = Date.now()) {
  const end = run.pausedAt ?? now
  return Math.max(0, end - run.startedAt - run.pausedTotal)
}

export function useFocusRun() {
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
    () => null,
  )
}

/** Re-renders every `ms` while active. */
export function useTick(active: boolean, ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const h = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(h)
  }, [active, ms])
  return now
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
