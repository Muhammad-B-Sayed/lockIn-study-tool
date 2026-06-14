import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { AuthSession, DashboardSummary, Quote, Task } from './lib/types'

const apiMocks = vi.hoisted(() => ({
  login: vi.fn(),
  signup: vi.fn(),
  getQuote: vi.fn(),
  getTasks: vi.fn(),
  getDashboard: vi.fn(),
  getCalendarItems: vi.fn(),
  persistSession: vi.fn(),
}))

vi.mock('./lib/api', async () => {
  const actual = await vi.importActual<typeof import('./lib/api')>('./lib/api')
  return {
    ...actual,
    loadStoredSession: () => null,
    persistSession: apiMocks.persistSession,
    login: apiMocks.login,
    signup: apiMocks.signup,
    getQuote: apiMocks.getQuote,
    getTasks: apiMocks.getTasks,
    getDashboard: apiMocks.getDashboard,
    getCalendarItems: apiMocks.getCalendarItems,
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    createCalendarEvent: vi.fn(),
    markCalendarEventComplete: vi.fn(),
    changePassword: vi.fn(),
    deleteAccount: vi.fn(),
  }
})

describe('App login flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
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

    await userEvent.type(screen.getByLabelText(/username/i), 'muhammad')
    await userEvent.type(screen.getByLabelText(/^password$/i), 'secret123')
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
})
