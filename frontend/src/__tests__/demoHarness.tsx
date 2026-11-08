import { QueryClient } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { App } from '../app/App'
import { applyTheme } from '../app/theme'
import { createDemoWorkspace, DataProvider, DEMO_STORAGE_KEY, SESSION_STORAGE_KEY } from '../lib/data'
import type { Workspace } from '../lib/data/types'
import { ToastProvider } from '../ui/toast'

export const NOW = new Date(2026, 10, 7, 14, 30)
export const seed = createDemoWorkspace(NOW)
export const course = seed.courses.find((course) => course.code === 'CSC369')!
export const topic = seed.topics.find((topic) => topic.courseId === course.id)!

const clients: QueryClient[] = []

// eslint-disable-next-line react-refresh/only-export-components -- Test-only render helpers are not refresh boundaries.
function Location() {
  const location = useLocation()
  return <output data-testid="location" hidden>{location.pathname}{location.search}</output>
}

export function renderDemo(path = '/app', signedIn = true) {
  if (signedIn) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ mode: 'demo' }))
  const client = new QueryClient({ defaultOptions: {
    queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    mutations: { retry: false, gcTime: Infinity },
  } })
  clients.push(client)
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <DataProvider queryClient={client} wakeBackend={false}>
        <ToastProvider><App /><Location /></ToastProvider>
      </DataProvider>
    </MemoryRouter>,
  )
  return { ...result, user: userEvent.setup(), client }
}

export function persisted(): Workspace {
  const raw = localStorage.getItem(DEMO_STORAGE_KEY)
  if (!raw) throw new Error('The real demo adapter has not persisted its workspace')
  return JSON.parse(raw) as Workspace
}

export const main = () => within(screen.getByRole('main'))
export const location = () => screen.getByTestId('location').textContent

beforeEach(() => {
  // Freeze the clock while leaving user-event, Query and React timers real.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  localStorage.clear()
  applyTheme('dark')
})

afterEach(async () => {
  cleanup()
  // Allow a notes-on-unmount mutation to complete before resetting shared storage.
  await Promise.resolve()
  for (const client of clients.splice(0)) client.clear()
  localStorage.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
