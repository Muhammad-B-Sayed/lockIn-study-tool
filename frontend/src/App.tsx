import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import {
  changePassword,
  createCalendarEvent,
  createTask,
  deleteAccount,
  deleteTask,
  getCalendarItems,
  getDashboard,
  getQuote,
  getTasks,
  loadStoredSession,
  login,
  markCalendarEventComplete,
  persistSession,
  signup,
  updateTask,
} from './lib/api'
import type {
  AuthSession,
  CalendarEventRequest,
  CalendarItem,
  DashboardSummary,
  Quote,
  SignupRequest,
  Task,
  TaskRequest,
  User,
} from './lib/types'

type AuthMode = 'login' | 'signup'

type AuthFormState = {
  username: string
  password: string
  repeatPassword: string
}

type TaskFormState = {
  title: string
  description: string
  dueDate: string
  course: string
  type: string
}

type EventFormState = {
  name: string
  date: string
  colorHex: string
}

const monthFormatter = new Intl.DateTimeFormat('en-CA', {
  month: 'long',
  year: 'numeric',
})

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  month: 'short',
  day: 'numeric',
})

const weekdayFormatter = new Intl.DateTimeFormat('en-CA', {
  weekday: 'short',
})

function App() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => loadStoredSession())
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authForm, setAuthForm] = useState<AuthFormState>({
    username: '',
    password: '',
    repeatPassword: '',
  })
  const [taskForm, setTaskForm] = useState<TaskFormState>({
    title: '',
    description: '',
    dueDate: '',
    course: '',
    type: 'Assignment',
  })
  const [eventForm, setEventForm] = useState<EventFormState>({
    name: '',
    date: '',
    colorHex: '#ef7b45',
  })
  const [newPassword, setNewPassword] = useState('')
  const [month, setMonth] = useState(getCurrentMonthValue())
  const [taskQuery, setTaskQuery] = useState('')
  const deferredTaskQuery = useDeferredValue(taskQuery.trim().toLowerCase())
  const [tasks, setTasks] = useState<Task[]>([])
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([])
  const [dashboard, setDashboard] = useState<DashboardSummary>({ tasks: [] })
  const [quote, setQuote] = useState<Quote>({
    content: 'Clarity grows when everything has a place.',
    author: 'LockIn',
  })
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false)
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false)

  const currentUser = authSession?.user ?? null

  useEffect(() => {
    persistSession(authSession)
  }, [authSession])

  useEffect(() => {
    if (!authSession) {
      return
    }

    let cancelled = false

    async function loadWorkspace() {
      setIsLoadingWorkspace(true)
      setErrorMessage(null)

      try {
        const [nextQuote, nextTasks, nextDashboard, nextCalendarItems] = await Promise.all([
          getQuote(),
          getTasks(),
          getDashboard(),
          getCalendarItems(month),
        ])

        if (cancelled) {
          return
        }

        setQuote(nextQuote)
        setTasks(nextTasks)
        setDashboard(nextDashboard)
        setCalendarItems(nextCalendarItems)
      } catch (error: unknown) {
        if (cancelled) {
          return
        }

        const message = getErrorMessage(error)
        if (message === 'Authentication required.' || message === 'Request failed with status 401') {
          setAuthSession(null)
          setTasks([])
          setCalendarItems([])
          setDashboard({ tasks: [] })
          setErrorMessage('Your session ended. Please sign in again.')
        } else {
          setErrorMessage(message)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWorkspace(false)
        }
      }
    }

    void loadWorkspace()

    return () => {
      cancelled = true
    }
  }, [authSession, month])

  const filteredTasks = tasks.filter((task) => {
    if (!deferredTaskQuery) {
      return true
    }

    const haystack = [task.title, task.description, task.course, task.type]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(deferredTaskQuery)
  })

  async function refreshQuote() {
    try {
      setQuote(await getQuote())
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  async function refreshWorkspace(nextMonth = month) {
    const [nextTasks, nextDashboard, nextCalendarItems] = await Promise.all([
      getTasks(),
      getDashboard(),
      getCalendarItems(nextMonth),
    ])

    setTasks(nextTasks)
    setDashboard(nextDashboard)
    setCalendarItems(nextCalendarItems)
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmittingAuth(true)
    setErrorMessage(null)

    try {
      const nextSession =
        authMode === 'signup'
          ? await signup({
              username: authForm.username,
              password: authForm.password,
              repeatPassword: authForm.repeatPassword,
            } satisfies SignupRequest)
          : await login({
              username: authForm.username,
              password: authForm.password,
            })

      persistSession(nextSession)
      startTransition(() => setAuthSession(nextSession))
      setAuthForm({
        username: '',
        password: '',
        repeatPassword: '',
      })
      setStatusMessage(
        authMode === 'signup'
          ? `Welcome, ${nextSession.user.username}.`
          : `Signed in as ${nextSession.user.username}.`,
      )
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmittingAuth(false)
    }
  }

  async function handleCreateTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      await createTask({
        title: taskForm.title,
        description: taskForm.description,
        dueDate: taskForm.dueDate || null,
        course: taskForm.course,
        completed: false,
        type: taskForm.type,
      } satisfies TaskRequest)

      setTaskForm((current) => ({
        ...current,
        title: '',
        description: '',
        dueDate: '',
        course: '',
      }))
      await refreshWorkspace()
      setStatusMessage('Task added.')
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  async function handleToggleTask(task: Task) {
    try {
      await updateTask(task.id, {
        title: task.title,
        description: task.description ?? '',
        dueDate: task.dueDate,
        course: task.course ?? '',
        completed: !task.completed,
        type: task.type,
      })
      await refreshWorkspace()
      setStatusMessage(task.completed ? 'Task reopened.' : 'Task marked complete.')
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  async function handleDeleteTask(taskId: string) {
    try {
      await deleteTask(taskId)
      await refreshWorkspace()
      setStatusMessage('Task removed.')
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  async function handleCreateEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      await createCalendarEvent({
        name: eventForm.name,
        date: eventForm.date,
        colorHex: eventForm.colorHex,
      } satisfies CalendarEventRequest)
      setEventForm((current) => ({
        ...current,
        name: '',
        date: '',
      }))
      await refreshWorkspace()
      setStatusMessage('Event added to the calendar.')
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  async function handleCompleteEvent(eventId: string) {
    try {
      await markCalendarEventComplete(eventId)
      await refreshWorkspace()
      setStatusMessage('Event marked complete.')
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newPassword.trim()) {
      return
    }

    try {
      const updatedUser = await changePassword(newPassword)
      setNewPassword('')
      setAuthSession((current) =>
        current
          ? {
              ...current,
              user: updatedUser,
            }
          : current,
      )
      setStatusMessage('Password updated.')
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      'Delete your account and all workspace data? This cannot be undone.',
    )
    if (!confirmed) {
      return
    }

    try {
      await deleteAccount()
      handleSignOut()
      setStatusMessage('Account deleted.')
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  function handleSignOut() {
    setAuthSession(null)
    setTasks([])
    setDashboard({ tasks: [] })
    setCalendarItems([])
    setStatusMessage('Signed out.')
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          authSession ? (
            <Navigate to="/app" replace />
          ) : (
            <AuthScreen
              authForm={authForm}
              authMode={authMode}
              errorMessage={errorMessage}
              isSubmitting={isSubmittingAuth}
              onFieldChange={setAuthForm}
              onModeChange={setAuthMode}
              onSubmit={handleAuthSubmit}
            />
          )
        }
      />
      <Route
        path="/app"
        element={
          authSession && currentUser ? (
            <WorkspaceScreen
              user={currentUser}
              quote={quote}
              dashboard={dashboard}
              tasks={filteredTasks}
              allTasksCount={tasks.length}
              calendarItems={calendarItems}
              month={month}
              taskQuery={taskQuery}
              taskForm={taskForm}
              eventForm={eventForm}
              newPassword={newPassword}
              statusMessage={statusMessage}
              errorMessage={errorMessage}
              isLoadingWorkspace={isLoadingWorkspace}
              onTaskQueryChange={setTaskQuery}
              onMonthChange={setMonth}
              onTaskFormChange={setTaskForm}
              onEventFormChange={setEventForm}
              onNewPasswordChange={setNewPassword}
              onRefreshQuote={refreshQuote}
              onCreateTask={handleCreateTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onCreateEvent={handleCreateEvent}
              onCompleteEvent={handleCompleteEvent}
              onChangePassword={handleChangePassword}
              onDeleteAccount={handleDeleteAccount}
              onSignOut={handleSignOut}
              onDismissStatus={() => setStatusMessage(null)}
              onDismissError={() => setErrorMessage(null)}
            />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to={authSession ? '/app' : '/'} replace />} />
    </Routes>
  )
}

type AuthScreenProps = {
  authMode: AuthMode
  authForm: AuthFormState
  errorMessage: string | null
  isSubmitting: boolean
  onModeChange: (mode: AuthMode) => void
  onFieldChange: React.Dispatch<React.SetStateAction<AuthFormState>>
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
}

function AuthScreen({
  authMode,
  authForm,
  errorMessage,
  isSubmitting,
  onModeChange,
  onFieldChange,
  onSubmit,
}: AuthScreenProps) {
  return (
    <main className="landing-shell">
      <section className="intro-panel">
        <div>
          <p className="eyebrow">LockIn</p>
          <h1>Keep tasks, deadlines, and key dates in one calm workspace.</h1>
          <p className="intro-copy">
            See what needs attention, plan the week ahead, and move through your schedule
            with less friction.
          </p>
        </div>

        <div className="signal-grid">
          <article className="signal-card">
            <span>01</span>
            <h2>Task board</h2>
            <p>Capture work quickly and keep the details attached to every task.</p>
          </article>
          <article className="signal-card">
            <span>02</span>
            <h2>Calendar view</h2>
            <p>Track important dates in one monthly view that stays easy to scan.</p>
          </article>
          <article className="signal-card">
            <span>03</span>
            <h2>Focus lane</h2>
            <p>Bring the most urgent work forward so your next step stays obvious.</p>
          </article>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-switch">
            <button
              className={authMode === 'login' ? 'active' : ''}
              type="button"
              onClick={() => onModeChange('login')}
            >
              Log in
            </button>
            <button
              className={authMode === 'signup' ? 'active' : ''}
              type="button"
              onClick={() => onModeChange('signup')}
            >
              Create account
            </button>
          </div>

          <h2>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="auth-subtitle">
            {authMode === 'login'
              ? 'Sign in to continue planning your week.'
              : 'Set up your account and start organizing what matters.'}
          </p>

          {errorMessage ? <Banner tone="error" message={errorMessage} /> : null}

          <form className="stack-form" onSubmit={onSubmit}>
            <label>
              Username
              <input
                autoComplete="username"
                value={authForm.username}
                onChange={(event) =>
                  onFieldChange((current) => ({ ...current, username: event.target.value }))
                }
                placeholder="your-username"
                required
              />
            </label>

            <label>
              Password
              <input
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                type="password"
                value={authForm.password}
                onChange={(event) =>
                  onFieldChange((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="Enter your password"
                required
              />
            </label>

            {authMode === 'signup' ? (
              <label>
                Repeat password
                <input
                  autoComplete="new-password"
                  type="password"
                  value={authForm.repeatPassword}
                  onChange={(event) =>
                    onFieldChange((current) => ({
                      ...current,
                      repeatPassword: event.target.value,
                    }))
                  }
                  placeholder="Repeat your password"
                  required
                />
              </label>
            ) : null}

            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting
                ? 'Working...'
                : authMode === 'login'
                  ? 'Enter workspace'
                  : 'Create account'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}

type WorkspaceScreenProps = {
  user: User
  quote: Quote
  dashboard: DashboardSummary
  tasks: Task[]
  allTasksCount: number
  calendarItems: CalendarItem[]
  month: string
  taskQuery: string
  taskForm: TaskFormState
  eventForm: EventFormState
  newPassword: string
  statusMessage: string | null
  errorMessage: string | null
  isLoadingWorkspace: boolean
  onTaskQueryChange: (value: string) => void
  onMonthChange: (value: string) => void
  onTaskFormChange: React.Dispatch<React.SetStateAction<TaskFormState>>
  onEventFormChange: React.Dispatch<React.SetStateAction<EventFormState>>
  onNewPasswordChange: (value: string) => void
  onRefreshQuote: () => Promise<void>
  onCreateTask: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onToggleTask: (task: Task) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
  onCreateEvent: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onCompleteEvent: (eventId: string) => Promise<void>
  onChangePassword: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onDeleteAccount: () => Promise<void>
  onSignOut: () => void
  onDismissStatus: () => void
  onDismissError: () => void
}

function WorkspaceScreen({
  user,
  quote,
  dashboard,
  tasks,
  allTasksCount,
  calendarItems,
  month,
  taskQuery,
  taskForm,
  eventForm,
  newPassword,
  statusMessage,
  errorMessage,
  isLoadingWorkspace,
  onTaskQueryChange,
  onMonthChange,
  onTaskFormChange,
  onEventFormChange,
  onNewPasswordChange,
  onRefreshQuote,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
  onCreateEvent,
  onCompleteEvent,
  onChangePassword,
  onDeleteAccount,
  onSignOut,
  onDismissStatus,
  onDismissError,
}: WorkspaceScreenProps) {
  const days = buildMonthDays(month)
  const itemsByDate = groupCalendarItems(calendarItems)

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <div>
          <p className="eyebrow">LockIn</p>
          <h1 className="sidebar-title">Workspace for {user.username}</h1>
        </div>

        <nav className="section-nav">
          <a href="#overview">Overview</a>
          <a href="#tasks">Tasks</a>
          <a href="#calendar">Calendar</a>
          <a href="#settings">Settings</a>
        </nav>

        <button className="ghost-button" type="button" onClick={onSignOut}>
          Sign out
        </button>
      </aside>

      <section className="workspace-main">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>Stay ahead of what matters this week</h2>
          </div>
          <span className={`status-pill ${isLoadingWorkspace ? 'loading' : ''}`}>
            {isLoadingWorkspace ? 'Syncing' : 'Up to date'}
          </span>
        </header>

        {statusMessage ? (
          <Banner tone="success" message={statusMessage} onDismiss={onDismissStatus} />
        ) : null}
        {errorMessage ? (
          <Banner tone="error" message={errorMessage} onDismiss={onDismissError} />
        ) : null}

        <section className="hero-strip" id="overview">
          <article className="quote-card">
            <div className="quote-meta">
              <span>Today&rsquo;s quote</span>
              <button type="button" onClick={() => void onRefreshQuote()}>
                Refresh quote
              </button>
            </div>
            <blockquote>{quote.content}</blockquote>
            <div className="quote-credit">
              <p>{quote.author}</p>
              <a href="https://zenquotes.io/" rel="noreferrer" target="_blank">
                Quotes by ZenQuotes
              </a>
            </div>
          </article>

          <article className="metric-card">
            <span>Due soon</span>
            <strong>{dashboard.tasks.length}</strong>
            <p>Tasks that need attention in the next few days.</p>
          </article>

          <article className="metric-card">
            <span>Open tasks</span>
            <strong>{tasks.filter((task) => !task.completed).length}</strong>
            <p>{allTasksCount} items currently active across your workspace.</p>
          </article>
        </section>

        <section className="panel-grid">
          <article className="panel overview-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Focus lane</p>
                <h3>Next up</h3>
              </div>
            </div>

            <div className="due-grid">
              {dashboard.tasks.length === 0 ? (
                <EmptyState
                  title="Nothing due soon"
                  body="Add a dated task and it will surface here when the deadline gets close."
                />
              ) : (
                dashboard.tasks.map((task) => (
                  <article className="due-card" key={task.id}>
                    <span>{task.course || 'General'}</span>
                    <h4>{task.title}</h4>
                    <p>{task.description || 'No notes added yet.'}</p>
                    <strong>{formatDate(task.dueDate)}</strong>
                  </article>
                ))
              )}
            </div>
          </article>

          <article className="panel form-panel" id="tasks">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Capture work</p>
                <h3>Add a task</h3>
              </div>
            </div>

            <form className="stack-form" onSubmit={onCreateTask}>
              <label>
                Title
                <input
                  value={taskForm.title}
                  onChange={(event) =>
                    onTaskFormChange((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Finish lab report"
                  required
                />
              </label>

              <label>
                Description
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={(event) =>
                    onTaskFormChange((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Add a note, deliverable, or study reminder"
                />
              </label>

              <div className="split-fields">
                <label>
                  Due date
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(event) =>
                      onTaskFormChange((current) => ({ ...current, dueDate: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Course
                  <input
                    value={taskForm.course}
                    onChange={(event) =>
                      onTaskFormChange((current) => ({ ...current, course: event.target.value }))
                    }
                    placeholder="Design, school, admin"
                  />
                </label>
              </div>

              <label>
                Type
                <select
                  value={taskForm.type}
                  onChange={(event) =>
                    onTaskFormChange((current) => ({ ...current, type: event.target.value }))
                  }
                >
                  <option>Assignment</option>
                  <option>Exam</option>
                  <option>Project</option>
                  <option>Task</option>
                </select>
              </label>

              <button className="primary-button" type="submit">
                Save task
              </button>
            </form>
          </article>
        </section>

        <section className="panel" aria-labelledby="task-list-title">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Task board</p>
              <h3 id="task-list-title">Search and manage tasks</h3>
            </div>
            <input
              className="search-input"
              value={taskQuery}
              onChange={(event) => onTaskQueryChange(event.target.value)}
              placeholder="Search title, course, or notes"
            />
          </div>

          <div className="task-list">
            {tasks.length === 0 ? (
              <EmptyState
                title={allTasksCount === 0 ? 'No tasks yet' : 'No matching tasks'}
                body={
                  allTasksCount === 0
                    ? 'Add your first task above to start planning the week.'
                    : 'Try a broader search or clear the current filter.'
                }
              />
            ) : (
              tasks.map((task) => (
                <article className={`task-card ${task.completed ? 'done' : ''}`} key={task.id}>
                  <div className="task-card-main">
                    <div className="task-tag-row">
                      <span>{task.type}</span>
                      <span>{task.course || 'General'}</span>
                    </div>
                    <h4>{task.title}</h4>
                    <p>{task.description || 'No notes yet.'}</p>
                  </div>

                  <div className="task-card-meta">
                    <strong>{formatDate(task.dueDate)}</strong>
                    <div className="task-actions">
                      <button type="button" onClick={() => void onToggleTask(task)}>
                        {task.completed ? 'Reopen' : 'Complete'}
                      </button>
                      <button
                        type="button"
                        className="danger-link"
                        onClick={() => void onDeleteTask(task.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel-grid">
          <article className="panel form-panel" id="calendar">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Plan ahead</p>
                <h3>Add a calendar event</h3>
              </div>
            </div>

            <form className="stack-form" onSubmit={onCreateEvent}>
              <label>
                Event name
                <input
                  value={eventForm.name}
                  onChange={(event) =>
                    onEventFormChange((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Review block, meeting, personal reminder"
                  required
                />
              </label>

              <div className="split-fields">
                <label>
                  Date
                  <input
                    type="date"
                    value={eventForm.date}
                    onChange={(event) =>
                      onEventFormChange((current) => ({ ...current, date: event.target.value }))
                    }
                    required
                  />
                </label>

                <label>
                  Accent color
                  <input
                    type="color"
                    value={eventForm.colorHex}
                    onChange={(event) =>
                      onEventFormChange((current) => ({
                        ...current,
                        colorHex: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <button className="primary-button" type="submit">
                Add event
              </button>
            </form>
          </article>

          <article className="panel month-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Calendar</p>
                <h3>{monthFormatter.format(parseMonthValue(month))}</h3>
              </div>
              <input
                type="month"
                value={month}
                onChange={(event) => onMonthChange(event.target.value)}
              />
            </div>

            <div className="calendar-grid">
              {days.map((day) => {
                const key = toIsoDate(day)
                const items = itemsByDate.get(key) ?? []

                return (
                  <article className={`calendar-cell ${day.inMonth ? '' : 'muted'}`} key={key}>
                    <header>
                      <span>{weekdayFormatter.format(day.date)}</span>
                      <strong>{day.date.getDate()}</strong>
                    </header>

                    <div className="calendar-stack">
                      {items.length === 0 ? (
                        <span className="empty-chip">Open</span>
                      ) : (
                        items.map((item) => (
                          <button
                            className={`calendar-pill ${item.completed ? 'completed' : ''}`}
                            key={item.id}
                            style={{ '--pill-accent': item.colorHex } as React.CSSProperties}
                            type="button"
                            onClick={() => {
                              if (item.kind === 'EVENT' && !item.completed) {
                                void onCompleteEvent(item.id)
                              }
                            }}
                          >
                            <span>{item.kind === 'TASK' ? item.course || 'Task' : 'Event'}</span>
                            <strong>{item.name}</strong>
                          </button>
                        ))
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </article>
        </section>

        <section className="panel settings-panel" id="settings">
          <div className="settings-grid">
            <div className="settings-main">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Account</p>
                  <h3>Manage your profile</h3>
                </div>
              </div>

              <form className="stack-form compact" onSubmit={onChangePassword}>
                <label>
                  New password
                  <input
                    autoComplete="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => onNewPasswordChange(event.target.value)}
                    placeholder="Set a new password"
                    required
                  />
                </label>
                <button className="primary-button" type="submit">
                  Update password
                </button>
              </form>
            </div>

            <div className="danger-box">
              <h4>Danger zone</h4>
              <p>Deleting your account permanently removes all of your planning data.</p>
              <button className="danger-button" type="button" onClick={() => void onDeleteAccount()}>
                Delete account
              </button>
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}

function Banner({
  tone,
  message,
  onDismiss,
}: {
  tone: 'error' | 'success'
  message: string
  onDismiss?: () => void
}) {
  return (
    <div className={`banner banner-${tone}`}>
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  )
}

function getCurrentMonthValue() {
  return toMonthValue(new Date())
}

function toMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function parseMonthValue(value: string) {
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function buildMonthDays(month: string) {
  const firstOfMonth = parseMonthValue(month)
  const start = new Date(firstOfMonth)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)

    return {
      date,
      inMonth: date.getMonth() === firstOfMonth.getMonth(),
    }
  })
}

function groupCalendarItems(items: CalendarItem[]) {
  const grouped = new Map<string, CalendarItem[]>()

  for (const item of items) {
    const bucket = grouped.get(item.date) ?? []
    bucket.push(item)
    grouped.set(item.date, bucket)
  }

  return grouped
}

function toIsoDate(day: { date: Date }) {
  return `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`
}

function formatDate(value: string | null) {
  if (!value) {
    return 'No due date'
  }

  return dateFormatter.format(new Date(`${value}T00:00:00`))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected request failure.'
}

export default App
