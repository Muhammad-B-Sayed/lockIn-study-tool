import type { Confidence, Topic } from '../data/types'

export type Coverage = {
  counts: Record<Confidence, number>
  total: number
  eligible: number
  covered: number
  percent: number
}

/** Coverage means rated at least once, not mastery. Retired topics do not count. */
export function coverage(topics: readonly Topic[], courseId?: string): Coverage {
  const counts: Record<Confidence, number> = { unrated: 0, shaky: 0, okay: 0, solid: 0, retired: 0 }
  for (const topic of topics) {
    if (!courseId || topic.courseId === courseId) counts[topic.confidence] += 1
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const eligible = total - counts.retired
  const covered = eligible - counts.unrated
  return { counts, total, eligible, covered, percent: eligible ? Math.round(covered / eligible * 100) : 0 }
}
