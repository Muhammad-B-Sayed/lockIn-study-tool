import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from './quickAdd'
import { course, now } from './fixtures.test-utils'

const courses = [course(), course({ id: 'ast101', code: 'AST101', name: 'The Sun and Its Neighbours' })]

describe('quick add', () => {
  it.each([
    ['csc369 midterm nov 12', 'exam', 'midterm', 'csc369', '2026-11-12', null],
    ['AST101 quiz fri 10am', 'quiz', 'quiz', 'ast101', '2026-11-13', '10:00'],
    ['read ch 4 tomorrow', 'topic', 'read ch 4', null, '2026-11-08', null],
    ['CSC369 Assignment 2 due Nov 12 at 11:59 pm', 'assignment', 'Assignment 2', 'csc369', '2026-11-12', '23:59'],
    ['Operating Systems: Review paging today 14:30', 'topic', 'Review paging', 'csc369', '2026-11-07', '14:30'],
    ['AST101 quiz on Friday at 10 AM', 'quiz', 'quiz', 'ast101', '2026-11-13', '10:00'],
    ['Read chapter 4', 'topic', 'Read chapter 4', null, null, null],
    ['Final project', 'project', 'Final project', null, null, null],
    ['Meet group tonight 7pm', 'topic', 'Meet group', null, '2026-11-07', '19:00'],
    ['Task: submit form tmrw', 'task', 'Task: submit form', null, '2026-11-08', null],
    ['quiz 12 Nov 2027 9:05 a.m.', 'quiz', 'quiz', null, '2027-11-12', '09:05'],
    ['quiz 11/12/26 12am', 'quiz', 'quiz', null, '2026-11-12', '00:00'],
    ['quiz 2026-11-12 12pm', 'quiz', 'quiz', null, '2026-11-12', '12:00'],
    ['  cSc369   review semaphores   ', 'topic', 'review semaphores', 'csc369', null, null],
    ['unknown123 review notes tomorrow', 'topic', 'unknown123 review notes', null, '2026-11-08', null],
    ['Review CSC369 tomorrow', 'topic', 'Review', 'csc369', '2026-11-08', null],
    ['Review notes next week', 'topic', 'Review notes', null, '2026-11-14', null],
    ['', 'topic', '', null, null, null],
    ['CSC369', 'topic', '', 'csc369', null, null],
  ])('parses %s', (text, kind, title, courseId, date, time) => {
    expect(parseQuickAdd(text, courses, now)).toEqual({ kind, title, courseId, date, time })
  })
  it.each([
    ['mon', '2026-11-09'], ['monday', '2026-11-09'], ['tues', '2026-11-10'], ['wed', '2026-11-11'],
    ['thurs', '2026-11-12'], ['sat', '2026-11-07'], ['sun', '2026-11-08'],
    ['next fri', '2026-11-13'], ['next sat', '2026-11-14'], ['this fri', '2026-11-06'],
  ])('resolves weekday %s', (day, date) => {
    expect(parseQuickAdd(`Read notes ${day}`, [], now).date).toBe(date)
  })
  it('does not infer invalid dates or invalid times', () => {
    expect(parseQuickAdd('Read Feb 30 at 25:00', [], now)).toEqual({ kind: 'topic', title: 'Read Feb 30 at 25:00', courseId: null, date: null, time: null })
    for (const time of ['13pm', '0am', '12:61am', '25:00']) expect(parseQuickAdd(`Read ${time}`, [], now).time).toBeNull()
  })
  it('matches complete course codes and escapes punctuation in course names', () => {
    const overlapping = [course({ id: 'short', code: 'CSC36', name: '' }), course({ id: 'long', code: 'CSC369', name: 'C++ (systems)' })]
    expect(parseQuickAdd('CSC369 notes', overlapping, now).courseId).toBe('long')
    expect(parseQuickAdd('CSC3690 notes', overlapping, now).courseId).toBeNull()
    expect(parseQuickAdd('C++ (systems) notes', overlapping, now).title).toBe('notes')
  })
  it('uses explicit years and crosses month boundaries for relative dates', () => {
    expect(parseQuickAdd('quiz Jan 3 2027', [], now).date).toBe('2027-01-03')
    expect(parseQuickAdd('read tomorrow', [], new Date(2026, 11, 31, 23)).date).toBe('2027-01-01')
  })
})

describe('quick-add parser regressions', () => {
  it.each(['Variable assignment', 'Unit test design', 'Final value theorem', 'Lecture 4: Unit test design'])('keeps %s as a topic', (text) => {
    expect(parseQuickAdd(`CSC369 ${text} tomorrow`, courses, now)).toMatchObject({ kind: 'topic', date: '2026-11-08', courseId: 'csc369' })
  })

  it.each(['Friday Nov 20', 'Fri, Nov 20, 2026', 'next Friday Nov 20', 'Friday 20 Nov'])('uses and consumes explicit date phrase %s', (date) => {
    expect(parseQuickAdd(`AST101 quiz ${date} 10am`, courses, now)).toEqual({ kind: 'quiz', title: 'quiz', courseId: 'ast101', date: '2026-11-20', time: '10:00' })
  })

  it.each([
    ['CSC369 Operating Systems notes', 'explicit'], ['Operating Systems notes CSC369', 'explicit'],
    ['csc369 Operating Systems quiz', 'explicit'], ['Operating Systems notes', 'named'],
  ])('matches codes before names in %s', (text, expected) => {
    const colliding = [
      course({ id: 'named', code: 'CSC324', name: 'Operating Systems' }),
      course({ id: 'explicit', code: 'CSC369', name: 'Systems' }),
    ]
    expect(parseQuickAdd(text, colliding, now).courseId).toBe(expected)
    expect(parseQuickAdd(text, [...colliding].reverse(), now).courseId).toBe(expected)
  })
})
