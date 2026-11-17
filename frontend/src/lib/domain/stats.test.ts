import { describe, expect, it } from 'vitest'
import { planImport } from '../data/backup'
import { gradeSummary, neededAverage } from './grades'
import { buildIcs } from './ics'
import { formatMinutes, weekStats } from './stats'
import { assessment, course, now, session, topic, workspace } from './fixtures.test-utils'

// `now` is Saturday 2026-11-07 14:30. That week starts Monday 2026-11-02.
describe('weekStats', () => {
  it('compares this week with the same point last week and splits by course', () => {
    const sessions = [
      { ...session('2026-11-07', 30), courseId: 'csc369' },
      { ...session('2026-11-02', 45), id: 'a', topicId: 'paging' },
      { ...session('2026-11-01', 20), id: 'b' }, // Sunday of last week: past "this point"
      { ...session('2026-10-27', 60), id: 'c', courseId: 'csc369' }, // Tuesday of last week
      { ...session('2026-10-20', 99), id: 'd' }, // two weeks back
      { ...session('2026-11-08', 99), id: 'e' }, // future
    ]
    const stats = weekStats({ sessions, reviews: [], topics: [topic()] }, now)
    expect(stats.weekStart).toBe('2026-11-02')
    expect(stats.minutes).toBe(75)
    expect(stats.todayMinutes).toBe(30)
    expect(stats.previousToDate).toBe(60)
    expect(stats.previousTotal).toBe(80)
    expect(stats.sessions).toBe(2)
    expect(stats.byCourse).toEqual([
      { courseId: 'csc369', minutes: 75, previous: 60 },
      { courseId: null, minutes: 0, previous: 20 },
    ])
    expect(stats.bestDay).toEqual({ date: '2026-11-02', minutes: 45 })
  })
  it('formats minutes', () => {
    expect([formatMinutes(0), formatMinutes(45), formatMinutes(60), formatMinutes(125)]).toEqual(['0m', '45m', '1h', '2h 5m'])
  })
})

describe('grades', () => {
  const work = [
    { id: 'a1', weight: 20 },
    { id: 'mid', weight: 30 },
    { id: 'final', weight: 40 },
    { id: 'none', weight: null },
  ]
  it('averages graded work by weight and works out what is needed', () => {
    const summary = gradeSummary(work, { a1: 90, mid: 70 })
    expect(summary).toEqual({ listedWeight: 90, gradedWeight: 50, earned: 39, current: 78, remainingWeight: 50, basis: 100 })
    expect(neededAverage(summary, 80)).toBe(82)
  })
  it('has no average before any score and nothing needed once all is graded', () => {
    expect(gradeSummary(work, {}).current).toBeNull()
    const all = gradeSummary([{ id: 'x', weight: 100 }], { x: 85 })
    expect(all.current).toBe(85)
    expect(neededAverage(all, 90)).toBeNull()
  })
})

