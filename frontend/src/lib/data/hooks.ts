import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDataContext } from './context'
import { createLocalDataSource } from './local'
import { asDataError, DataError } from './source'
import type { DataSource } from './source'
import type { IdRegistry } from './identity'
import type {
  AssessmentInput, AssessmentPatch, CourseInput, EventInput, RateInput,
  SessionInput, Topic, TopicInput, TopicPatch, Workspace,
} from './types'

export const WORKSPACE_QUERY_KEY = ['workspace'] as const
export function useAuth() {
  const { state, signIn, signUp, startDemo, signOut } = useDataContext()
  return { state, signIn, signUp, startDemo, signOut }
}
export function useWorkspace() {
  const { source, state } = useDataContext()
  return useQuery<Workspace, DataError>({ queryKey: WORKSPACE_QUERY_KEY,
    queryFn: async () => { try { return await source.getWorkspace() } catch (error) { throw asDataError(error) } },
    enabled: state.status === 'signed-in',
  })
}

// Replace temporary records with exact server responses, including nested resource ids.
function reconcile(workspace: Workspace, optimistic: unknown, actual: unknown, identities: IdRegistry): Workspace {
  const replacements = new Map<string, object>()
  function collect(before: unknown, after: unknown) {
    if (Array.isArray(before) && Array.isArray(after)) { before.forEach((value, i) => collect(value, after[i])); return }
    if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return
    if ('id' in before && typeof before.id === 'string' && 'id' in after && typeof after.id === 'string') {
      replacements.set(before.id, after)
      identities.register(before.id, after.id)
    }
    if ('resources' in before && 'resources' in after) collect(before.resources, after.resources)
    if ('topic' in before && 'topic' in after) collect(before.topic, after.topic)
    if ('review' in before && 'review' in after) collect(before.review, after.review)
  }
  collect(optimistic, actual)
  const next = { ...workspace }
  for (const key of ['courses', 'topics', 'assessments', 'events', 'sessions', 'reviews'] as const) {
    // The replacement is the same entity type as the optimistic operation's result.
    Object.assign(next, { [key]: workspace[key].map(row => replacements.get(row.id) ?? row) })
  }
  return identities.resolve(next)
}

type Operation<I, O> = (source: DataSource, input: I) => Promise<O>
/** Serialize complete optimistic transactions so a failed mutation cannot erase a later one. */
function useWorkspaceMutation<I, O>(operation: Operation<I, O>, optimisticOperation = operation, previousDates?: (input: I) => Record<string, string | null>) {
  const { source, enqueue, isCurrent, state, identities } = useDataContext()
  const client = useQueryClient()
  const mutation = useMutation<O, DataError, I>({ mutationFn: async input => {
    const assertCurrent = () => {
      if (state.status !== 'signed-in' || !isCurrent()) throw new DataError(401, 'Your session changed. Please try again.')
    }
    let previous: Workspace | undefined
    try {
      assertCurrent()
      await client.cancelQueries({ queryKey: WORKSPACE_QUERY_KEY })
      assertCurrent()
      previous = client.getQueryData<Workspace>(WORKSPACE_QUERY_KEY)
      if (!previous) {
        previous = await source.getWorkspace()
        assertCurrent()
      }
      const optimisticSource = createLocalDataSource({ initialWorkspace: previous, storage: null,
        makeId: () => `temp-${crypto.randomUUID()}`, reviewPreviousDates: previousDates?.(input) })
      const optimisticResult = await optimisticOperation(optimisticSource, input)
      assertCurrent()
      const optimisticWorkspace = await optimisticSource.getWorkspace()
      assertCurrent()
      client.setQueryData(WORKSPACE_QUERY_KEY, optimisticWorkspace)
      assertCurrent()
      const result = await operation(source, input)
      assertCurrent()
      client.setQueryData(WORKSPACE_QUERY_KEY, reconcile(optimisticWorkspace, optimisticResult, result, identities))
      return result
    } catch (error) {
      if (isCurrent() && previous) client.setQueryData(WORKSPACE_QUERY_KEY, previous)
      throw asDataError(error)
    }
  } })
  return (input: I) => enqueue(() => mutation.mutateAsync(identities.resolve(input)))
}

