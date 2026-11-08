import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../lib/data'
import { AppShell } from '../shell/AppShell'
import { Wordmark } from '../shell/Wordmark'

const Landing = lazy(() => import('../pages/Landing'))
const Today = lazy(() => import('../pages/Today'))
const Review = lazy(() => import('../pages/Review'))
const Calendar = lazy(() => import('../pages/Calendar'))
const Courses = lazy(() => import('../pages/Courses'))
const Course = lazy(() => import('../pages/Course'))
const Topic = lazy(() => import('../pages/Topic'))
const Focus = lazy(() => import('../pages/Focus'))
const Settings = lazy(() => import('../pages/Settings'))
const NotFound = lazy(() => import('../pages/NotFound'))

function Splash() {
  return (
    <div className="splash" aria-busy="true" aria-label="Loading LockIn">
      <Wordmark size="lg" />
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useAuth()
  if (state.status === 'loading') return <Splash />
  if (state.status === 'signed-out') return <Navigate to="/" replace />
  return children
}

export function App() {
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Today />} />
          <Route path="review" element={<Review />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="courses" element={<Courses />} />
          <Route path="courses/:id" element={<Course />} />
          <Route path="topics/:id" element={<Topic />} />
          <Route path="focus" element={<Focus />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
