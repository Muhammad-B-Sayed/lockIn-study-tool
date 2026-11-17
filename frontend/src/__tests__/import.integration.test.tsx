import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Workspace } from '../lib/data/types'
import { persisted, renderDemo, seed } from './demoHarness'

const at = '2026-10-01T12:00:00.000Z'
const backup: Workspace = {
  user: seed.user,
  generatedAt: at,
  courses: [{ id: 'old-course', code: 'TST100', name: 'Import Testing', color: 'sky', term: null, instructor: null, email: null, website: null, status: 'active', createdAt: at }],
  topics: [
    { id: 'old-a', courseId: 'old-course', title: 'First imported topic', details: null, notes: 'kept notes', plannedDate: '2026-11-10', plannedStart: null, plannedMinutes: null, confidence: 'okay', lastReviewedAt: '2026-10-20T15:00:00.000Z', position: 0, resources: [{ id: 'r', label: 'Slides', url: 'https://example.com/slides' }], createdAt: at },
    { id: 'old-b', courseId: 'old-course', title: 'Second imported topic', details: null, notes: '', plannedDate: null, plannedStart: null, plannedMinutes: null, confidence: 'unrated', lastReviewedAt: null, position: 1, resources: [], createdAt: at },
  ],
  assessments: [{ id: 'old-x', courseId: 'old-course', title: 'Imported quiz', kind: 'quiz', dueDate: '2026-11-20', dueTime: null, weight: 10, done: false, doneAt: null, notes: '', topicIds: ['old-b'], createdAt: at }],
  events: [{ id: 'old-e', title: 'Imported shift', date: '2026-11-12', startTime: '09:00', endTime: '10:00', color: 'moss', done: false }],
  sessions: [{ id: 'old-s', topicId: 'old-a', courseId: 'old-course', startedAt: '2026-11-05T15:00:00.000Z', minutes: 40, note: 'redo example 3' }],
  reviews: [],
}

async function chooseFile(user: ReturnType<typeof renderDemo>['user'], text: string) {
  await screen.findByRole('button', { name: 'Import data' })
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  await user.upload(input, new File([text], 'lockin-backup.json', { type: 'application/json' }))
}

describe('JSON import in the demo', () => {
  it('adds a file with remapped ids, keeps existing data, and adds nothing the second time', async () => {
    const { user } = renderDemo('/app/settings')
    await chooseFile(user, JSON.stringify(backup))
    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByText('1 course')).toBeInTheDocument()
    expect(dialog.getByText(/Nothing you have now is replaced/)).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Import' }))

    await waitFor(() => expect(persisted().sessions.some((x) => x.note === 'redo example 3')).toBe(true))
    const ws = persisted()
    const course = ws.courses.find((c) => c.code === 'TST100')!
    const first = ws.topics.find((t) => t.title === 'First imported topic')!
    const second = ws.topics.find((t) => t.title === 'Second imported topic')!
    expect(course.id).not.toBe('old-course')
    expect(first).toMatchObject({ courseId: course.id, confidence: 'okay', lastReviewedAt: '2026-10-20T15:00:00.000Z', notes: 'kept notes' })
    expect(first.resources).toMatchObject([{ label: 'Slides', url: 'https://example.com/slides' }])
    expect(ws.assessments.find((a) => a.title === 'Imported quiz')).toMatchObject({ courseId: course.id, topicIds: [second.id], weight: 10 })
    expect(ws.sessions.find((x) => x.note === 'redo example 3')).toMatchObject({ topicId: first.id, courseId: course.id, minutes: 40 })
    expect(ws.events.some((e) => e.title === 'Imported shift')).toBe(true)
    // Everything that was there before is still there.
    expect(ws.courses).toHaveLength(seed.courses.length + 1)
    expect(ws.topics).toHaveLength(seed.topics.length + 2)
    expect(ws.assessments).toHaveLength(seed.assessments.length + 1)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await chooseFile(user, JSON.stringify(backup))
    expect(await screen.findByText('Everything in this file is already here.')).toBeInTheDocument()
    expect(persisted().topics).toHaveLength(seed.topics.length + 2)
  })

  it('refuses a file with an invalid record and writes nothing', async () => {
    const { user } = renderDemo('/app/settings')
    const broken = { ...backup, topics: [{ ...backup.topics[0], title: '' }] }
    await chooseFile(user, JSON.stringify(broken))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Topic 1: .*Nothing was imported/)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(persisted().courses).toHaveLength(seed.courses.length)
  })
})
