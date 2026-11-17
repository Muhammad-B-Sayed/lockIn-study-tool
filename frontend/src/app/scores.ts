import { useSyncExternalStore } from 'react'

/**
 * Scores on graded work and the grade a learner is aiming for, per device.
 * The data contract has no score field, so these stay in this browser.
 */
export type ScoreBook = {
  /** Percent earned, keyed by assessment id. */
  scores: Record<string, number>
  /** Target final grade in percent, keyed by course id. */
  targets: Record<string, number>
}

const KEY = 'lockin.scores.v1'
const EMPTY: ScoreBook = { scores: {}, targets: {} }
const listeners = new Set<() => void>()
let cache: { raw: string | null; book: ScoreBook } = { raw: null, book: EMPTY }
let memory: string | null = null

function numbers(value: unknown, max: number): Record<string, number> {
  const out: Record<string, number> = {}
  if (!value || typeof value !== 'object') return out
  for (const [key, n] of Object.entries(value)) if (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max) out[key] = n
  return out
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return memory
  }
}

function read(): ScoreBook {
  const raw = readRaw()
  if (raw === cache.raw) return cache.book
  let book = EMPTY
  try {
    const value = raw ? (JSON.parse(raw) as Partial<ScoreBook> | null) : null
    if (value && typeof value === 'object') book = { scores: numbers(value.scores, 200), targets: numbers(value.targets, 100) }
  } catch {
    book = EMPTY
  }
  cache = { raw, book }
  return book
}

function write(book: ScoreBook) {
  const raw = JSON.stringify(book)
  memory = raw
  try {
    localStorage.setItem(KEY, raw)
  } catch {
    /* Private browsing: scores last until the tab closes. */
  }
  listeners.forEach((l) => l())
}

export function setScore(assessmentId: string, score: number | null) {
  const book = read()
  const scores = { ...book.scores }
  if (score === null) delete scores[assessmentId]
  else scores[assessmentId] = score
  write({ ...book, scores })
}

export function setTarget(courseId: string, target: number | null) {
  const book = read()
  const targets = { ...book.targets }
  if (target === null) delete targets[courseId]
  else targets[courseId] = target
  write({ ...book, targets })
}

export function useScoreBook(): ScoreBook {
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
    () => EMPTY,
  )
}
