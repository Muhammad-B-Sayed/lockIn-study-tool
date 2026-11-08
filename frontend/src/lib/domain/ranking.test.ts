import { describe, expect, it } from 'vitest'
import type { Assessment, Confidence } from '../data/types'
import { nextDueDate, rankReview, REVIEW_CONFIDENCE_WEIGHTS, REVIEW_PULL_FORWARD_WINDOW_DAYS, REVIEW_TARGET_INTERVALS, REVIEW_WEIGHTS } from './ranking'
import { addDays } from './dates'
import { assessment, course, now, topic, workspace } from './fixtures.test-utils'

const reviewedDaysAgo = (days: number) => new Date(`${addDays(now, -days)}T23:59:00`).toISOString()

describe('review due gates', () => {
  it.each([
    ['shaky', null, true], ['shaky', -1, false], ['shaky', 0, false], ['shaky', 1, true], ['shaky', 2, true],
    ['okay', null, false], ['okay', -1, false], ['okay', 0, false], ['okay', 1, false], ['okay', 2, false], ['okay', 3, true], ['okay', 4, true],
    ['solid', null, false], ['solid', -1, false], ['solid', 0, false], ['solid', 3, false], ['solid', 6, false], ['solid', 7, true], ['solid', 8, true],
    ['retired', null, false], ['retired', 100, false],
  ] as [Confidence, number | null, boolean][])('%s after %s calendar days is due = %s', (confidence, age, due) => {
    const t = topic({ confidence, lastReviewedAt: age === null ? null : reviewedDaysAgo(age) })
    expect(rankReview(workspace({ topics: [t] }), now)).toHaveLength(due ? 1 : 0)
  })

  it.each([
    [null, false], ['2026-11-06', true], ['2026-11-07', true], ['2026-11-08', false],
  ] as [string | null, boolean][])('unrated requires a started plan %s, even with an exam today', (plannedDate, due) => {
    const t = topic({ plannedDate, lastReviewedAt: reviewedDaysAgo(1) })
    const data = workspace({ topics: [t], assessments: [assessment({ dueDate: '2026-11-07' })] })
    expect(rankReview(data, now)).toHaveLength(due ? 1 : 0)
  })

  it.each([
    ['shaky', 0, 0, false], ['shaky', 1, 7, true],
    ['okay', 0, 0, false], ['okay', 1, 0, true], ['okay', 1, 7, true], ['okay', 1, 8, false],
    ['okay', 2, 7, true], ['okay', 2, 8, false], ['okay', 3, 8, true], ['okay', 1, -1, false],
    ['solid', 0, 0, false], ['solid', 1, 7, false], ['solid', 2, 7, false], ['solid', 3, 0, true],
    ['solid', 3, 7, true], ['solid', 3, 8, false], ['solid', 6, 7, true], ['solid', 6, 8, false],
    ['solid', 7, 8, true], ['solid', 3, -1, false],
  ] as [Confidence, number, number, boolean][])('%s age %i, exam in %i days, due = %s', (confidence, age, until, due) => {
    const t = topic({ confidence, lastReviewedAt: reviewedDaysAgo(age) })
    const data = workspace({ topics: [t], assessments: [assessment({ dueDate: addDays(now, until) })] })
    expect(rankReview(data, now)).toHaveLength(due ? 1 : 0)
  })

  it.each([
    [{ kind: 'exam' }, true], [{ kind: 'quiz' }, true], [{ kind: 'assignment' }, false],
    [{ kind: 'project' }, false], [{ kind: 'task' }, false], [{ done: true }, false],
    [{ courseId: 'another' }, false], [{ courseId: 'another', topicIds: ['paging'] }, true],
    [{ courseId: null, topicIds: ['paging'], kind: 'quiz' }, true], [{ courseId: null, topicIds: ['another'] }, false],
  ] as [Partial<Assessment>, boolean][])('pulls forward only a relevant undone exam or quiz %j', (patch, due) => {
    const t = topic({ confidence: 'okay', lastReviewedAt: reviewedDaysAgo(1) })
    expect(rankReview(workspace({ topics: [t], assessments: [assessment({ dueDate: '2026-11-14', ...patch })] }), now)).toHaveLength(due ? 1 : 0)
  })

  it('keeps stable ties among due topics when fresh topics are filtered out', () => {
    const topics = ['b', 'fresh', 'a'].map((id) => topic({ id, confidence: 'shaky', lastReviewedAt: reviewedDaysAgo(id === 'fresh' ? 0 : 1) }))
    expect(rankReview(workspace({ topics }), now).map(({ topic: t }) => t.id)).toEqual(['b', 'a'])
  })

  it('exports the seven-day gate window independently of the 21-day scoring window', () => {
    expect(REVIEW_PULL_FORWARD_WINDOW_DAYS).toBe(7)
    expect(REVIEW_WEIGHTS.assessmentWindowDays).toBe(21)
  })
})

