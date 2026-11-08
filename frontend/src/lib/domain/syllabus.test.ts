import { describe, expect, it } from 'vitest'
import { parseSyllabus } from './syllabus'

const options = { year: 2026, courseId: 'csc369' }

describe('syllabus lines', () => {
  it.each([
    ['Week 3 (Sep 22): Scheduling', 'topic', 'Scheduling', '2026-09-22'],
    ['Sep 22 - Scheduling', 'topic', 'Scheduling', '2026-09-22'],
    ['Lecture 4: Paging', 'topic', 'Paging', null],
    ['Assignment 1 due Oct 3', 'assignment', 'Assignment 1', '2026-10-03'],
    ['Midterm — Oct 15', 'exam', 'Midterm', '2026-10-15'],
    ['Final exam Dec 12', 'exam', 'Final exam', '2026-12-12'],
    ['• September 22: CPU scheduling', 'topic', 'CPU scheduling', '2026-09-22'],
    ['1. Sept. 22 – Processes and threads', 'topic', 'Processes and threads', '2026-09-22'],
    ['(2) 22 September: Deadlocks', 'topic', 'Deadlocks', '2026-09-22'],
    ['- Nov 3rd, 2026: Quiz 4', 'quiz', 'Quiz 4', '2026-11-03'],
    ['Oct 3, 2027: Homework 1', 'assignment', 'Homework 1', '2027-10-03'],
    ['2026-10-03 | Project proposal', 'project', 'Project proposal', '2026-10-03'],
    ['10/03/26\tProblem set 1', 'assignment', 'Problem set 1', '2026-10-03'],
    ['10/3: Recursion', 'topic', 'Recursion', '2026-10-03'],
    ['Feb 29: Leap day', 'topic', 'Feb 29: Leap day', null],
    ['2026-02-30: Invalid date', 'topic', '2026-02-30: Invalid date', null],
    ['Read chapter 4', 'topic', 'Read chapter 4', null],
    ['Tutorial 2: Lambda calculus', 'topic', 'Lambda calculus', null],
    ['Quiz 1', 'quiz', 'Quiz 1', null], ['Final project', 'project', 'Final project', null],
    ['Task: Form a group', 'task', 'Task: Form a group', null],
  ])('parses %s', (raw, kind, title, date) => {
    expect(parseSyllabus(raw, options)).toEqual([{ kind, title, date, raw, courseId: 'csc369', confidence: date ? 'high' : 'low' }])
  })
  it('handles messy pasted tables and preserves source order and raw text', () => {
    const text = 'Week\tDate\tTopic\tReadings\r\n1\tSep 8\tIntroduction\tChapter 1\r\n  2\tSep 15\tProcesses and threads  \r\nWeek 3\tSep 22\tScheduling\r\nWeek 4\tSept. 29\tLecture 6\tMemory allocation\r\n\t\r\nAssignment 1\tOct 3\r\nLecture 8: Paging'
    expect(parseSyllabus(text, options).map(({ kind, title, date }) => ({ kind, title, date }))).toEqual([
      { kind: 'topic', title: 'Introduction Chapter 1', date: '2026-09-08' },
      { kind: 'topic', title: 'Processes and threads', date: '2026-09-15' },
      { kind: 'topic', title: 'Scheduling', date: '2026-09-22' },
      { kind: 'topic', title: 'Memory allocation', date: '2026-09-29' },
      { kind: 'assignment', title: 'Assignment 1', date: '2026-10-03' },
      { kind: 'topic', title: 'Paging', date: null },
    ])
    expect(parseSyllabus(text, options)[1].raw).toBe('  2\tSep 15\tProcesses and threads  ')
  })
  it('handles markdown tables without producing column headers or separator rows', () => {
    const text = '| Week | Date | Topic |\n| --- | --- | --- |\n| 1 | Sep 8 | Introduction |\n| 2 | Sep 15 | Shells |'
    expect(parseSyllabus(text, options).map(({ title, date }) => [title, date])).toEqual([
      ['Introduction', '2026-09-08'], ['Shells', '2026-09-15'],
    ])
  })
  it.each(['', '\n \t\n', 'Course syllabus\nWeekly schedule', 'Week\tDate\tTopic', '---', 'Sep 22'])('ignores empty or noncontent input %j', (text) => {
    expect(parseSyllabus(text, options)).toEqual([])
  })
  it('supports leap years and reports undated lines as uncertain', () => {
    expect(parseSyllabus('Feb 29: Leap day\nRead chapter 4\nAssignment 2', { year: 2024, courseId: 'math' }))
      .toMatchObject([{ date: '2024-02-29', confidence: 'high' }, { date: null, confidence: 'low' }, { kind: 'assignment', date: null, confidence: 'low' }])
  })
  it.each([NaN, 0, 10000, 2026.5])('rejects invalid year %s', (year) => {
    expect(() => parseSyllabus('Sep 22: Scheduling', { ...options, year })).toThrow(RangeError)
  })
})

