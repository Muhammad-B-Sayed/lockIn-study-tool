import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { AuthSession, CalendarItem, DashboardSummary, Quote, Task } from './lib/types'

const apiMocks = vi.hoisted(() => ({
  checkBackendHealth: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  getQuote: vi.fn(),
  getTasks: vi.fn(),
  getDashboard: vi.fn(),
  getCalendarItems: vi.fn(),
  persistSession: vi.fn(),
  updateTask: vi.fn(),
  updateCalendarEvent: vi.fn(),
}))

vi.mock('./lib/api', async () => {
  const actual = await vi.importActual<typeof import('./lib/api')>('./lib/api')
  return {
    ...actual,
    loadStoredSession: () => null,
    persistSession: apiMocks.persistSession,
    checkBackendHealth: apiMocks.checkBackendHealth,
    login: apiMocks.login,
    signup: apiMocks.signup,
    getQuote: apiMocks.getQuote,
    getTasks: apiMocks.getTasks,
    getDashboard: apiMocks.getDashboard,
    getCalendarItems: apiMocks.getCalendarItems,
    createTask: vi.fn(),
    updateTask: apiMocks.updateTask,
    deleteTask: vi.fn(),
    createCalendarEvent: vi.fn(),
    updateCalendarEvent: apiMocks.updateCalendarEvent,
    markCalendarEventComplete: vi.fn(),
    deleteCalendarEvent: vi.fn(),
    changePassword: vi.fn(),
    deleteAccount: vi.fn(),
  }
})