describe('next due date', () => {
  it.each([
    ['shaky', null, '2026-11-07'], ['shaky', 0, '2026-11-08'], ['shaky', 1, '2026-11-07'],
    ['okay', 0, '2026-11-10'], ['okay', 1, '2026-11-09'], ['okay', 2, '2026-11-08'], ['okay', 3, '2026-11-07'], ['okay', 20, '2026-11-07'],
    ['solid', 0, '2026-11-14'], ['solid', 3, '2026-11-11'], ['solid', 6, '2026-11-08'], ['solid', 7, '2026-11-07'], ['solid', 20, '2026-11-07'],
    ['okay', null, null], ['solid', null, null], ['retired', 20, null],
  ] as [Confidence, number | null, string | null][])('schedules %s age %s for %s without an exam', (confidence, age, expected) => {
    const t = topic({ confidence, lastReviewedAt: age === null ? null : reviewedDaysAgo(age) })
    expect(nextDueDate(t, workspace({ topics: [t] }), now)).toBe(expected)
  })

  it.each([
    [null, null], ['2026-11-06', '2026-11-07'], ['2026-11-07', '2026-11-07'], ['2026-11-08', '2026-11-08'],
  ])('schedules an unrated plan %s for %s', (plannedDate, expected) => {
    const t = topic({ plannedDate })
    expect(nextDueDate(t, workspace({ topics: [t], assessments: [assessment({ dueDate: '2026-11-07' })] }), now)).toBe(expected)
  })

  it.each([
    ['okay', 0, -1, '2026-11-10'], ['okay', 0, 0, '2026-11-10'], ['okay', 0, 1, '2026-11-08'],
    ['okay', 0, 7, '2026-11-08'], ['okay', 0, 8, '2026-11-08'], ['okay', 0, 9, '2026-11-09'], ['okay', 0, 10, '2026-11-10'],
    ['solid', 0, -1, '2026-11-14'], ['solid', 0, 0, '2026-11-14'], ['solid', 0, 2, '2026-11-14'],
    ['solid', 0, 3, '2026-11-10'], ['solid', 0, 7, '2026-11-10'], ['solid', 0, 10, '2026-11-10'],
    ['solid', 0, 11, '2026-11-11'], ['solid', 0, 14, '2026-11-14'],
    ['solid', 2, 7, '2026-11-08'], ['solid', 3, 7, '2026-11-07'], ['solid', 3, 8, '2026-11-08'],
  ] as [Confidence, number, number, string][])('schedules %s age %i before an exam in %i days for %s', (confidence, age, until, expected) => {
    const t = topic({ confidence, lastReviewedAt: reviewedDaysAgo(age) })
    const data = workspace({ topics: [t], assessments: [assessment({ dueDate: addDays(now, until) })] })
    const before = structuredClone(data)
    expect(nextDueDate(t, data, now)).toBe(expected)
    // The predicted date must be the first day this unchanged topic enters the queue.
    for (let day = '2026-11-07'; day < expected; day = addDays(day, 1)) expect(rankReview(data, day)).toEqual([])
    expect(rankReview(data, expected)).toHaveLength(1)
    expect(data).toEqual(before)
  })

  it.each([
    [{ done: true }, '2026-11-10'], [{ kind: 'assignment' }, '2026-11-10'],
    [{ courseId: 'another' }, '2026-11-10'], [{ courseId: 'another', topicIds: ['paging'] }, '2026-11-08'],
  ] as [Partial<Assessment>, string][])('ignores irrelevant assessments when forecasting %j', (patch, expected) => {
    const t = topic({ confidence: 'okay', lastReviewedAt: reviewedDaysAgo(0) })
    expect(nextDueDate(t, workspace({ assessments: [assessment({ dueDate: '2026-11-14', ...patch })] }), now)).toBe(expected)
  })

  it('considers a later exam when the earliest exam ends before the minimum review age', () => {
    const t = topic({ confidence: 'solid', lastReviewedAt: reviewedDaysAgo(0) })
    const data = workspace({ topics: [t], assessments: [assessment({ dueDate: '2026-11-08' }), assessment({ id: 'quiz', kind: 'quiz', dueDate: '2026-11-15' })] })
    expect(nextDueDate(t, data, now)).toBe('2026-11-10')
  })

  it('excludes archived courses even when an exam links the topic', () => {
    const t = topic({ confidence: 'shaky' })
    const data = workspace({ courses: [course({ status: 'archived' })], topics: [t], assessments: [assessment({ dueDate: '2026-11-07', topicIds: [t.id] })] })
    expect(nextDueDate(t, data, now)).toBeNull()
    expect(rankReview(data, now)).toEqual([])
  })

  it.each([['shaky', '2026-11-07'], ['okay', null], ['solid', null]] as [Confidence, string | null][])('handles invalid %s timestamps explicitly', (confidence, expected) => {
    const t = topic({ confidence, lastReviewedAt: 'invalid' })
    expect(nextDueDate(t, workspace(), now)).toBe(expected)
  })

  it.each([
    ['2026-03-07', '2026-03-08', '2026-03-10'],
    ['2026-10-31', '2026-11-01', '2026-11-03'],
    ['2026-12-31', '2027-01-01', '2027-01-03'],
  ])('counts calendar days across the boundary after %s', (reviewDay, clock, expected) => {
    const t = topic({ confidence: 'okay', lastReviewedAt: new Date(`${reviewDay}T23:59:00`).toISOString() })
    expect(nextDueDate(t, workspace(), clock)).toBe(expected)
  })
})

