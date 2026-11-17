import { useSyncExternalStore } from 'react'
import type { ToastApi } from '../ui/toastContext'

/** A break between focus sessions. Lives in localStorage so it survives navigation and reloads. */
export type BreakRun = { endsAt: number; minutes: number }

const KEY = 'lockin.break.v1'
const listeners = new Set<() => void>()
let cache: { raw: string | null; run: BreakRun | null } = { raw: null, run: null }
let memory: string | null = null

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return memory
  }
}

function read(): BreakRun | null {
  const raw = readRaw()
  if (raw === cache.raw) return cache.run
  let run: BreakRun | null = null
  try {
    const value = raw ? (JSON.parse(raw) as Partial<BreakRun> | null) : null
    if (value && typeof value.endsAt === 'number' && Number.isFinite(value.endsAt) && typeof value.minutes === 'number') {
      run = { endsAt: value.endsAt, minutes: value.minutes }
    }
  } catch {
    run = null
  }
  cache = { raw, run }
  return run
}

function write(run: BreakRun | null) {
  memory = run ? JSON.stringify(run) : null
  try {
    if (memory) localStorage.setItem(KEY, memory)
    else localStorage.removeItem(KEY)
  } catch {
    /* Private browsing: the break lasts until the tab closes. */
  }
  listeners.forEach((l) => l())
}

export const breakTimer = {
  start(minutes: number) {
    write({ endsAt: Date.now() + minutes * 60_000, minutes })
  },
  clear() {
    if (read()) write(null)
  },
}

export function useBreakRun() {
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

/** Two soft notes. Audio is optional, so every failure is ignored. */
export function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ;[659.25, 987.77].forEach((frequency, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = frequency
      const t0 = ctx.currentTime + i * 0.18
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(0.12, t0 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4)
      o.connect(g).connect(ctx.destination)
      o.start(t0)
      o.stop(t0 + 1.5)
    })
    window.setTimeout(() => void ctx.close(), 2200)
  } catch {
    /* audio is optional */
  }
}

/** Offer a break in a toast. Called after a focus session is saved. */
export function offerBreak(toast: ToastApi, minutes: number) {
  toast.show({ message: `Take a ${minutes} minute break?`, action: { label: 'Start break', run: () => breakTimer.start(minutes) } }, 20_000)
}
