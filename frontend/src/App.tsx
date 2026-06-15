import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import {
  changePassword,
  createCalendarEvent,
  createTask,
  deleteCalendarEvent,
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
  updateCalendarEvent,
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

const fullDateFormatter = new Intl.DateTimeFormat('en-CA', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function App() {
  const today = getCurrentDateValue()
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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [eventForm, setEventForm] = useState<EventFormState>({
    name: '',
    date: today,
    colorHex: '#ef7b45',
  })
  const [newPassword, setNewPassword] = useState('')
  const [month, setMonth] = useState(getCurrentMonthValue())
  const [selectedDate, setSelectedDate] = useState(today)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
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
  const [isRefreshingQuote, setIsRefreshingQuote] = useState(false)
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

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
          setErrorMessage(formatActionError('loading the workspace', error))
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
    setIsRefreshingQuote(true)
    setErrorMessage(null)
    try {
      setQuote(await getQuote())
    } catch (error: unknown) {
      setErrorMessage(formatActionError('refreshing the quote', error))
    } finally {
      setIsRefreshingQuote(false)
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
    setStatusMessage(null)

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
      setErrorMessage(
        formatActionError(authMode === 'signup' ? 'creating your account' : 'signing in', error),
      )
    } finally {
      setIsSubmittingAuth(false)
    }
  }

  async function handleSubmitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmittingTask(true)
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const payload = {
        title: taskForm.title,
        description: taskForm.description,
        dueDate: taskForm.dueDate || null,
        course: taskForm.course,
        completed: editingTaskId
          ? (tasks.find((task) => task.id === editingTaskId)?.completed ?? false)
          : false,
        type: taskForm.type,
      } satisfies TaskRequest

      if (editingTaskId) {
        await updateTask(editingTaskId, payload)
      } else {
        await createTask(payload)
      }

      setEditingTaskId(null)
      setTaskForm({
        title: '',
        description: '',
        dueDate: '',
        course: '',
        type: 'Assignment',
      })
      await refreshWorkspace()
      setStatusMessage(editingTaskId ? 'Task updated.' : 'Task added.')
    } catch (error: unknown) {
      setErrorMessage(
        formatActionError(editingTaskId ? 'saving task changes' : 'saving the task', error),
      )
    } finally {
      setIsSubmittingTask(false)
    }
  }

  async function handleToggleTask(task: Task) {
    setErrorMessage(null)
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
      setErrorMessage(
        formatActionError(task.completed ? 'reopening the task' : 'completing the task', error),
      )
    }
  }

  async function handleDeleteTask(taskId: string) {
    setErrorMessage(null)
    try {
      await deleteTask(taskId)
      if (editingTaskId === taskId) {
        setEditingTaskId(null)
        setTaskForm({
          title: '',
          description: '',
          dueDate: '',
          course: '',
          type: 'Assignment',
        })
      }
      await refreshWorkspace()
      setStatusMessage('Task removed.')
    } catch (error: unknown) {
      setErrorMessage(formatActionError('deleting the task', error))
    }
  }

  function handleEditTask(task: Task) {
    setEditingEventId(null)
    setEventForm((current) => ({
      ...current,
      name: '',
      date: selectedDate,
      colorHex: '#ef7b45',
    }))
    setEditingTaskId(task.id)
    setTaskForm({
      title: task.title,
      description: task.description ?? '',
      dueDate: task.dueDate ?? '',
      course: task.course ?? '',
      type: task.type,
    })
  }

  function handleCancelTaskEditing() {
    setEditingTaskId(null)
    setTaskForm({
      title: '',
      description: '',
      dueDate: '',
      course: '',
      type: 'Assignment',
    })
  }

  async function handleSubmitEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmittingEvent(true)
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const nextMonth = eventForm.date.slice(0, 7)
      const payload = {
        name: eventForm.name,
        date: eventForm.date,
        colorHex: eventForm.colorHex,
      } satisfies CalendarEventRequest

      if (editingEventId) {
        await updateCalendarEvent(editingEventId, payload)
      } else {
        await createCalendarEvent(payload)
      }

      setSelectedDate(eventForm.date)
      setEditingEventId(null)
      setEventForm((current) => ({
        ...current,
        name: '',
        date: eventForm.date,
      }))
      if (nextMonth !== month) {
        setMonth(nextMonth)
        await refreshWorkspace(nextMonth)
      } else {
        await refreshWorkspace()
      }
      setStatusMessage(editingEventId ? 'Event updated.' : 'Event added to the calendar.')
    } catch (error: unknown) {
      setErrorMessage(
        formatActionError(editingEventId ? 'saving event changes' : 'saving the event', error),
      )
    } finally {
      setIsSubmittingEvent(false)
    }
  }

  async function handleCompleteEvent(eventId: string) {
    setErrorMessage(null)
    try {
      await markCalendarEventComplete(eventId)
      if (editingEventId === eventId) {
        setEditingEventId(null)
      }
      await refreshWorkspace()
      setStatusMessage('Event marked complete.')
    } catch (error: unknown) {
      setErrorMessage(formatActionError('marking the event complete', error))
    }
  }

  async function handleDeleteCalendarEvent(eventId: string, eventName: string) {
    const confirmed = window.confirm(`Delete "${eventName}" from your calendar?`)
    if (!confirmed) {
      return
    }

    try {
      await deleteCalendarEvent(eventId)
      if (editingEventId === eventId) {
        setEditingEventId(null)
        setEventForm((current) => ({
          ...current,
          name: '',
          date: selectedDate,
          colorHex: '#ef7b45',
        }))
      }
      await refreshWorkspace()
      setStatusMessage('Event removed from the calendar.')
    } catch (error: unknown) {
      setErrorMessage(formatActionError('deleting the event', error))
    }
  }

  async function handleToggleCalendarTask(taskId: string) {
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task) {
      setErrorMessage('Task not found in the current workspace view.')
      return
    }

    await handleToggleTask(task)
  }

  function handleEditCalendarEvent(item: CalendarItem) {
    const nextMonth = item.date.slice(0, 7)
    setEditingTaskId(null)
    setTaskForm({
      title: '',
      description: '',
      dueDate: '',
      course: '',
      type: 'Assignment',
    })
    setEditingEventId(item.id)
    setSelectedDate(item.date)
    setEventForm({
      name: item.name,
      date: item.date,
      colorHex: item.colorHex,
    })
    if (nextMonth !== month) {
      setMonth(nextMonth)
    }
  }

  function handleCancelEventEditing() {
    setEditingEventId(null)
    setEventForm({
      name: '',
      date: selectedDate,
      colorHex: '#ef7b45',
    })
  }

  function handleSelectCalendarDate(dateValue: string) {
    if (!dateValue) {
      setEventForm((current) => ({
        ...current,
        date: '',
      }))
      return
    }

    setSelectedDate(dateValue)
      setEventForm((current) => ({
        ...current,
        date: dateValue,
      }))
      const nextMonth = dateValue.slice(0, 7)
      if (nextMonth !== month) {
        setMonth(nextMonth)
    }
  }

  function handleMonthSelection(nextMonth: string) {
    const nextSelectedDate = alignDateToMonth(selectedDate, nextMonth)
    setMonth(nextMonth)
    setSelectedDate(nextSelectedDate)
    setEventForm((current) => ({
      ...current,
      date: current.date ? alignDateToMonth(current.date, nextMonth) : nextSelectedDate,
    }))
  }

  function handleMonthStep(offset: number) {
    handleMonthSelection(shiftMonthValue(month, offset))
  }

  function handleJumpToCurrentMonth() {
    const today = getCurrentDateValue()
    setMonth(today.slice(0, 7))
    setSelectedDate(today)
    setEventForm((current) => ({
      ...current,
      date: today,
    }))
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newPassword.trim()) {
      return
    }
    setIsChangingPassword(true)
    setErrorMessage(null)
    setStatusMessage(null)

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
      setErrorMessage(formatActionError('updating the password', error))
    } finally {
      setIsChangingPassword(false)
    }
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      'Delete your account and all workspace data? This cannot be undone.',
    )
    if (!confirmed) {
      return
    }

    setIsDeletingAccount(true)
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await deleteAccount()
      handleSignOut()
      setStatusMessage('Account deleted.')
    } catch (error: unknown) {
      setErrorMessage(formatActionError('deleting the account', error))
    } finally {
      setIsDeletingAccount(false)
    }
  }

  function handleSignOut() {
    const today = getCurrentDateValue()
    setAuthSession(null)
    setTasks([])
    setDashboard({ tasks: [] })
    setCalendarItems([])
    setEditingTaskId(null)
    setMonth(today.slice(0, 7))
    setSelectedDate(today)
    setEditingEventId(null)
    setTaskForm({
      title: '',
      description: '',
      dueDate: '',
      course: '',
      type: 'Assignment',
    })
    setEventForm({
      name: '',
      date: today,
      colorHex: '#ef7b45',
    })
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
              editingTaskId={editingTaskId}
              calendarItems={calendarItems}
              month={month}
              selectedDate={selectedDate}
              editingEventId={editingEventId}
              taskQuery={taskQuery}
              taskForm={taskForm}
              eventForm={eventForm}
              newPassword={newPassword}
              statusMessage={statusMessage}
              errorMessage={errorMessage}
              isLoadingWorkspace={isLoadingWorkspace}
              isRefreshingQuote={isRefreshingQuote}
              isSubmittingTask={isSubmittingTask}
              isSubmittingEvent={isSubmittingEvent}
              isChangingPassword={isChangingPassword}
              isDeletingAccount={isDeletingAccount}
              onTaskQueryChange={setTaskQuery}
              onMonthChange={handleMonthSelection}
              onSelectCalendarDate={handleSelectCalendarDate}
              onPreviousMonth={() => handleMonthStep(-1)}
              onNextMonth={() => handleMonthStep(1)}
              onJumpToCurrentMonth={handleJumpToCurrentMonth}
              onTaskFormChange={setTaskForm}
              onEventFormChange={setEventForm}
              onNewPasswordChange={setNewPassword}
              onRefreshQuote={refreshQuote}
              onSubmitTask={handleSubmitTask}
              onEditTask={handleEditTask}
              onCancelTaskEditing={handleCancelTaskEditing}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onToggleCalendarTask={handleToggleCalendarTask}
              onSubmitEvent={handleSubmitEvent}
              onCompleteEvent={handleCompleteEvent}
              onEditCalendarEvent={handleEditCalendarEvent}
              onCancelEventEditing={handleCancelEventEditing}
              onDeleteCalendarEvent={handleDeleteCalendarEvent}
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
        <div className="intro-copy-block">
          <p className="eyebrow">LockIn</p>
          <h1>Keep tasks, deadlines, and key dates in one calm workspace.</h1>
          <p className="intro-copy">
            See what needs attention, plan the week ahead, and move through your schedule
            with less friction.
          </p>
        </div>

        <div className="intro-showcase">
          <article className="preview-board">
            <div className="preview-board-header">
              <div>
                <span className="preview-label">This week at a glance</span>
                <h2>Everything that needs your attention, already sorted.</h2>
              </div>
              <div className="preview-chip">3 focus items</div>
            </div>

            <div className="preview-board-body">
              <div className="preview-lane">
                <div className="preview-row">
                  <div className="preview-dot assignment"></div>
                  <div>
                    <strong>Physics lab write-up</strong>
                    <p>Due tomorrow at 5:00 PM</p>
                  </div>
                  <span>Drafting</span>
                </div>
                <div className="preview-row">
                  <div className="preview-dot event"></div>
                  <div>
                    <strong>Group check-in</strong>
                    <p>Calendar event for Wednesday</p>
                  </div>
                  <span>11:30</span>
                </div>
                <div className="preview-row">
                  <div className="preview-dot reading"></div>
                  <div>
                    <strong>History reading block</strong>
                    <p>Protected focus lane for tonight</p>
                  </div>
                  <span>90 min</span>
                </div>
              </div>

              <div className="preview-month-card">
                <div className="preview-month-heading">
                  <span>Calendar view</span>
                  <strong>June</strong>
                </div>
                <div className="preview-weekdays">
                  {weekdayLabels.map((label) => (
                    <span key={label}>{label[0]}</span>
                  ))}
                </div>
                <div className="preview-days">
                  {['24', '25', '26', '27', '28', '29', '30', '1', '2', '3', '4', '5', '6'].map(
                    (day) => (
                      <span
                        key={day}
                        className={day === '3' || day === '5' ? 'preview-day active' : 'preview-day'}
                      >
                        {day}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          </article>

          <div className="preview-rail">
            <article className="preview-stat">
              <span>01</span>
              <strong>Task board</strong>
              <p>Capture work quickly and keep the details attached to every task.</p>
            </article>
            <article className="preview-stat">
              <span>02</span>
              <strong>Calendar view</strong>
              <p>Track important dates in one monthly view that stays easy to scan.</p>
            </article>
            <article className="preview-stat">
              <span>03</span>
              <strong>Focus lane</strong>
              <p>Bring the most urgent work forward so your next step stays obvious.</p>
            </article>
          </div>
        </div>

        <div className="signal-grid">
          <article className="signal-card">
            <span>Tasks due</span>
            <h2>4 lined up</h2>
            <p>See the next deadlines without bouncing between notes and tabs.</p>
          </article>
          <article className="signal-card">
            <span>Calendar events</span>
            <h2>2 this week</h2>
            <p>Keep meetings, reminders, and study blocks visible in the same flow.</p>
          </article>
          <article className="signal-card">
            <span>Weekly focus</span>
            <h2>One clear lane</h2>
            <p>Move through the week with a tighter plan and less last-minute drift.</p>
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
  editingTaskId: string | null
  calendarItems: CalendarItem[]
  month: string
  selectedDate: string
  editingEventId: string | null
  taskQuery: string
  taskForm: TaskFormState
  eventForm: EventFormState
  newPassword: string
  statusMessage: string | null
  errorMessage: string | null
  isLoadingWorkspace: boolean
  isRefreshingQuote: boolean
  isSubmittingTask: boolean
  isSubmittingEvent: boolean
  isChangingPassword: boolean
  isDeletingAccount: boolean
  onTaskQueryChange: (value: string) => void
  onMonthChange: (value: string) => void
  onSelectCalendarDate: (value: string) => void
  onPreviousMonth: () => void
  onNextMonth: () => void
  onJumpToCurrentMonth: () => void
  onTaskFormChange: React.Dispatch<React.SetStateAction<TaskFormState>>
  onEventFormChange: React.Dispatch<React.SetStateAction<EventFormState>>
  onNewPasswordChange: (value: string) => void
  onRefreshQuote: () => Promise<void>
  onSubmitTask: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onEditTask: (task: Task) => void
  onCancelTaskEditing: () => void
  onToggleTask: (task: Task) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
  onToggleCalendarTask: (taskId: string) => Promise<void>
  onSubmitEvent: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onCompleteEvent: (eventId: string) => Promise<void>
  onEditCalendarEvent: (item: CalendarItem) => void
  onCancelEventEditing: () => void
  onDeleteCalendarEvent: (eventId: string, eventName: string) => Promise<void>
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
  editingTaskId,
  calendarItems,
  month,
  selectedDate,
  editingEventId,
  taskQuery,
  taskForm,
  eventForm,
  newPassword,
  statusMessage,
  errorMessage,
  isLoadingWorkspace,
  isRefreshingQuote,
  isSubmittingTask,
  isSubmittingEvent,
  isChangingPassword,
  isDeletingAccount,
  onTaskQueryChange,
  onMonthChange,
  onSelectCalendarDate,
  onPreviousMonth,
  onNextMonth,
  onJumpToCurrentMonth,
  onTaskFormChange,
  onEventFormChange,
  onNewPasswordChange,
  onRefreshQuote,
  onSubmitTask,
  onEditTask,
  onCancelTaskEditing,
  onToggleTask,
  onDeleteTask,
  onToggleCalendarTask,
  onSubmitEvent,
  onCompleteEvent,
  onEditCalendarEvent,
  onCancelEventEditing,
  onDeleteCalendarEvent,
  onChangePassword,
  onDeleteAccount,
  onSignOut,
  onDismissStatus,
  onDismissError,
}: WorkspaceScreenProps) {
  const days = buildMonthDays(month)
  const itemsByDate = groupCalendarItems(calendarItems)
  const selectedItems = sortCalendarItems(itemsByDate.get(selectedDate) ?? [])
  const today = getCurrentDateValue()
  const isEditingEvent = editingEventId !== null
  const isEditingTask = editingTaskId !== null
  const taskFormPanelRef = useRef<HTMLElement | null>(null)
  const taskTitleInputRef = useRef<HTMLInputElement | null>(null)
  const eventFormPanelRef = useRef<HTMLElement | null>(null)
  const eventNameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isEditingTask) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      window.location.hash = 'tasks'
      taskFormPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      taskTitleInputRef.current?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isEditingTask])

  useEffect(() => {
    if (!isEditingEvent) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      window.location.hash = 'calendar'
      eventFormPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      eventNameInputRef.current?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isEditingEvent])

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <div>
          <p className="eyebrow">LockIn</p>
          <h1 className="sidebar-title">
            <span className="sidebar-title-word">Workspace</span>
            <span className="sidebar-title-meta">
              <span className="sidebar-title-connector">for</span>
              <span className="sidebar-title-user">{user.username}</span>
            </span>
          </h1>
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
              <button disabled={isRefreshingQuote} type="button" onClick={() => void onRefreshQuote()}>
                {isRefreshingQuote ? 'Refreshing...' : 'Refresh quote'}
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

          <article className="panel form-panel" id="tasks" ref={taskFormPanelRef}>
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Capture work</p>
                <h3>{isEditingTask ? 'Edit task' : 'Add a task'}</h3>
              </div>
            </div>

            <form className="stack-form" onSubmit={onSubmitTask}>
              <label>
                Title
                <input
                  ref={taskTitleInputRef}
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
                  <DatePickerField
                    allowClear
                    placeholder="Choose a due date"
                    value={taskForm.dueDate}
                    onChange={(value) =>
                      onTaskFormChange((current) => ({ ...current, dueDate: value }))
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

              <div className="form-actions">
                <button className="primary-button" disabled={isSubmittingTask} type="submit">
                  {isSubmittingTask
                    ? 'Saving task...'
                    : isEditingTask
                      ? 'Save task changes'
                      : 'Save task'}
                </button>
                {isEditingTask ? (
                  <button
                    className="ghost-button subtle-button"
                    disabled={isSubmittingTask}
                    type="button"
                    onClick={onCancelTaskEditing}
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>
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
                      <button type="button" onClick={() => onEditTask(task)}>
                        Edit task
                      </button>
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

        <section className="calendar-section">
          <article
            className="panel form-panel calendar-form-panel"
            id="calendar"
            ref={eventFormPanelRef}
          >
            <div className="calendar-form-header">
              <div>
                <p className="panel-kicker">Plan ahead</p>
                <h3>{isEditingEvent ? 'Edit calendar event' : 'Add a calendar event'}</h3>
                <p className="panel-copy">
                  Click any day in the calendar to prefill the date and keep your schedule tight.
                </p>
              </div>

              <div className="selected-date-banner compact">
                <span>Selected day</span>
                <strong>{formatFullDate(selectedDate)}</strong>
              </div>
            </div>

            <form className="calendar-form-grid" onSubmit={onSubmitEvent}>
              <label className="calendar-field calendar-field-title">
                Event name
                <input
                  ref={eventNameInputRef}
                  value={eventForm.name}
                  onChange={(event) =>
                    onEventFormChange((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Review block, meeting, personal reminder"
                  required
                />
              </label>

              <label className="calendar-field">
                Date
                <DatePickerField value={eventForm.date} onChange={onSelectCalendarDate} />
              </label>

              <label className="calendar-field">
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

              <div className="calendar-form-actions">
                <button className="primary-button" disabled={isSubmittingEvent} type="submit">
                  {isSubmittingEvent
                    ? 'Saving event...'
                    : isEditingEvent
                      ? 'Save event changes'
                      : 'Add event'}
                </button>
                {isEditingEvent ? (
                  <button
                    className="ghost-button subtle-button"
                    disabled={isSubmittingEvent}
                    type="button"
                    onClick={onCancelEventEditing}
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>
          </article>

          <article className="panel month-panel calendar-main-panel">
            <div className="panel-heading calendar-heading">
              <div>
                <p className="panel-kicker">Calendar</p>
                <h3>{monthFormatter.format(parseMonthValue(month))}</h3>
              </div>
              <div className="calendar-toolbar">
                <div className="month-stepper">
                  <button type="button" onClick={onPreviousMonth}>
                    Previous
                  </button>
                  <button type="button" onClick={onJumpToCurrentMonth}>
                    Today
                  </button>
                  <button type="button" onClick={onNextMonth}>
                    Next
                  </button>
                </div>
                <input
                  type="month"
                  value={month}
                  onChange={(event) => onMonthChange(event.target.value)}
                />
              </div>
            </div>

            <div className="calendar-weekdays" aria-hidden="true">
              {weekdayLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {days.map((day) => {
                const key = toIsoDate(day)
                const items = sortCalendarItems(itemsByDate.get(key) ?? [])
                const previewItems = items.slice(0, 3)
                const isToday = key === today
                const isSelected = key === selectedDate

                return (
                  <button
                    className={[
                      'calendar-cell',
                      day.inMonth ? '' : 'muted',
                      isToday ? 'today' : '',
                      isSelected ? 'selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={key}
                    type="button"
                    onClick={() => onSelectCalendarDate(key)}
                  >
                    <header>
                      <span>{weekdayFormatter.format(day.date)}</span>
                      <strong>{day.date.getDate()}</strong>
                    </header>

                    <div className="calendar-stack">
                      {items.length === 0 ? (
                        <span className="empty-chip">{day.inMonth ? 'Open' : 'Outside month'}</span>
                      ) : (
                        previewItems.map((item) => (
                          <div
                            className={`calendar-pill ${item.completed ? 'completed' : ''}`}
                            key={item.id}
                            style={{ '--pill-accent': item.colorHex } as React.CSSProperties}
                          >
                            <span>{item.kind === 'TASK' ? item.course || 'Task' : 'Event'}</span>
                            <strong>{item.name}</strong>
                          </div>
                        ))
                      )}
                      {items.length > previewItems.length ? (
                        <span className="calendar-more">+{items.length - previewItems.length} more</span>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>

            <section className="agenda-panel" aria-labelledby="agenda-title">
              <div className="panel-heading agenda-heading">
                <div>
                  <p className="panel-kicker">Selected day</p>
                  <h4 id="agenda-title">{formatFullDate(selectedDate)}</h4>
                </div>
                <span className="agenda-count">
                  {selectedItems.length === 1 ? '1 item' : `${selectedItems.length} items`}
                </span>
              </div>

              {selectedItems.length === 0 ? (
                <EmptyState
                  title="Nothing scheduled"
                  body="Pick a date in the grid and add an event to start blocking out time."
                />
              ) : (
                <div className="agenda-list">
                  {selectedItems.map((item) => (
                    <article className="agenda-item" key={item.id}>
                      <div className="agenda-item-header">
                        <span
                          className={`agenda-kind ${item.kind === 'EVENT' ? 'event' : 'task'}`}
                          style={{ '--pill-accent': item.colorHex } as React.CSSProperties}
                        >
                          {item.kind === 'TASK' ? 'Task' : 'Event'}
                        </span>
                        {item.completed ? <span className="agenda-status">Completed</span> : null}
                      </div>

                      <h5>{item.name}</h5>
                      <p>
                        {item.kind === 'TASK'
                          ? item.course || 'Task from your board'
                          : 'Personal calendar block'}
                      </p>

                      <div className="agenda-actions">
                        {item.kind === 'TASK' && item.taskId ? (
                          <button
                            type="button"
                            onClick={() => void onToggleCalendarTask(item.taskId!)}
                          >
                            {item.completed ? 'Reopen task' : 'Complete task'}
                          </button>
                        ) : null}

                        {item.kind === 'EVENT' && !item.completed ? (
                          <button type="button" onClick={() => void onCompleteEvent(item.id)}>
                            Mark complete
                          </button>
                        ) : null}

                        {item.kind === 'EVENT' ? (
                          <button type="button" onClick={() => onEditCalendarEvent(item)}>
                            Edit event
                          </button>
                        ) : null}

                        {item.kind === 'EVENT' ? (
                          <button
                            type="button"
                            className="danger-link"
                            onClick={() => void onDeleteCalendarEvent(item.id, item.name)}
                          >
                            Delete event
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
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
                <button className="primary-button" disabled={isChangingPassword} type="submit">
                  {isChangingPassword ? 'Updating password...' : 'Update password'}
                </button>
              </form>
            </div>

            <div className="danger-box">
              <h4>Danger zone</h4>
              <p>Deleting your account permanently removes all of your planning data.</p>
              <button
                className="danger-button"
                disabled={isDeletingAccount}
                type="button"
                onClick={() => void onDeleteAccount()}
              >
                {isDeletingAccount ? 'Deleting account...' : 'Delete account'}
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

function DatePickerField({
  value,
  onChange,
  allowClear = false,
  placeholder = 'Choose a date',
}: {
  value: string
  onChange: (value: string) => void
  allowClear?: boolean
  placeholder?: string
}) {
  const todayValue = getCurrentDateValue()
  const [isOpen, setIsOpen] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(() => (value || todayValue).slice(0, 7))

  return (
    <div className="date-picker-field">
      <button
        aria-expanded={isOpen}
        className="date-picker-trigger"
        type="button"
        onClick={() => {
          setPickerMonth((value || todayValue).slice(0, 7))
          setIsOpen((current) => !current)
        }}
      >
        <span>{value ? formatFullDate(value) : placeholder}</span>
        <strong>{value || 'No date selected'}</strong>
      </button>

      {isOpen ? (
        <div className="date-picker-popover">
          <div className="date-picker-header">
            <strong>{monthFormatter.format(parseMonthValue(pickerMonth))}</strong>
            <div className="date-picker-controls">
              <button type="button" onClick={() => setPickerMonth(shiftMonthValue(pickerMonth, -1))}>
                Previous
              </button>
              <button
                type="button"
                onClick={() => {
                  setPickerMonth(todayValue.slice(0, 7))
                  onChange(todayValue)
                  setIsOpen(false)
                }}
              >
                Today
              </button>
              {allowClear ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange('')
                    setIsOpen(false)
                  }}
                >
                  Clear
                </button>
              ) : null}
              <button type="button" onClick={() => setPickerMonth(shiftMonthValue(pickerMonth, 1))}>
                Next
              </button>
            </div>
          </div>

          <div className="date-picker-weekdays" aria-hidden="true">
            {weekdayLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="date-picker-grid">
            {buildMonthDays(pickerMonth).map((day) => {
              const dayValue = toIsoDate(day)
              return (
                <button
                  className={[
                    'date-picker-day',
                    day.inMonth ? '' : 'muted',
                    dayValue === value ? 'selected' : '',
                    dayValue === todayValue ? 'today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  key={dayValue}
                  type="button"
                  onClick={() => {
                    onChange(dayValue)
                    setIsOpen(false)
                  }}
                >
                  {day.date.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function getCurrentMonthValue() {
  return toMonthValue(new Date())
}

function getCurrentDateValue() {
  return toIsoDate({ date: new Date() })
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

  return Array.from({ length: 42 }, (_, index) => {
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

function sortCalendarItems(items: CalendarItem[]) {
  return [...items].sort((left, right) => {
    if (left.completed !== right.completed) {
      return Number(left.completed) - Number(right.completed)
    }

    if (left.kind !== right.kind) {
      return left.kind === 'EVENT' ? -1 : 1
    }

    return left.name.localeCompare(right.name)
  })
}

function toIsoDate(day: { date: Date }) {
  return `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`
}

function shiftMonthValue(month: string, offset: number) {
  const date = parseMonthValue(month)
  date.setMonth(date.getMonth() + offset)
  return toMonthValue(date)
}

function alignDateToMonth(dateValue: string, monthValue: string) {
  const [, , dayValue] = dateValue.split('-').map(Number)
  const nextMonthDate = parseMonthValue(monthValue)
  const lastDay = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, 0).getDate()
  const day = Math.min(dayValue || 1, lastDay)
  return `${monthValue}-${String(day).padStart(2, '0')}`
}

function formatFullDate(value: string) {
  return fullDateFormatter.format(new Date(`${value}T00:00:00`))
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

function formatActionError(action: string, error: unknown) {
  const message = getErrorMessage(error)
  const detail = message.endsWith('.') ? message : `${message}.`
  return `Could not finish ${action}. ${detail}`
}

export default App
