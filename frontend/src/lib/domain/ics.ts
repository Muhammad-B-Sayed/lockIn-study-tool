import type { Assessment, CalendarEvent, Course, Topic } from '../data/types'
import { addDays } from './dates'

export type IcsInput = {
  courses: readonly Course[]
  topics: readonly Topic[]
  assessments: readonly Assessment[]
  events: readonly CalendarEvent[]
}

export type IcsResult = { text: string; deadlines: number; studyBlocks: number; events: number }

const pad = (n: number) => String(n).padStart(2, '0')
const compactDate = (date: string) => date.replaceAll('-', '')
const compactTime = (time: string) => `${time.replace(':', '')}00`

/** Escape a TEXT value (RFC 5545 section 3.3.11). */
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Fold a content line so no line is longer than 75 bytes. */
function fold(line: string): string {
  const encoder = new TextEncoder()
  let out = ''
  let width = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    if (width + size > 74) {
      out += '\r\n '
      width = 1
    }
    out += char
    width += size
  }
  return out
}

function utcStamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

/** Local wall-clock time minus some minutes, clamped to the start of that day. */
function minutesBefore(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = Math.max(0, h * 60 + m - minutes)
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

/**
 * An iCalendar file with open deadlines, planned topics and personal events.
 * Times without an offset are written as floating local times, so they stay at
 * the same wall-clock time wherever the calendar app opens them.
 */
export function buildIcs(input: IcsInput, now: Date, sinceDays = 30): IcsResult {
  const stamp = utcStamp(now)
  const from = addDays(now, -sinceDays)
  const code = new Map(input.courses.map((c) => [c.id, c.code]))
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LockIn//Study planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:LockIn']
  let deadlines = 0
  let studyBlocks = 0
  let events = 0

  const event = (uid: string, summary: string, when: string[], description?: string | null) => {
    lines.push('BEGIN:VEVENT', `UID:${uid}@lockin`, `DTSTAMP:${stamp}`, ...when, `SUMMARY:${escapeText(summary)}`)
    if (description?.trim()) lines.push(`DESCRIPTION:${escapeText(description.trim())}`)
    lines.push('END:VEVENT')
  }
  const allDay = (date: string) => [`DTSTART;VALUE=DATE:${compactDate(date)}`, `DTEND;VALUE=DATE:${compactDate(addDays(date, 1))}`]

  for (const a of input.assessments) {
    if (a.done || a.dueDate < from) continue
    const prefix = a.courseId && code.get(a.courseId) ? `${code.get(a.courseId)} ` : ''
    const summary = `${prefix}${a.title} due`
    const detail = [a.weight != null ? `Worth ${a.weight}% of the final grade.` : null, a.notes].filter(Boolean).join('\n')
    const when = a.dueTime
      ? [`DTSTART:${compactDate(a.dueDate)}T${compactTime(minutesBefore(a.dueTime, 30))}`, `DTEND:${compactDate(a.dueDate)}T${compactTime(a.dueTime)}`]
      : allDay(a.dueDate)
    event(`a-${a.id}`, summary, when, detail)
    deadlines += 1
  }

  for (const t of input.topics) {
    if (t.confidence === 'retired' || !t.plannedDate || t.plannedDate < from) continue
    const prefix = code.get(t.courseId) ? `${code.get(t.courseId)} ` : ''
    const start = t.plannedStart ? new Date(t.plannedStart) : null
    const when =
      start && Number.isFinite(start.getTime())
        ? [`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(new Date(start.getTime() + (t.plannedMinutes ?? 60) * 60_000))}`]
        : allDay(t.plannedDate)
    event(`t-${t.id}`, `${prefix}Study: ${t.title}`, when, t.details)
    studyBlocks += 1
  }

  for (const e of input.events) {
    if (e.date < from) continue
    const when = e.startTime
      ? [
          `DTSTART:${compactDate(e.date)}T${compactTime(e.startTime)}`,
          ...(e.endTime ? [`DTEND:${compactDate(e.date)}T${compactTime(e.endTime)}`] : ['DURATION:PT1H']),
        ]
      : allDay(e.date)
    event(`e-${e.id}`, e.title, when)
    events += 1
  }

  lines.push('END:VCALENDAR')
  return { text: `${lines.map(fold).join('\r\n')}\r\n`, deadlines, studyBlocks, events }
}
