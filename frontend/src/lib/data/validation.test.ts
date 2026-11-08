import { describe, expect, it } from 'vitest'
import { createLocalDataSource } from './local'
import { createDemoWorkspace } from './seed'
import type { AssessmentPatch, CourseInput, EventInput, SessionInput, TopicPatch } from './types'

const now = new Date('2026-11-07T17:00:00Z')
const workspace = createDemoWorkspace(now)
const badValues: [entity: string, field: string, value: unknown][] = [
  ['course', 'color', 'pink'], ['course', 'status', 'draft'], ['course', 'code', 'x'.repeat(121)],
  ['course', 'name', 'x'.repeat(201)], ['course', 'name', '   '], ['course', 'term', 'x'.repeat(121)],
  ['course', 'instructor', 'x'.repeat(201)], ['course', 'email', 'invalid'], ['course', 'email', 'x'.repeat(255)],
  ['course', 'website', 'ftp://example.com'], ['course', 'website', 'https://example.com/' + 'x'.repeat(2048)],
  ['topic', 'title', 'x'.repeat(201)], ['topic', 'details', 'x'.repeat(1001)], ['topic', 'notes', 'x'.repeat(100001)],
  ['topic', 'notes', null], ['topic', 'plannedDate', '2026-02-29'], ['topic', 'plannedDate', '2026-13-01'],
  ['topic', 'plannedDate', '2026-1-01'], ['topic', 'plannedStart', '2026-11-07T10:00:00'],
  ['topic', 'plannedStart', '2026-02-30T10:00:00Z'], ['topic', 'plannedStart', '2026-11-07T24:00:00Z'],
  ['topic', 'lastReviewedAt', 'not-an-instant'], ['topic', 'plannedMinutes', 0], ['topic', 'plannedMinutes', 1441],
  ['topic', 'position', -1], ['topic', 'position', 0.5], ['topic', 'confidence', 'great'],
  ['topic', 'resources', null], ['topic', 'resources', [{ label: 'x'.repeat(201), url: 'https://example.com' }]],
  ['topic', 'resources', [{ label: 'Notes', url: 'javascript:alert(1)' }]],
  ['topic', 'resources', [{ label: 'Notes', url: 'https://example.com/' + 'x'.repeat(2048) }]],
  ['topic', 'resources', Array.from({ length: 101 }, () => ({ label: 'Notes', url: 'https://example.com' }))],
  ['assessment', 'kind', 'midterm'], ['assessment', 'dueDate', '11/07/2026'], ['assessment', 'dueDate', '2026-02-30'],
  ['assessment', 'dueTime', '24:00'], ['assessment', 'dueTime', '14:00:00'], ['assessment', 'weight', 101],
  ['assessment', 'weight', -1], ['assessment', 'weight', 0.123], ['assessment', 'done', 'true'],
  ['assessment', 'title', 'x'.repeat(201)], ['assessment', 'notes', 'x'.repeat(100001)],
  ['assessment', 'topicIds', null], ['assessment', 'topicIds', Array(501).fill(workspace.topics[0].id)],
  ['assessment', 'topicIds', [workspace.topics[0].id, workspace.topics[0].id]],
  ['event', 'date', '2026-02-30'], ['event', 'startTime', '9:30'], ['event', 'endTime', '25:00'],
  ['event', 'endTime', '13:00'], ['event', 'title', 'x'.repeat(201)], ['event', 'color', '#ffffff'], ['event', 'done', null],
  ['session', 'startedAt', 'yesterday'], ['session', 'startedAt', '2026-11-07T10:00:00'],
  ['session', 'startedAt', '2026-02-30T10:00:00Z'], ['session', 'minutes', 0], ['session', 'minutes', 1441],
  ['session', 'minutes', 1.5], ['session', 'note', 'x'.repeat(1001)],
]

describe('demo validation agrees with backend DTO limits', () => {
  it.each(badValues)('rejects invalid %s.%s and leaves the workspace unchanged', async (entity, field, value) => {
    const source = createLocalDataSource({ initialWorkspace: workspace, now: () => now, storage: null })
    const before = await source.getWorkspace()
    const patch = { [field]: value }
    const actions: Record<string, () => Promise<unknown>> = {
      course: () => source.updateCourse(workspace.courses[0].id, patch as Partial<CourseInput>),
      topic: () => source.updateTopic(workspace.topics[0].id, patch as TopicPatch),
      assessment: () => source.updateAssessment(workspace.assessments[0].id, patch as AssessmentPatch),
      event: () => source.updateEvent(workspace.events[0].id, patch as Partial<EventInput>),
      session: () => source.createSession({ ...workspace.sessions[0], ...patch } as SessionInput),
    }
    await expect(actions[entity]()).rejects.toMatchObject({ name: 'DataError', status: 400, message: expect.stringContaining(field) })
    expect(await source.getWorkspace()).toEqual(before)
  })
  it('checks course and topic ownership references on every write path', async () => {
    const source = createLocalDataSource({ initialWorkspace: workspace, now: () => now, storage: null })
    const topic = { ...workspace.topics[0], resources: [] }
    const assessment = workspace.assessments[0]
    const session: SessionInput = workspace.sessions[0]
    for (const operation of [
      () => source.createTopic({ ...topic, courseId: 'missing' }),
      () => source.createTopics([topic, { ...topic, courseId: 'missing' }]),
      () => source.createAssessment({ ...assessment, courseId: 'missing' }),
      () => source.createAssessments([assessment, { ...assessment, topicIds: ['missing'] }]),
      () => source.updateAssessment(assessment.id, { courseId: 'missing' }),
      () => source.updateAssessment(assessment.id, { topicIds: ['missing'] }),
      () => source.createSession({ ...session, courseId: 'missing' }),
      () => source.createSession({ ...session, topicId: 'missing' }),
    ]) await expect(operation()).rejects.toMatchObject({ status: 404 })
    await expect(source.createSession({ ...session, topicId: topic.id, courseId: workspace.courses[1].id })).rejects.toMatchObject({ status: 400, message: "courseId must match the topic's course." })
  })
  it('accepts valid leap dates, offsets and the documented size and numeric boundaries', async () => {
    const source = createLocalDataSource({ initialWorkspace: workspace, now: () => now, storage: null })
    const prefix = 'https://example.com/'
    const url = prefix + 'x'.repeat(2048 - prefix.length)
    await expect(source.updateCourse(workspace.courses[0].id, {
      code: 'x'.repeat(120), name: 'x'.repeat(200), term: 'x'.repeat(120), instructor: 'x'.repeat(200), website: url,
    })).resolves.toBeDefined()
    await expect(source.updateTopic(workspace.topics[0].id, {
      title: 'x'.repeat(200), details: 'x'.repeat(1000), notes: 'x'.repeat(100000), plannedDate: '2028-02-29',
      plannedStart: '2028-02-29T23:59:59.123456789-05:00', plannedMinutes: 1440, position: 0,
      resources: [{ label: 'x'.repeat(200), url }],
    })).resolves.toMatchObject({ plannedDate: '2028-02-29' })
    await expect(source.updateAssessment(workspace.assessments[0].id, { dueDate: '2028-02-29', dueTime: '23:59', weight: 0.29 })).resolves.toBeDefined()
    await expect(source.createSession({ courseId: null, topicId: null, startedAt: '2028-02-29T23:59:59.123456789-05:00', minutes: 1440, note: 'x'.repeat(1000) })).resolves.toBeDefined()
  })
})
