import type {
  ApiErrorResponse,
  AuthSession,
  CalendarEventRequest,
  CalendarItem,
  DashboardSummary,
  LoginRequest,
  Quote,
  SignupRequest,
  Task,
  TaskRequest,
  User,
} from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
const AUTH_SESSION_STORAGE_KEY = 'lockin.session'

export function loadStoredSession(): AuthSession | null {
  const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
    return null
  }
}

export function persistSession(session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
    return
  }

  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
}

type RequestOptions = {
  includeAuth?: boolean
}

async function request<T>(path: string, init?: RequestInit, options: RequestOptions = {}): Promise<T> {
  const authSession = options.includeAuth === false ? null : loadStoredSession()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authSession ? { Authorization: `${authSession.tokenType} ${authSession.accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const hasJsonBody = response.headers.get('content-type')?.includes('application/json')
  const payload = hasJsonBody ? ((await response.json()) as T | ApiErrorResponse) : null

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : `Request failed with status ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

export function signup(input: SignupRequest) {
  return request<AuthSession>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  }, { includeAuth: false })
}

export function login(input: LoginRequest) {
  return request<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  }, { includeAuth: false })
}

export function getProfile() {
  return request<User>('/me')
}

export function changePassword(password: string) {
  return request<User>('/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ password }),
  })
}

export async function deleteAccount() {
  await request<void>('/me', {
    method: 'DELETE',
  })
}

export function getTasks() {
  return request<Task[]>('/me/tasks')
}

export function createTask(input: TaskRequest) {
  return request<Task>('/me/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateTask(taskId: string, input: TaskRequest) {
  return request<Task>(`/me/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteTask(taskId: string) {
  await request<void>(`/me/tasks/${taskId}`, {
    method: 'DELETE',
  })
}

export function getDashboard() {
  return request<DashboardSummary>('/me/dashboard/due-soon')
}

export function getCalendarItems(month: string) {
  const searchParams = new URLSearchParams({ month })
  return request<CalendarItem[]>(`/me/calendar?${searchParams.toString()}`)
}

export function createCalendarEvent(input: CalendarEventRequest) {
  return request<CalendarItem>('/me/calendar/events', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function markCalendarEventComplete(eventId: string) {
  return request<CalendarItem>(`/me/calendar/events/${eventId}/complete`, {
    method: 'PATCH',
  })
}

export function getQuote() {
  return request<Quote>('/quotes/random', undefined, { includeAuth: false })
}