describe('App login flow', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    apiMocks.checkBackendHealth.mockResolvedValue({
      status: 'UP',
      service: 'lockin-backend',
    })
  })

  it('shows a wake-up screen while the backend is still coming online', async () => {
    let resolveHealthCheck:
      | ((value: { status: string; service: string }) => void)
      | undefined
    apiMocks.checkBackendHealth.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHealthCheck = resolve
        }),
    )

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /getting your workspace ready/i })).toBeInTheDocument()
    expect(screen.getByText(/hold tight while we get everything in place/i)).toBeInTheDocument()

    if (resolveHealthCheck) {
      resolveHealthCheck({
        status: 'UP',
        service: 'lockin-backend',
      })
    }

    expect(await screen.findByLabelText(/username/i)).toBeInTheDocument()
  })

  it('signs in and renders the workspace overview', async () => {
    const session: AuthSession = {
      accessToken: 'token-123',
      tokenType: 'Bearer',
      expiresAt: null,
      user: {
        id: 'user-1',
        username: 'muhammad',
        createdAt: null,
      },
    }

    const quote: Quote = {
      content: 'One step at a time.',
      author: 'LockIn',
    }

    const tasks: Task[] = [
      {
        id: 'task-1',
        title: 'Finish CSC207 report',
        description: 'Write the final summary',
        dueDate: '2026-06-20',
        course: 'CSC207',
        completed: false,
        type: 'Assignment',
      },
    ]

    const dashboard: DashboardSummary = {
      tasks,
    }

    apiMocks.login.mockResolvedValue(session)
    apiMocks.getQuote.mockResolvedValue(quote)
    apiMocks.getTasks.mockResolvedValue(tasks)
    apiMocks.getDashboard.mockResolvedValue(dashboard)
    apiMocks.getCalendarItems.mockResolvedValue([])

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    await userEvent.type(await screen.findByLabelText(/username/i), 'muhammad')
    await userEvent.type(await screen.findByLabelText(/^password$/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /enter workspace/i }))

    await waitFor(() => {
      expect(apiMocks.login).toHaveBeenCalledWith({
        username: 'muhammad',
        password: 'secret123',
      })
    })

    expect(await screen.findByText(/stay ahead of what matters this week/i)).toBeInTheDocument()
    expect(await screen.findAllByText(/finish csc207 report/i)).toHaveLength(2)
    expect(screen.getByText(/signed in as muhammad\./i)).toBeInTheDocument()
  })

  it('loads an existing event into edit mode and saves changes', async () => {
    const session: AuthSession = {
      accessToken: 'token-123',
      tokenType: 'Bearer',
      expiresAt: null,
      user: {
        id: 'user-1',
        username: 'muhammad',
        createdAt: null,
      },
    }

    const today = new Date()
    const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const calendarItems: CalendarItem[] = [
      {
        id: 'event-1',
        kind: 'EVENT',
        name: 'Study sprint',
        date: todayValue,
        colorHex: '#ef7b45',
        completed: false,
        taskId: null,
        course: null,
      },
    ]

    apiMocks.login.mockResolvedValue(session)
    apiMocks.getQuote.mockResolvedValue({
      content: 'Keep going.',
      author: 'LockIn',
    })
    apiMocks.getTasks.mockResolvedValue([])
    apiMocks.getDashboard.mockResolvedValue({ tasks: [] })
    apiMocks.getCalendarItems.mockResolvedValue(calendarItems)
    apiMocks.updateCalendarEvent.mockResolvedValue({
      ...calendarItems[0],
      name: 'Updated study sprint',
    })

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    await userEvent.type(await screen.findByLabelText(/username/i), 'muhammad')
    await userEvent.type(await screen.findByLabelText(/^password$/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /enter workspace/i }))

    expect(await screen.findByRole('button', { name: /edit event/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /edit event/i }))

    expect(await screen.findByRole('heading', { name: /edit calendar event/i })).toBeInTheDocument()

    const nameInput = screen.getByDisplayValue('Study sprint')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Updated study sprint')
    await userEvent.click(screen.getByRole('button', { name: /save event changes/i }))

    await waitFor(() => {
      expect(apiMocks.updateCalendarEvent).toHaveBeenCalledWith('event-1', {
        name: 'Updated study sprint',
        date: todayValue,
        colorHex: '#ef7b45',
      })
    })
  })

  it('shows a clear error when saving event changes fails', async () => {
    const session: AuthSession = {
      accessToken: 'token-123',
      tokenType: 'Bearer',
      expiresAt: null,
      user: {
        id: 'user-1',
        username: 'muhammad',
        createdAt: null,
      },
    }

    const today = new Date()
    const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const calendarItems: CalendarItem[] = [
      {
        id: 'event-1',
        kind: 'EVENT',
        name: 'Study sprint',
        date: todayValue,
        colorHex: '#ef7b45',
        completed: false,
        taskId: null,
        course: null,
      },
    ]

    apiMocks.login.mockResolvedValue(session)
    apiMocks.getQuote.mockResolvedValue({
      content: 'Keep going.',
      author: 'LockIn',
    })
    apiMocks.getTasks.mockResolvedValue([])
    apiMocks.getDashboard.mockResolvedValue({ tasks: [] })
    apiMocks.getCalendarItems.mockResolvedValue(calendarItems)
    apiMocks.updateCalendarEvent.mockRejectedValue(new Error('Unexpected server error.'))

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    await userEvent.type(await screen.findByLabelText(/username/i), 'muhammad')
    await userEvent.type(await screen.findByLabelText(/^password$/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /enter workspace/i }))

    const editEventButtons = await screen.findAllByRole('button', { name: /edit event/i })
    expect(editEventButtons.length).toBeGreaterThan(0)

    await userEvent.click(editEventButtons[0])

    const nameInput = screen.getByDisplayValue('Study sprint')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Updated study sprint')
    await userEvent.click(screen.getByRole('button', { name: /save event changes/i }))

    expect(
      await screen.findByText(/could not finish saving event changes\. unexpected server error\./i),
    ).toBeInTheDocument()
  })

  it('loads an existing task into edit mode and saves changes', async () => {
    const session: AuthSession = {
      accessToken: 'token-123',
      tokenType: 'Bearer',
      expiresAt: null,
      user: {
        id: 'user-1',
        username: 'muhammad',
        createdAt: null,
      },
    }

    const tasks: Task[] = [
      {
        id: 'task-1',
        title: 'Finish CSC207 report',
        description: 'Write the final summary',
        dueDate: '2026-06-20',
        course: 'CSC207',
        completed: false,
        type: 'Assignment',
      },
    ]

    apiMocks.login.mockResolvedValue(session)
    apiMocks.getQuote.mockResolvedValue({
      content: 'Keep going.',
      author: 'LockIn',
    })
    apiMocks.getTasks.mockResolvedValue(tasks)
    apiMocks.getDashboard.mockResolvedValue({ tasks })
    apiMocks.getCalendarItems.mockResolvedValue([])
    apiMocks.updateTask.mockResolvedValue({
      ...tasks[0],
      title: 'Finish CSC207 final report',
    })

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    await userEvent.type(await screen.findByLabelText(/username/i), 'muhammad')
    await userEvent.type(await screen.findByLabelText(/^password$/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /enter workspace/i }))

    const editTaskButtons = await screen.findAllByRole('button', { name: /edit task/i })
    expect(editTaskButtons.length).toBeGreaterThan(0)

    await userEvent.click(editTaskButtons[0])

    expect(await screen.findByRole('heading', { name: /edit task/i })).toBeInTheDocument()

    const titleInput = screen.getByDisplayValue('Finish CSC207 report')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Finish CSC207 final report')
    await userEvent.click(screen.getByRole('button', { name: /save task changes/i }))

    await waitFor(() => {
      expect(apiMocks.updateTask).toHaveBeenCalledWith('task-1', {
        title: 'Finish CSC207 final report',
        description: 'Write the final summary',
        dueDate: '2026-06-20',
        course: 'CSC207',
        completed: false,
        type: 'Assignment',
      })
    })
  })
})