describe('review ranking', () => {
  it('keeps confidence order among due topics even when shaky was reviewed most recently', () => {
    const topics = (['solid', 'okay', 'unrated', 'shaky'] as Confidence[]).map((confidence) => topic({
      id: confidence, confidence, lastReviewedAt: confidence === 'shaky' ? new Date(2026, 10, 6).toISOString() : new Date(2025, 0, 1).toISOString(),
      plannedDate: '2026-11-06',
    }))
    expect(rankReview(workspace({ topics, assessments: [assessment({ dueDate: '2026-11-07' })] }), now).map(({ topic: t }) => t.id))
      .toEqual(['shaky', 'unrated', 'okay', 'solid'])
  })
  it.each([
    ['shaky', null, true], ['unrated', null, false], ['unrated', '2026-11-06', true],
    ['unrated', '2026-11-07', true], ['unrated', '2026-11-08', false],
    ['solid', '2026-11-08', true], ['retired', null, false],
  ] as [Confidence, string | null, boolean][])('includes %s with plan %s = %s', (confidence, plannedDate, included) => {
    expect(rankReview(workspace({ topics: [topic({ confidence, plannedDate, lastReviewedAt: new Date(2026, 9, 25).toISOString() })] }), now)).toHaveLength(included ? 1 : 0)
  })
  it('filters a course and excludes archived courses', () => {
    const data = workspace({ courses: [course(), course({ id: 'archived', status: 'archived' })], topics: [topic({ confidence: 'shaky' }), topic({ id: 'other', courseId: 'other', confidence: 'shaky' }), topic({ id: 'old', courseId: 'archived', confidence: 'shaky' })] })
    expect(rankReview(data, now, { courseId: 'csc369' }).map(({ topic: t }) => t.id)).toEqual(['paging'])
    expect(rankReview(data, now).map(({ topic: t }) => t.id)).toEqual(['paging', 'other'])
  })
  it('exports the documented formula and scores elapsed target intervals', () => {
    expect(REVIEW_TARGET_INTERVALS).toEqual({ shaky: 1, unrated: 0, okay: 3, solid: 7, retired: 0 })
    const data = workspace({ topics: [topic({ confidence: 'okay', lastReviewedAt: new Date(2026, 10, 1, 23).toISOString() })], assessments: [assessment()] })
    const [result] = rankReview(data, now)
    expect(result.score).toBe(REVIEW_CONFIDENCE_WEIGHTS.okay + 2 * REVIEW_WEIGHTS.elapsed + 12 * REVIEW_WEIGHTS.assessment)
    expect(result.reasons).toEqual(['Getting there', 'Last reviewed 6 days ago', 'Exam in 10 days'])
  })
  it.each([
    [null, 'Never reviewed'], ['invalid', 'Never reviewed'], [new Date(2026, 10, 6).toISOString(), 'Last reviewed 1 day ago'],
  ])('explains review timestamp %s', (lastReviewedAt, reason) => {
    const [result] = rankReview(workspace({ topics: [topic({ confidence: 'shaky', lastReviewedAt })] }), now)
    expect(result.reasons).toContain(reason)
    expect(Number.isFinite(result.score)).toBe(true)
  })
  it.each([
    [{ dueDate: '2026-11-07' }, 'Exam today'], [{ dueDate: '2026-11-08' }, 'Exam in 1 day'],
    [{ dueDate: '2026-11-28' }, 'Exam in 21 days'], [{ dueDate: '2026-11-29' }, null],
    [{ dueDate: '2026-11-06' }, null], [{ done: true }, null], [{ kind: 'assignment' }, null],
    [{ courseId: 'other' }, null], [{ courseId: null, topicIds: ['paging'], kind: 'quiz' }, 'Quiz in 10 days'],
  ] as [Partial<Assessment>, string | null][])('applies only relevant upcoming assessments %j', (patch, reason) => {
    const [result] = rankReview(workspace({ topics: [topic({ plannedDate: '2026-11-07' })], assessments: [assessment(patch)] }), now)
    expect(result.reasons.length).toBe(reason ? 3 : 2)
    if (reason) expect(result.reasons[2]).toBe(reason)
  })
  it('uses the nearest relevant assessment and never adds both bonuses', () => {
    const [result] = rankReview(workspace({ topics: [topic({ plannedDate: '2026-11-07' })], assessments: [assessment(), assessment({ id: 'quiz', kind: 'quiz', dueDate: '2026-11-09' })] }), now)
    expect(result.reasons.at(-1)).toBe('Quiz in 2 days')
    expect(result.score).toBe(340)
  })
  it('uses overdue planning dates to order never-reviewed topics', () => {
    const topics = [topic({ id: 'recent', plannedDate: '2026-11-06' }), topic({ id: 'older', plannedDate: '2026-11-04' })]
    expect(rankReview(workspace({ topics }), now).map(({ topic: t, score }) => [t.id, score])).toEqual([['older', 330], ['recent', 310]])
  })
  it('keeps shaky above unrated even when only the unrated topic has an exam today', () => {
    const topics = [topic({ id: 'unrated', courseId: 'other', plannedDate: '2020-01-01' }), topic({ id: 'shaky', confidence: 'shaky', lastReviewedAt: new Date(2026, 10, 6).toISOString() })]
    const results = rankReview(workspace({ topics, assessments: [assessment({ courseId: 'other', dueDate: '2026-11-07' })] }), now)
    expect(results.map(({ topic: t, score }) => [t.id, score])).toEqual([['shaky', 410], ['unrated', 384]])
  })
  it('caps elapsed contribution and keeps input order for exact ties without mutation', () => {
    const data = workspace({ topics: ['b', 'a', 'c'].map((id) => topic({ id, confidence: 'shaky', lastReviewedAt: new Date(2020, 0, 1).toISOString() })) })
    const before = structuredClone(data)
    expect(rankReview(data, now).map(({ topic: t, score }) => [t.id, score])).toEqual([['b', 440], ['a', 440], ['c', 440]])
    expect(data).toEqual(before)
  })
})