describe('buildIcs', () => {
  it('writes open deadlines, planned topics and events, and escapes text', () => {
    const ics = buildIcs({
      courses: [course()],
      topics: [topic({ plannedDate: '2026-11-10' }), topic({ id: 'old', plannedDate: '2026-01-01' })],
      assessments: [assessment({ title: 'Midterm; part 1, written', dueTime: '09:00' }), assessment({ id: 'done', done: true })],
      events: [{ id: 'ev', title: 'Shift', date: '2026-11-09', startTime: '14:00', endTime: '15:30', color: 'sky', done: false }],
    }, now)
    expect([ics.deadlines, ics.studyBlocks, ics.events]).toEqual([1, 1, 1])
    expect(ics.text).toContain('SUMMARY:CSC369 Midterm\\; part 1\\, written due')
    expect(ics.text).toContain('DTSTART:20261117T083000\r\nDTEND:20261117T090000')
    expect(ics.text).toContain('DTSTART;VALUE=DATE:20261110\r\nDTEND;VALUE=DATE:20261111')
    expect(ics.text).toContain('DTSTART:20261109T140000\r\nDTEND:20261109T153000')
    expect(ics.text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.text.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
})

describe('planImport', () => {
  const file = workspace({
    topics: [topic()],
    assessments: [assessment({ topicIds: ['paging'] })],
    sessions: [{ ...session('2026-11-05', 40), topicId: 'paging', courseId: 'csc369' }],
  })
  it('rejects files that are not exports or hold invalid records, before planning anything', () => {
    expect(planImport('nope', workspace())).toMatchObject({ ok: false })
    expect(planImport('{"courses":[]}', workspace())).toMatchObject({ ok: false })
    const bad = planImport(JSON.stringify({ ...file, assessments: [assessment({ dueDate: '2026-13-40' })] }), workspace({ courses: [] }))
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toContain('Deadline 1')
  })
  it('adds everything to an empty workspace', () => {
    const result = planImport(JSON.stringify(file), workspace({ courses: [] }))
    if (!result.ok) throw new Error(result.error)
    expect([result.plan.courses.length, result.plan.topics.length, result.plan.assessments.length, result.plan.sessions.length]).toEqual([1, 1, 1, 1])
    expect(result.plan.sessions[0]).toMatchObject({ topicId: 'paging', courseId: 'csc369' })
  })
  it('adds nothing when the same data is already here, even under new ids', () => {
    const here = workspace({
      courses: [course({ id: 'new-course' })],
      topics: [topic({ id: 'new-topic', courseId: 'new-course' })],
      assessments: [assessment({ id: 'new-a', courseId: 'new-course' })],
      sessions: [{ ...session('2026-11-05', 40), id: 'new-s', topicId: 'new-topic', courseId: 'new-course' }],
    })
    const result = planImport(JSON.stringify(file), here)
    if (!result.ok) throw new Error(result.error)
    expect(result.plan).toMatchObject({ courses: [], topics: [], assessments: [], sessions: [], skipped: { courses: 1, topics: 1, assessments: 1, sessions: 1 } })
  })
  it('finishes an import that stopped partway: adds the topics an existing course lacks and keeps links to the ones it has', () => {
    const full = workspace({
      topics: [topic(), topic({ id: 'tlb', title: 'TLBs', position: 1 }), topic({ id: 'swap', title: 'Swapping', position: 2 })],
      assessments: [assessment({ topicIds: ['paging', 'tlb', 'swap'] })],
      sessions: [
        { ...session('2026-11-05', 40), id: 's1', topicId: 'paging', courseId: 'csc369' },
        { ...session('2026-11-06', 30), id: 's2', topicId: 'swap', courseId: 'csc369' },
      ],
    })
    // The first attempt created the course and one topic, under new ids, then failed.
    const here = workspace({ courses: [course({ id: 'here-course' })], topics: [topic({ id: 'here-paging', courseId: 'here-course', title: ' paging ' })] })
    const result = planImport(JSON.stringify(full), here)
    if (!result.ok) throw new Error(result.error)
    const { plan } = result
    expect(plan.courses).toEqual([])
    expect(plan.existingCourseIds).toEqual({ csc369: 'here-course' })
    expect(plan.existingTopicIds).toEqual({ paging: 'here-paging' })
    expect(plan.topics.map((t) => t.id)).toEqual(['tlb', 'swap'])
    expect(plan.assessments[0].topicIds).toEqual(['paging', 'tlb', 'swap'])
    expect(plan.sessions.map((s) => [s.topicId, s.courseId])).toEqual([['paging', 'csc369'], ['swap', 'csc369']])
    expect(plan.skipped).toMatchObject({ courses: 1, topics: 1 })
  })
  it('pairs repeated titles one to one, so a second copy in the file is added and not merged', () => {
    const twice = workspace({ topics: [topic({ id: 'a', title: 'Review' }), topic({ id: 'b', title: 'Review', position: 1 })] })
    const here = workspace({ topics: [topic({ id: 'only', title: 'Review' })] })
    const result = planImport(JSON.stringify(twice), here)
    if (!result.ok) throw new Error(result.error)
    expect(result.plan.existingTopicIds).toEqual({ a: 'only' })
    expect(result.plan.topics.map((t) => t.id)).toEqual(['b'])
  })
})
