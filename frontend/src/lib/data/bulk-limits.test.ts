import { describe, expect, it, vi } from 'vitest'
import { createLocalDataSource } from './local'
import { createDemoWorkspace } from './seed'
import type { AssessmentInput, TopicInput } from './types'

const now = new Date('2026-11-07T17:00:00Z')
const workspace = createDemoWorkspace(now)
const topic: TopicInput = { ...workspace.topics[0], resources: [] }
const assessment: AssessmentInput = { ...workspace.assessments[0], topicIds: [] }
const resources = Array.from({ length: 100 }, (_, i) => ({ label: `Reading ${i + 1}`, url: 'https://example.com/reading' }))
const topicIds = workspace.topics.slice(0, 40).map(t => t.id)
function setup() {
  const makeId = vi.fn(() => crypto.randomUUID())
  const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() }
  const source = createLocalDataSource({ initialWorkspace: workspace, storage, makeId, now: () => now })
  return { source, storage, makeId }
}

describe('bulk request budgets', () => {
  it.each(['topics', 'assessments'] as const)('accepts exactly 300 %s', async collection => {
    const { source } = setup()
    const result = collection === 'topics'
      ? await source.createTopics(Array(300).fill(topic))
      : await source.createAssessments(Array(300).fill(assessment))
    expect(result).toHaveLength(300)
  })
  it.each([
    ['topics', 0], ['topics', 301], ['assessments', 0], ['assessments', 301],
  ] as const)('rejects %s count %i before allocating IDs or writing data', async (collection, count) => {
    const { source, storage, makeId } = setup()
    const before = await source.getWorkspace()
    const task = collection === 'topics'
      ? source.createTopics(Array(count).fill(topic))
      : source.createAssessments(Array(count).fill(assessment))
    await expect(task).rejects.toMatchObject({ name: 'DataError', status: 400,
      message: `${collection}: Import between 1 and 300 ${collection} at a time.` })
    expect(makeId).not.toHaveBeenCalled()
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(await source.getWorkspace()).toEqual(before)
  })
  it('accepts exactly 2000 resources, and applies the budget independently to each request', async () => {
    const { source } = setup()
    const inputs = Array.from({ length: 20 }, () => ({ ...topic, resources }))
    const first = await source.createTopics(inputs)
    const second = await source.createTopics(inputs)
    expect(first.reduce((count, row) => count + row.resources.length, 0)).toBe(2000)
    expect(second.reduce((count, row) => count + row.resources.length, 0)).toBe(2000)
  })
  it('rejects 2001 resources across individually valid topics without any writes', async () => {
    const { source, storage, makeId } = setup()
    const before = await source.getWorkspace()
    const inputs = [...Array.from({ length: 20 }, () => ({ ...topic, resources })), { ...topic, resources: resources.slice(0, 1) }]
    await expect(source.createTopics(inputs)).rejects.toMatchObject({ name: 'DataError', status: 400,
      message: 'A bulk request can contain at most 2000 resources.' })
    expect(makeId).not.toHaveBeenCalled()
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(await source.getWorkspace()).toEqual(before)
  })
  it('accepts exactly 2000 topic links across individually valid assessments', async () => {
    const { source } = setup()
    const rows = await source.createAssessments(Array.from({ length: 50 }, () => ({ ...assessment, topicIds })))
    expect(rows.reduce((count, row) => count + row.topicIds.length, 0)).toBe(2000)
  })
  it('rejects 2001 topic links across individually valid assessments without any writes', async () => {
    const { source, storage, makeId } = setup()
    const before = await source.getWorkspace()
    const inputs = [...Array.from({ length: 50 }, () => ({ ...assessment, topicIds })), { ...assessment, topicIds: topicIds.slice(0, 1) }]
    await expect(source.createAssessments(inputs)).rejects.toMatchObject({ name: 'DataError', status: 400,
      message: 'A bulk request can contain at most 2000 topic links.' })
    expect(makeId).not.toHaveBeenCalled()
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(await source.getWorkspace()).toEqual(before)
  })
})