describe('topic words and mixed assessment rows', () => {
  it.each([
    'Sep 22: Variable assignment', 'Sep 22: Unit test design', 'Sep 22: Final value theorem',
    'Week 3 (Sep 22): Variable assignment', 'Lecture 4: Unit test design',
    'Week 3 (Sep 22): Review Assignment 1',
  ])('keeps ambiguous lecture material as a low-confidence topic: %s', (text) => {
    expect(parseSyllabus(text, options)).toMatchObject([{ kind: 'topic', confidence: 'low' }])
  })

  it.each([
    ['Sep 22 | Paging | Assignment 1 due Oct 3', [['topic', 'Paging', '2026-09-22', 'high'], ['assignment', 'Assignment 1', '2026-10-03', 'low']]],
    ['Week 3\tSep 22\tPaging\tQuiz 3 on Oct 3', [['topic', 'Paging', '2026-09-22', 'high'], ['quiz', 'Quiz 3', '2026-10-03', 'low']]],
    ['| Sep 22 | Memory | Project proposal by Oct 3 |', [['topic', 'Memory', '2026-09-22', 'high'], ['project', 'Project proposal', '2026-10-03', 'low']]],
    ['Sep 22 | Assignment 1 due Oct 3', [['assignment', 'Assignment 1', '2026-10-03', 'high']]],
    ['Sep 22 - Paging; Assignment 1 due Oct 3', [['assignment', 'Paging; Assignment 1', '2026-10-03', 'low']]],
    ['Sep 22 | Variable assignment | Assignment 1 due Oct 3', [['topic', 'Variable assignment', '2026-09-22', 'low'], ['assignment', 'Assignment 1', '2026-10-03', 'low']]],
    ['Sep 22 | Paging | Assignment 1', [['topic', 'Paging', '2026-09-22', 'high'], ['assignment', 'Assignment 1', '2026-09-22', 'low']]],
    ['Week 3 (Sep 22) | Paging | Assignment 1 due Oct 3', [['topic', 'Paging', '2026-09-22', 'high'], ['assignment', 'Assignment 1', '2026-10-03', 'low']]],
    ['Sep 22 | Paging | Assignment 1 due Oct 3 | Quiz 3 on Oct 7', [['topic', 'Paging', '2026-09-22', 'high'], ['assignment', 'Assignment 1', '2026-10-03', 'low'], ['quiz', 'Quiz 3', '2026-10-07', 'low']]],
    ['Paging | Assignment 1 due Oct 3', [['topic', 'Paging', null, 'low'], ['assignment', 'Assignment 1', '2026-10-03', 'low']]],
  ] as [string, (string | null)[][]][])('separates topic dates from due dates in %s', (raw, expected) => {
    const drafts = parseSyllabus(raw, options)
    expect(drafts.map(({ kind, title, date, confidence }) => [kind, title, date, confidence])).toEqual(expected)
    expect(drafts.every((draft) => draft.raw === raw && draft.courseId === options.courseId)).toBe(true)
  })
})

describe('syllabus year rollover', () => {
  it.each([
    ['Dec 15: Threads\nJan 10: Paging\nFeb 1: Files', 2026, ['2026-12-15', '2027-01-10', '2027-02-01']],
    ['Dec 15: Threads\nRead chapter 4\nJan 10: Paging', 2026, ['2026-12-15', null, '2027-01-10']],
    ['Mar 3: Threads\nJan 2: Paging', 2026, ['2026-03-03', '2026-01-02']],
    ['Mar 4: Threads\nJan 2: Paging', 2026, ['2026-03-04', '2027-01-02']],
    ['Mar 2: Threads\nJan 2: Paging', 2024, ['2024-03-02', '2024-01-02']],
    ['Mar 3: Threads\nJan 2: Paging', 2024, ['2024-03-03', '2025-01-02']],
    ['Oct 20: Threads\nOct 1: Paging', 2026, ['2026-10-20', '2026-10-01']],
    ['Dec 15: Threads\nJan 10 2026: Paging\nFeb 1: Files', 2026, ['2026-12-15', '2026-01-10', '2026-02-01']],
    ['Dec 15 2028: Threads\nJan 10: Paging', 2026, ['2028-12-15', '2029-01-10']],
    ['Dec 15: Threads\nJan 10: Paging\nDec 20: Files\nJan 5: Networking', 2026, ['2026-12-15', '2027-01-10', '2027-12-20', '2028-01-05']],
    ['12/15: Threads\n1/10: Paging', 2026, ['2026-12-15', '2027-01-10']],
    ['Dec 15 2023: Threads\nJan 10: Paging\nFeb 29: Files', 2026, ['2023-12-15', '2024-01-10', '2024-02-29']],
    ['Dec 15: Threads\n2026-01-10: Paging', 2026, ['2026-12-15', '2026-01-10']],
    ['Dec 20 | Paging | Assignment 1 due Jan 10\nDec 27: Files', 2026, ['2026-12-20', '2027-01-10', '2026-12-27']],
  ] as [string, number, (string | null)[]][])('walks dates in %j with base year %i', (text, year, expected) => {
    expect(parseSyllabus(text, { ...options, year }).map(({ date }) => date)).toEqual(expected)
  })
})
