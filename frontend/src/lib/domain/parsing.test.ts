import { describe, expect, it } from 'vitest'
import { classifyKind, extractDate, removeMatch } from './parsing'
import { now } from './fixtures.test-utils'

describe('assessment cues', () => {
  it.each([
    ['Variable assignment', 'topic'], ['Unit test design', 'topic'], ['Final value theorem', 'topic'],
    ['Lecture 4: Variable assignment', 'topic'], ['Week 3: Unit test design', 'topic'],
    ['Lecture 8: Discuss Assignment 1', 'topic'], ['Week 8: Review Quiz 3', 'topic'],
    ['Lecture 8: Assignment 1', 'assignment'], ['Week 8: Quiz 3', 'quiz'],
    ['CSC369 Assignment 1', 'assignment'], ['Nov 12: Midterm 2', 'exam'],
    ['Week 3 (Sep 22): Scheduling', 'topic'], ['Week 3 (Sep 22): Assignment 1', 'assignment'],
    ['Read Assignment 1', 'assignment'], ['Complete Quiz 3rd', 'quiz'],
    ['Submit the project by Oct 3', 'project'], ['The assignment is due Oct 3', 'assignment'],
    ['The midterm', 'exam'], ['Test', 'exam'], ['Midterm', 'exam'], ['Final exam', 'exam'],
    ['Final project', 'project'], ['Final', 'exam'], ['Final value theorem due for discussion', 'topic'],
  ])('classifies %s as %s', (text, expected) => {
    expect(classifyKind(text)).toBe(expected)
  })
})

describe('explicit dates beat weekdays', () => {
  it.each([
    ['quiz Friday Nov 20 10am', '2026-11-20', 'Friday Nov 20', 'quiz 10am'],
    ['quiz Fri, Nov 20, 2026 10am', '2026-11-20', 'Fri, Nov 20, 2026', 'quiz 10am'],
    ['quiz next Friday Nov 20 10am', '2026-11-20', 'next Friday Nov 20', 'quiz 10am'],
    ['quiz Monday 2026-11-20 10am', '2026-11-20', 'Monday 2026-11-20', 'quiz 10am'],
    ['quiz Friday 20 Nov 10am', '2026-11-20', 'Friday 20 Nov', 'quiz 10am'],
    ['quiz Friday 11/20/26 10am', '2026-11-20', 'Friday 11/20/26', 'quiz 10am'],
    ['Read tomorrow for quiz Nov 20', '2026-11-20', 'Nov 20', 'Read tomorrow for quiz'],
  ])('extracts an explicit date from %s', (text, date, matched, title) => {
    const result = extractDate(text, 2026, now)!
    expect(result).toMatchObject({ date, matched })
    expect(removeMatch(text, result).replace(/\s+/g, ' ').trim()).toBe(title)
  })
})
