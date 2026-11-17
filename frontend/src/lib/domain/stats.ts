import type { DateOnly, ReviewEvent, StudySession, Topic } from '../data/types'
import { addDays, diffDays, formatDateOnly, startOfWeek, today } from './dates'

export type CourseMinutes = {
  /** null collects sessions logged without a course. */
  courseId: string | null
  minutes: number
  /** Minutes in the whole of last week. */
  previous: number
}

export type WeekStats = {
  weekStart: DateOnly
  todayMinutes: number
  /** Monday through today. */
  minutes: number
  /** Last week, Monday through the same weekday, so the comparison is like for like. */
  previousToDate: number
  previousTotal: number
  sessions: number
  reviews: number
  previousReviewsToDate: number
  byCourse: CourseMinutes[]
  bestDay: { date: DateOnly; minutes: number } | null
}

type StatsInput = {
  sessions: readonly StudySession[]
  reviews: readonly ReviewEvent[]
  topics: readonly Pick<Topic, 'id' | 'courseId'>[]
}

/** This week against last week, from the sessions and reviews the workspace already holds. */
export function weekStats(input: StatsInput, now: Date): WeekStats {
  const day = today(now)
  const weekStart = startOfWeek(day)
  const lastStart = addDays(weekStart, -7)
  const offset = diffDays(day, weekStart) // 0 on Monday
  const courseOfTopic = new Map(input.topics.map((t) => [t.id, t.courseId]))

  let minutes = 0
  let previousToDate = 0
  let previousTotal = 0
  let todayMinutes = 0
  let sessions = 0
  const perDay = new Map<DateOnly, number>()
  const perCourse = new Map<string | null, CourseMinutes>()

  for (const session of input.sessions) {
    const start = new Date(session.startedAt)
    if (!Number.isFinite(start.getTime()) || start > now || !Number.isFinite(session.minutes) || session.minutes <= 0) continue
    const date = formatDateOnly(start)
    if (date < lastStart) continue
    const courseId = session.courseId ?? (session.topicId ? courseOfTopic.get(session.topicId) ?? null : null)
    let row = perCourse.get(courseId)
    if (!row) {
      row = { courseId, minutes: 0, previous: 0 }
      perCourse.set(courseId, row)
    }
    if (date >= weekStart) {
      minutes += session.minutes
      sessions += 1
      row.minutes += session.minutes
      perDay.set(date, (perDay.get(date) ?? 0) + session.minutes)
      if (date === day) todayMinutes += session.minutes
    } else {
      previousTotal += session.minutes
      row.previous += session.minutes
      if (diffDays(date, lastStart) <= offset) previousToDate += session.minutes
    }
  }

  let reviews = 0
  let previousReviewsToDate = 0
  for (const review of input.reviews) {
    const at = new Date(review.at)
    if (!Number.isFinite(at.getTime()) || at > now) continue
    const date = formatDateOnly(at)
    if (date >= weekStart) reviews += 1
    else if (date >= lastStart && diffDays(date, lastStart) <= offset) previousReviewsToDate += 1
  }

  let bestDay: WeekStats['bestDay'] = null
  for (const [date, total] of perDay) if (!bestDay || total > bestDay.minutes) bestDay = { date, minutes: total }

  const byCourse = [...perCourse.values()]
    .filter((row) => row.minutes > 0 || row.previous > 0)
    .sort((a, b) => b.minutes - a.minutes || b.previous - a.previous)

  return { weekStart, todayMinutes, minutes, previousToDate, previousTotal, sessions, reviews, previousReviewsToDate, byCourse, bestDay }
}

/** "1h 5m", "45m", "2h". */
export function formatMinutes(total: number): string {
  const minutes = Math.max(0, Math.round(total))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}
