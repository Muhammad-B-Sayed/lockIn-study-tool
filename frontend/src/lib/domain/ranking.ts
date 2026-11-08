// Score = confidence weight + min(days / max(1, target interval), 4) * 10
// + (22 - days until nearest exam or quiz) * 2. Confidence always wins.
import type { Confidence, DateOnly, Topic, Workspace } from '../data/types'
import { addDays, diffDays, formatDateOnly, type CalendarDate } from './dates'

export const REVIEW_TARGET_INTERVALS: Readonly<Record<Confidence, number>> = {
  shaky: 1, unrated: 0, okay: 3, solid: 7, retired: 0,
}
export const REVIEW_CONFIDENCE_WEIGHTS: Readonly<Record<Confidence, number>> = {
  shaky: 400, unrated: 300, okay: 200, solid: 100, retired: 0,
}
export const REVIEW_WEIGHTS = { elapsed: 10, maxIntervals: 4, assessment: 2, assessmentWindowDays: 21 } as const
export const REVIEW_PULL_FORWARD_WINDOW_DAYS = 7

export type RankedReview = { topic: Topic; score: number; reasons: string[] }

/** Earliest queue entry on or after now, assuming no further ratings or edits. */
export function nextDueDate(topic: Topic, workspace: Workspace, now: CalendarDate): DateOnly | null {
  if (topic.confidence === 'retired' || workspace.courses.some((course) => course.id === topic.courseId && course.status === 'archived')) return null
  const day = addDays(now, 0)
  if (topic.confidence === 'unrated') {
    return topic.plannedDate ? (diffDays(topic.plannedDate, day) > 0 ? topic.plannedDate : day) : null
  }

  const reviewed = topic.lastReviewedAt ? new Date(topic.lastReviewedAt) : null
  if (!reviewed || !Number.isFinite(reviewed.getTime())) {
    // Only shaky has a never-reviewed rule. Okay and solid require a dated check-in.
    return topic.confidence === 'shaky' ? day : null
  }
  const reviewDay = formatDateOnly(reviewed)
  const notBeforeToday = (date: DateOnly) => diffDays(date, day) > 0 ? date : day
  let next = notBeforeToday(addDays(reviewDay, REVIEW_TARGET_INTERVALS[topic.confidence]))
  const pullForwardAge = topic.confidence === 'solid' ? 3 : 1
  for (const assessment of workspace.assessments) {
    if (assessment.done || (assessment.kind !== 'exam' && assessment.kind !== 'quiz')) continue
    if (assessment.courseId !== topic.courseId && !assessment.topicIds.includes(topic.id)) continue
    if (diffDays(assessment.dueDate, day) < 0) continue
    const windowStart = addDays(assessment.dueDate, -REVIEW_PULL_FORWARD_WINDOW_DAYS)
    const eligibleByAge = addDays(reviewDay, pullForwardAge)
    const candidate = notBeforeToday(diffDays(windowStart, eligibleByAge) > 0 ? windowStart : eligibleByAge)
    if (diffDays(candidate, assessment.dueDate) <= 0 && diffDays(candidate, next) < 0) next = candidate
  }
  return next
}

export function rankReview(workspace: Workspace, now: CalendarDate, options: { courseId?: string } = {}): RankedReview[] {
  return workspace.topics.flatMap((topic): RankedReview[] => {
    if (options.courseId && topic.courseId !== options.courseId) return []
    const due = nextDueDate(topic, workspace, now)
    if (!due || diffDays(due, now) > 0) return []

    const labels: Record<Confidence, string> = {
      shaky: 'Shaky', unrated: 'Not rated', okay: 'Getting there', solid: 'Solid', retired: 'Not tested',
    }
    const reasons = [labels[topic.confidence]]
    let days = 0
    const reviewed = topic.lastReviewedAt ? new Date(topic.lastReviewedAt) : null
    if (reviewed && Number.isFinite(reviewed.getTime())) {
      days = Math.max(0, diffDays(now, formatDateOnly(reviewed)))
      reasons.push(days === 0 ? 'Reviewed today' : `Last reviewed ${days} ${days === 1 ? 'day' : 'days'} ago`)
    } else {
      reasons.push('Never reviewed')
      if (topic.plannedDate) days = Math.max(0, diffDays(now, topic.plannedDate))
    }
    let score = REVIEW_CONFIDENCE_WEIGHTS[topic.confidence]
      + Math.min(days / Math.max(1, REVIEW_TARGET_INTERVALS[topic.confidence]), REVIEW_WEIGHTS.maxIntervals) * REVIEW_WEIGHTS.elapsed

    const nearest = workspace.assessments
      .filter((assessment) => !assessment.done && (assessment.kind === 'exam' || assessment.kind === 'quiz')
        && (assessment.courseId === topic.courseId || assessment.topicIds.includes(topic.id)))
      .map((assessment) => ({ assessment, days: diffDays(assessment.dueDate, now) }))
      .filter(({ days: until }) => until >= 0 && until <= REVIEW_WEIGHTS.assessmentWindowDays)
      .sort((a, b) => a.days - b.days)[0]
    if (nearest) {
      score += (REVIEW_WEIGHTS.assessmentWindowDays + 1 - nearest.days) * REVIEW_WEIGHTS.assessment
      const kind = nearest.assessment.kind === 'exam' ? 'Exam' : 'Quiz'
      reasons.push(nearest.days === 0 ? `${kind} today` : `${kind} in ${nearest.days} ${nearest.days === 1 ? 'day' : 'days'}`)
    }
    return [{ topic, score, reasons }]
  }).sort((a, b) => b.score - a.score)
}
