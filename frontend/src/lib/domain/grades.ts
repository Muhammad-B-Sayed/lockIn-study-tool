import type { Assessment } from '../data/types'

export type GradeSummary = {
  /** Sum of the weights entered on this course's deadlines. */
  listedWeight: number
  /** Weight that has a score. */
  gradedWeight: number
  /** Percent of the final grade already earned. */
  earned: number
  /** Average across graded work, weighted. null until something has a score. */
  current: number | null
  /** Percent of the final grade still to be decided, out of `basis`. */
  remainingWeight: number
  /** 100, or the listed total when the weights add up to more than 100. */
  basis: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Scores are percentages (0 to 100, extra credit allowed) keyed by assessment id. */
export function gradeSummary(assessments: readonly Pick<Assessment, 'id' | 'weight'>[], scores: Readonly<Record<string, number>>): GradeSummary {
  let listedWeight = 0
  let gradedWeight = 0
  let earned = 0
  for (const a of assessments) {
    if (a.weight == null || !Number.isFinite(a.weight) || a.weight <= 0) continue
    listedWeight += a.weight
    const score = scores[a.id]
    if (typeof score === 'number' && Number.isFinite(score) && score >= 0) {
      gradedWeight += a.weight
      earned += (a.weight * score) / 100
    }
  }
  const basis = Math.max(100, listedWeight)
  return {
    listedWeight: round1(listedWeight),
    gradedWeight: round1(gradedWeight),
    earned: round1(earned),
    current: gradedWeight > 0 ? round1((earned / gradedWeight) * 100) : null,
    remainingWeight: round1(basis - gradedWeight),
    basis: round1(basis),
  }
}

/**
 * The average needed on everything not yet graded to finish at `target` percent.
 * null when nothing is left to grade. Can be below 0 (already there) or above 100 (out of reach).
 */
export function neededAverage(summary: GradeSummary, target: number): number | null {
  if (summary.remainingWeight <= 0) return null
  return round1((((target / 100) * summary.basis - summary.earned) / summary.remainingWeight) * 100)
}
