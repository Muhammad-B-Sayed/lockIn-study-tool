import { describe, expect, it } from 'vitest'
import type { Confidence } from '../data/types'
import { coverage } from './coverage'
import { topic } from './fixtures.test-utils'

describe('coverage', () => {
  it.each([
    [[], 0, 0, 0], [['retired'], 0, 0, 0], [['unrated'], 1, 0, 0],
    [['shaky'], 1, 1, 100], [['okay', 'solid', 'retired'], 2, 2, 100],
    [['unrated', 'unrated', 'solid', 'retired'], 3, 1, 33],
  ] as [Confidence[], number, number, number][])('counts %j without retired in the denominator', (ratings, eligible, covered, percent) => {
    const result = coverage(ratings.map((confidence) => topic({ confidence })))
    expect(result).toMatchObject({ total: ratings.length, eligible, covered, percent })
    for (const confidence of ['unrated', 'shaky', 'okay', 'solid', 'retired'] as const) {
      expect(result.counts[confidence]).toBe(ratings.filter((rating) => rating === confidence).length)
    }
  })
  it('filters a course and leaves its input unchanged', () => {
    const topics = [topic({ confidence: 'solid' }), topic({ courseId: 'other', confidence: 'unrated' })]
    const before = structuredClone(topics)
    expect(coverage(topics, 'csc369')).toMatchObject({ total: 1, percent: 100 })
    expect(coverage(topics, 'missing')).toMatchObject({ total: 0, percent: 0 })
    expect(topics).toEqual(before)
  })
})
