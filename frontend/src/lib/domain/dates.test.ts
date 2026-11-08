import { describe, expect, it } from 'vitest'
import { addDays, diffDays, formatDate, formatDateOnly, formatTime, isSameDay, minutesBetween, monthMatrix, parseDateOnly, relativeDue, startOfWeek, today, weekDays } from './dates'

describe('local calendar dates', () => {
  it.each(['2026-11-07', '2024-02-29', '2000-02-29', '0099-01-01'])('round trips %s without UTC conversion', (value) => {
    const parsed = parseDateOnly(value)
    expect(formatDateOnly(parsed)).toBe(value)
    expect(parsed.getHours()).toBe(0)
  })
  it.each(['2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '2026-11-7', '11/07/2026', 'garbage', ''])('rejects invalid %s', (value) => {
    expect(() => parseDateOnly(value)).toThrow(RangeError)
  })
  it('uses local parts of now without mutating it', () => {
    const now = new Date(2026, 10, 7, 23, 59)
    const before = now.getTime()
    expect(today(now)).toBe('2026-11-07')
    expect(addDays(now, 1)).toBe('2026-11-08')
    expect(startOfWeek(now)).toBe('2026-11-02')
    expect(now.getTime()).toBe(before)
  })
  it.each([
    ['2026-03-08', 1, '2026-03-09'], ['2026-11-01', 1, '2026-11-02'],
    ['2024-02-28', 1, '2024-02-29'], ['2026-12-31', 1, '2027-01-01'], ['2026-01-01', -1, '2025-12-31'],
  ])('adds calendar days to %s across DST and year boundaries', (value, days, expected) => {
    expect(addDays(value, days)).toBe(expected)
    expect(diffDays(expected, value)).toBe(days)
  })
  it('counts calendar dates regardless of time of day', () => {
    expect(diffDays(new Date(2026, 2, 9, 0, 1), new Date(2026, 2, 8, 23, 59))).toBe(1)
    expect(isSameDay('2026-11-07', new Date(2026, 10, 7, 23, 59))).toBe(true)
    expect(isSameDay('2026-11-07', '2026-11-08')).toBe(false)
  })
  it('rejects invalid Date objects and fractional offsets', () => {
    expect(() => today(new Date('invalid'))).toThrow(RangeError)
    expect(() => addDays('2026-11-07', 1.5)).toThrow(RangeError)
  })
})

describe('Monday calendar grids', () => {
  it.each([['2026-11-02', '2026-11-02'], ['2026-11-07', '2026-11-02'], ['2026-11-08', '2026-11-02'], ['2026-01-01', '2025-12-29']])('starts %s on %s', (date, start) => {
    expect(startOfWeek(date)).toBe(start)
    expect(weekDays(date)).toEqual(Array.from({ length: 7 }, (_, day) => addDays(start, day)))
  })
  it.each(['2026-02-10', '2024-02-29', '2026-03-10', '2026-11-07', '2026-12-31'])('returns a complete six-week grid for %s', (date) => {
    const grid = monthMatrix(date)
    expect(grid).toHaveLength(6)
    expect(grid.every((week) => week.length === 7)).toBe(true)
    const dates = grid.flat()
    expect(new Set(dates).size).toBe(42)
    expect(parseDateOnly(dates[0]).getDay()).toBe(1)
    expect(dates).toContain(date.slice(0, 8) + '01')
    dates.forEach((value, index) => expect(value).toBe(addDays(dates[0], index)))
  })
})

describe('due labels and formatters', () => {
  it.each([
    ['2026-11-05', '2 days late', 'late'], ['2026-11-06', '1 day late', 'late'],
    ['2026-11-07', 'Today', 'soon'], ['2026-11-08', 'Due tomorrow', 'soon'],
    ['2026-11-10', 'In 3 days', 'soon'], ['2026-11-14', 'In 7 days', 'soon'], ['2026-11-15', 'In 8 days', 'later'],
  ])('labels %s', (date, label, tone) => {
    expect(relativeDue(date, new Date(2026, 10, 7, 23, 59))).toEqual({ label, tone })
  })
  it('overrides a late date for completed items', () => {
    expect(relativeDue('2020-01-01', '2026-11-07', true)).toEqual({ label: 'Done', tone: 'done' })
  })
  it.each([['14:00', '2 PM'], ['14:30', '2:30 PM'], ['00:00', '12 AM'], ['12:00', '12 PM'], ['09:05', '9:05 AM'], ['23:59', '11:59 PM']])('formats %s', (time, expected) => {
    expect(formatTime(time)).toBe(expected)
  })
  it.each(['24:00', '12:60', '-1:00', '14', 'a:00'])('rejects time %s', (value) => {
    expect(() => formatTime(value)).toThrow(RangeError)
  })
  it('formats dates and computes signed time differences', () => {
    expect(formatDate('2026-11-07')).toBe('Nov 7')
    expect(formatDate('2026-11-07', { weekday: 'long', month: undefined, day: undefined })).toBe('Saturday')
    expect(minutesBetween('09:30', '11:00')).toBe(90)
    expect(minutesBetween('23:00', '01:00')).toBe(-1320)
    expect(() => minutesBetween('wrong', '01:00')).toThrow(RangeError)
  })
})
