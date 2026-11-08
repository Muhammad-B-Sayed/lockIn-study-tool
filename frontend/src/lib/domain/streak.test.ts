import { describe, expect, it } from 'vitest'
import { currentStreak, studyMinutesByDay } from './streak'
import { now, session } from './fixtures.test-utils'

describe('daily study totals', () => {
  it('includes zeros, sums sessions, and ignores future, invalid and nonpositive values', () => {
    const sessions = [session('2026-11-07', 20), session('2026-11-07', 5), session('2026-11-05', 45),
      session('2026-11-04', 99), session('2026-11-08', 10), session('2026-11-06', 0), session('2026-11-06', -5),
      { ...session('2026-11-06'), startedAt: 'invalid' }, session('2026-11-06', NaN),
      { ...session('2026-11-07'), startedAt: new Date(2026, 10, 7, 23).toISOString() }]
    expect(studyMinutesByDay(sessions, now, 3)).toEqual([
      { date: '2026-11-05', minutes: 45 }, { date: '2026-11-06', minutes: 0 }, { date: '2026-11-07', minutes: 25 },
    ])
  })
  it('uses the local start date of a session that crosses midnight', () => {
    expect(studyMinutesByDay([{ ...session('2026-11-06'), startedAt: new Date(2026, 10, 6, 23, 55).toISOString() }], now, 2))
      .toEqual([{ date: '2026-11-06', minutes: 25 }, { date: '2026-11-07', minutes: 0 }])
  })
  it('handles zero days, default days, and invalid windows', () => {
    expect(studyMinutesByDay([], now, 0)).toEqual([])
    expect(studyMinutesByDay([], now)).toHaveLength(21)
    for (const days of [-1, 1.5, NaN]) expect(() => studyMinutesByDay([], now, days)).toThrow(RangeError)
  })
})

describe('current streak', () => {
  it.each([
    [[], 0], [['2026-11-07'], 1], [['2026-11-06'], 1], [['2026-11-05'], 0],
    [['2026-11-05', '2026-11-06', '2026-11-07'], 3],
    [['2026-11-05', '2026-11-06'], 2], [['2026-11-05', '2026-11-07'], 1],
    [['2026-11-07', '2026-11-07', '2026-11-06'], 2], [['2026-11-08'], 0],
  ] as [string[], number][])('counts days %j', (dates, expected) => {
    expect(currentStreak(dates.map((date) => session(date)), now)).toBe(expected)
  })
  it('crosses DST and year boundaries by calendar day', () => {
    expect(currentStreak(['2026-10-31', '2026-11-01', '2026-11-02'].map((date) => session(date)), new Date(2026, 10, 2, 12))).toBe(3)
    expect(currentStreak(['2026-12-31', '2027-01-01'].map((date) => session(date)), new Date(2027, 0, 1, 12))).toBe(2)
  })
})