export function useCourseMutations() {
  const create = useWorkspaceMutation((s, input: CourseInput) => s.createCourse(input))
  const update = useWorkspaceMutation((s, input: { id: string; patch: Partial<CourseInput> }) => s.updateCourse(input.id, input.patch))
  const remove = useWorkspaceMutation((s, id: string) => s.removeCourse(id))
  return { create, update: (id: string, patch: Partial<CourseInput>) => update({ id, patch }), remove }
}
export function useTopicMutations() {
  const create = useWorkspaceMutation((s, input: TopicInput) => s.createTopic(input))
  const createMany = useWorkspaceMutation((s, input: TopicInput[]) => s.createTopics(input))
  const update = useWorkspaceMutation((s, input: { id: string; patch: TopicPatch }) => s.updateTopic(input.id, input.patch))
  const remove = useWorkspaceMutation((s, id: string) => s.removeTopic(id))
  return { create, createMany, update: (id: string, patch: TopicPatch) => update({ id, patch }), remove }
}
export function useAssessmentMutations() {
  const create = useWorkspaceMutation((s, input: AssessmentInput) => s.createAssessment(input))
  const createMany = useWorkspaceMutation((s, input: AssessmentInput[]) => s.createAssessments(input))
  const update = useWorkspaceMutation((s, input: { id: string; patch: AssessmentPatch }) => s.updateAssessment(input.id, input.patch))
  const remove = useWorkspaceMutation((s, id: string) => s.removeAssessment(id))
  return { create, createMany, update: (id: string, patch: AssessmentPatch) => update({ id, patch }), remove }
}
export function useEventMutations() {
  const create = useWorkspaceMutation((s, input: EventInput) => s.createEvent(input))
  const update = useWorkspaceMutation((s, input: { id: string; patch: Partial<EventInput> }) => s.updateEvent(input.id, input.patch))
  const remove = useWorkspaceMutation((s, id: string) => s.removeEvent(id))
  return { create, update: (id: string, patch: Partial<EventInput>) => update({ id, patch }), remove }
}
export function useSessionMutations() {
  return {
    create: useWorkspaceMutation((s, input: SessionInput) => s.createSession(input)),
    remove: useWorkspaceMutation((s, id: string) => s.removeSession(id)),
  }
}
export function useRateTopic() {
  const { isCurrent } = useDataContext()
  type RatingRequest = { input: RateInput; capture: (topic: Topic | undefined) => void }
  const commit = useWorkspaceMutation(
    (s, request: RatingRequest) => s.rateTopic(request.input),
    async (s, request: RatingRequest) => {
      const workspace = await s.getWorkspace()
      if (!isCurrent()) throw new DataError(401, 'Your session changed. Please try again.')
      request.capture(workspace.topics.find(t => t.id === request.input.topicId))
      return s.rateTopic(request.input)
    },
  )
  const undo = useWorkspaceMutation(
    (s, input: { reviewId: string; previousTopic: Topic | undefined }) => s.undoReview(input.reviewId),
    undefined,
    input => input.previousTopic ? { [input.reviewId]: input.previousTopic.lastReviewedAt } : {},
  )
  const rate = async (input: RateInput): Promise<{ undo(): Promise<void> }> => {
    let previousTopic: Topic | undefined
    const result = await commit({ input, capture: topic => { previousTopic = topic } })
    return { undo: async () => { await undo({ reviewId: result.review.id, previousTopic }) } }
  }
  return { rate }
}
export function useAccount() {
  const { source, signOut, resetDemo, enqueue, isCurrent } = useDataContext()
  const client = useQueryClient()
  return {
    changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
      try { await source.changePassword(currentPassword, newPassword) } catch (error) { throw asDataError(error) }
    },
    deleteAccount: () => enqueue(async () => {
      try { await source.deleteAccount(); if (isCurrent()) signOut() } catch (error) { throw asDataError(error) }
    }),
    exportData: async (): Promise<Blob> => {
      try {
        const workspace = await client.fetchQuery({ queryKey: WORKSPACE_QUERY_KEY, queryFn: () => source.getWorkspace(), staleTime: 0 })
        return new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' })
      } catch (error) { throw asDataError(error) }
    },
    resetDemo,
  }
}
