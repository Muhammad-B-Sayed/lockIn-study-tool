import type { DateOnly } from '../data/types'

export type CalendarDate = Date | DateOnly
export type DueStatus = {
  label: string
  tone: 'late' | 'soon' | 'later' | 'done'
}

/** Parse a calendar date locally, never as UTC. Invalid dates throw. */
export function parseDateOnly(value: DateOnly): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new RangeError(`Invalid date: ${value}`)
  const [, y, m, d] = match
  const date = new Date(0)
  date.setFullYear(Number(y), Number(m) - 1, Number(d))
  date.setHours(0, 0, 0, 0)
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) {
    throw new RangeError(`Invalid date: ${value}`)
  }
  return date
}

export function formatDateOnly(date: Date): DateOnly {
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid date')
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function asDate(value: CalendarDate): Date {
  return typeof value === 'string' ? parseDateOnly(value) : parseDateOnly(formatDateOnly(value))
}

export function today(now: Date): DateOnly {
  return formatDateOnly(now)
}

export function addDays(value: CalendarDate, days: number): DateOnly {
  if (!Number.isInteger(days)) throw new RangeError('Days must be an integer')
  const date = asDate(value)
  date.setDate(date.getDate() + days)
  return formatDateOnly(date)
}

/** Calendar days in later minus earlier, unaffected by daylight saving time. */
export function diffDays(later: CalendarDate, earlier: CalendarDate): number {
  const ordinal = (value: CalendarDate) => {
    const date = asDate(value)
    const utc = new Date(0)
    utc.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate())
    utc.setUTCHours(0, 0, 0, 0)
    return utc.getTime() / 86_400_000
  }
  return ordinal(later) - ordinal(earlier)
}

export function isSameDay(a: CalendarDate, b: CalendarDate): boolean {
  return diffDays(a, b) === 0
}

export function startOfWeek(value: CalendarDate): DateOnly {
  const date = asDate(value)
  return addDays(date, -((date.getDay() + 6) % 7))
}

export function weekDays(value: CalendarDate): DateOnly[] {
  const start = startOfWeek(value)
  return Array.from({ length: 7 }, (_, day) => addDays(start, day))
}

export function monthMatrix(value: CalendarDate): DateOnly[][] {
  const date = asDate(value)
  date.setDate(1)
  const start = startOfWeek(date)
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)),
  )
}

export function formatDate(value: CalendarDate, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...options }).format(asDate(value))
}

function timeMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new RangeError(`Invalid time: ${value}`)
  }
  return Number(match[1]) * 60 + Number(match[2])
}

export function formatTime(value: string): string {
  const minutes = timeMinutes(value)
  const hour = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hour % 12 || 12}${remainder ? `:${String(remainder).padStart(2, '0')}` : ''} ${hour >= 12 ? 'PM' : 'AM'}`
}

/** Signed same-day difference. An end before the start returns a negative value. */
export function minutesBetween(start: string, end: string): number {
  return timeMinutes(end) - timeMinutes(start)
}

export function relativeDue(date: DateOnly, now: CalendarDate, done = false): DueStatus {
  if (done) return { label: 'Done', tone: 'done' }
  const days = diffDays(date, now)
  if (days < 0) return { label: `${-days} ${days === -1 ? 'day' : 'days'} late`, tone: 'late' }
  if (days === 0) return { label: 'Today', tone: 'soon' }
  if (days === 1) return { label: 'Due tomorrow', tone: 'soon' }
  return { label: `In ${days} days`, tone: days <= 7 ? 'soon' : 'later' }
}
