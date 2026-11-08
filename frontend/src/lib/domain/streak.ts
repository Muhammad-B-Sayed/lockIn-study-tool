import type { DateOnly, StudySession } from '../data/types'
import { addDays, formatDateOnly, today } from './dates'

export type DailyStudy = { date: DateOnly; minutes: number }

function sessionDays(sessions: readonly StudySession[], now: Date): Map<DateOnly, number> {
  const days = new Map<DateOnly, number>()
  for (const session of sessions) {
    const start = new Date(session.startedAt)
    if (!Number.isFinite(start.getTime()) || start > now || !Number.isFinite(session.minutes) || session.minutes <= 0) continue
    const date = formatDateOnly(start)
    days.set(date, (days.get(date) ?? 0) + session.minutes)
  }
  return days
}

/** Chronological daily totals, including today and zero-minute days. */
export function studyMinutesByDay(sessions: readonly StudySession[], now: Date, days = 21): DailyStudy[] {
  if (!Number.isInteger(days) || days < 0) throw new RangeError('Days must be a non-negative integer')
  const totals = sessionDays(sessions, now)
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(now, index - days + 1)
    return { date, minutes: totals.get(date) ?? 0 }
  })
}

/** A streak stays alive through today when the latest study day was yesterday. */
export function currentStreak(sessions: readonly StudySession[], now: Date): number {
  const totals = sessionDays(sessions, now)
  let date = today(now)
  if (!totals.has(date)) date = addDays(date, -1)
  let streak = 0
  while (totals.has(date)) {
    streak += 1
    date = addDays(date, -1)
  }
  return streak
}
