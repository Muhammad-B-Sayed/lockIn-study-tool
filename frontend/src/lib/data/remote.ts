import { asDataError, DataError } from './source'
import { withLocalPlannedDate } from './planning'
import type { AuthSession, DataSource, SignupCredentials } from './source'
import type {
  Assessment, AssessmentInput, AssessmentPatch, CalendarEvent, Course, CourseInput,
  Credentials, EventInput, RateInput, SessionInput, StudySession, Topic, TopicInput,
  TopicPatch, User, Workspace,
} from './types'

export type RemoteOptions = {
  baseUrl?: string
  token?: string | (() => string | null)
  onUnauthorized?: () => void
  fetch?: typeof globalThis.fetch
}

export function createRemoteDataSource(options: RemoteOptions = {}): DataSource {
  // Accept both an origin and the existing deployment setting ending in /api.
  const base = (options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '')
  async function request<T>(path: string, method = 'GET', body?: unknown, authenticated = true): Promise<T> {
    const token = typeof options.token === 'function' ? options.token() : options.token
    let response: Response
    try {
      response = await (options.fetch ?? globalThis.fetch)(`${base}/api${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      })
    } catch (error) { throw asDataError(error) }
    let payload: unknown = null
    try {
      const text = await response.text()
      if (text) { try { payload = JSON.parse(text) as unknown } catch { payload = text } }
    } catch (error) { throw asDataError(error) }
    if (!response.ok) {
      if (response.status === 401 && authenticated) options.onUnauthorized?.()
      const message = payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message) : typeof payload === 'string' && payload ? payload : `Request failed with status ${response.status}`
      throw new DataError(response.status, message)
    }
    return payload as T
  }
  const id = encodeURIComponent
  return {
    health: () => request<void>('/health', 'GET', undefined, false),
    signIn: (input: Credentials) => request<AuthSession>('/auth/login', 'POST', input, false),
    signUp: (input: SignupCredentials) => request<AuthSession>('/auth/signup', 'POST', { ...input, repeatPassword: input.repeatPassword ?? input.password }, false),
    getProfile: () => request<User>('/me'),
    changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
      await request<void>('/me/password', 'PATCH', { currentPassword, password: newPassword })
    },
    deleteAccount: () => request<void>('/me', 'DELETE'),
    getWorkspace: () => request<Workspace>('/workspace'),
    createCourse: (input: CourseInput) => request<Course>('/courses', 'POST', input),
    updateCourse: (key: string, input: Partial<CourseInput>) => request<Course>(`/courses/${id(key)}`, 'PATCH', input),
    removeCourse: (key: string) => request<void>(`/courses/${id(key)}`, 'DELETE'),
    createTopic: (input: TopicInput) => request<Topic>('/topics', 'POST', withLocalPlannedDate(input)),
    createTopics: (topics: TopicInput[]) => request<Topic[]>('/topics/bulk', 'POST', { topics: topics.map(withLocalPlannedDate) }),
    updateTopic: (key: string, input: TopicPatch) => request<Topic>(`/topics/${id(key)}`, 'PATCH', withLocalPlannedDate(input)),
    removeTopic: (key: string) => request<void>(`/topics/${id(key)}`, 'DELETE'),
    rateTopic: (input: RateInput) => request<Awaited<ReturnType<DataSource['rateTopic']>>>(`/topics/${id(input.topicId)}/reviews`, 'POST', { rating: input.rating, source: input.source }),
    undoReview: (key: string) => request<{ topic: Topic }>(`/reviews/${id(key)}`, 'DELETE'),
    createAssessment: (input: AssessmentInput) => request<Assessment>('/assessments', 'POST', input),
    createAssessments: (assessments: AssessmentInput[]) => request<Assessment[]>('/assessments/bulk', 'POST', { assessments }),
    updateAssessment: (key: string, input: AssessmentPatch) => request<Assessment>(`/assessments/${id(key)}`, 'PATCH', input),
    removeAssessment: (key: string) => request<void>(`/assessments/${id(key)}`, 'DELETE'),
    createEvent: (input: EventInput) => request<CalendarEvent>('/events', 'POST', input),
    updateEvent: (key: string, input: Partial<EventInput>) => request<CalendarEvent>(`/events/${id(key)}`, 'PATCH', input),
    removeEvent: (key: string) => request<void>(`/events/${id(key)}`, 'DELETE'),
    createSession: (input: SessionInput) => request<StudySession>('/sessions', 'POST', input),
    removeSession: (key: string) => request<void>(`/sessions/${id(key)}`, 'DELETE'),
  }
}
