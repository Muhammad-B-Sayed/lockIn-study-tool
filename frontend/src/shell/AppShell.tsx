import { Suspense, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/data'
import { rankReview } from '../lib/domain'
import { elapsedMs, formatClock, useFocusRun, useTick } from '../app/focusStore'
import { useTheme } from '../app/theme'
import { useNow, useStudy } from '../app/useStudy'
import { Icon, type IconName } from '../ui/Icon'
import { Menu } from '../ui/Menu'
import { Button, Kbd } from '../ui/primitives'
import { CommandPalette } from './CommandPalette'
import { Wordmark } from './Wordmark'
import { ignoreShortcut } from '../app/keys'
import './shell.css'

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/app', label: 'Today', icon: 'today', end: true },
  { to: '/app/review', label: 'Review', icon: 'review' },
  { to: '/app/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/app/courses', label: 'Courses', icon: 'courses' },
]

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function AppShell() {
  const { data, error, refetch, isFetching } = useStudy()
  const auth = useAuth()
  const now = useNow()
  const navigate = useNavigate()
  const location = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { setPref, resolved } = useTheme()

  const reviewCount = useMemo(() => (data ? rankReview(data.ws, now).length : 0), [data, now])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      if (ignoreShortcut(e)) return
      if (e.key === '/') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Move focus to the page heading on navigation, for keyboard and screen reader users.
  useEffect(() => {
    const h = document.querySelector<HTMLElement>('main h1')
    if (h) {
      h.setAttribute('tabindex', '-1')
      h.focus({ preventScroll: true })
    }
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const user = auth.state.status === 'signed-in' ? auth.state : null
  const topicMatch = location.pathname.match(/^\/app\/topics\/([^/]+)/)
  const onTopic = !!topicMatch
  const topicCourseId = topicMatch ? data?.topicById.get(topicMatch[1])?.courseId : undefined

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar__top">
          <Link to="/app" className="sidebar__brand" aria-label="Lockin, go to Today">
            <Wordmark />
          </Link>
        </div>

        <button type="button" className="sidebar__search" onClick={() => setPaletteOpen(true)}>
          <Icon name="search" size={16} />
          <span>Search or add</span>
          <span className="sidebar__keys">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <nav className="nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => ['nav__item', isActive || (n.to === '/app/courses' && onTopic) ? 'active' : ''].join(' ')}
            >
              <Icon name={n.icon} size={18} />
              <span>{n.label}</span>
              {n.label === 'Review' && reviewCount > 0 ? (
                <span className="nav__count tabular" aria-label={`${reviewCount} topics to review`}>
                  {reviewCount}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__section">
          <p className="t-eyebrow sidebar__heading">This term</p>
          <ul className="sidebar__courses">
            {data?.activeCourses.map((c) => (
              <li key={c.id}>
                <NavLink
                  to={`/app/courses/${c.id}`}
                  className={({ isActive }) => ['course-link', isActive || topicCourseId === c.id ? 'active' : ''].join(' ')}
                  data-hue={c.color}
                >
                  <span className="course-link__dot" aria-hidden />
                  <span className="course-link__code t-mono">{c.code}</span>
                  <span className="course-link__name">{c.name}</span>
                </NavLink>
              </li>
            ))}
            {!data
              ? Array.from({ length: 4 }, (_, i) => (
                  <li key={i} className="course-link course-link--ghost" aria-hidden>
                    <span className="skeleton" style={{ height: 10, width: `${50 + i * 9}%` }} />
                  </li>
                ))
              : null}
          </ul>
        </div>

        <div className="sidebar__bottom">
          <NavLink to="/app/settings" className="nav__item nav__item--quiet">
            <Icon name="gear" size={18} />
            <span>Settings</span>
          </NavLink>
          <FocusCta />
          <div className="sidebar__user">
            <Menu
              label="Account"
              align="start"
              trigger={(p) => (
                <button {...p} type="button" className="user-chip">
                  <span className="user-chip__avatar" aria-hidden>
                    {(user?.user.username ?? '?').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="user-chip__name">
                    {user?.user.username ?? 'Guest'}
                    {user?.mode === 'demo' ? <span className="user-chip__badge">Demo</span> : null}
                  </span>
                  <Icon name="chevronDown" size={14} />
                </button>
              )}
              items={[
                { label: 'Settings', icon: 'gear', onSelect: () => navigate('/app/settings') },
                'separator',
                {
                  label: resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
                  icon: resolved === 'dark' ? 'sun' : 'moon',
                  onSelect: () => setPref(resolved === 'dark' ? 'light' : 'dark'),
                },
                'separator',
                {
                  label: user?.mode === 'demo' ? 'Leave demo' : 'Sign out',
                  icon: 'logout',
                  onSelect: async () => {
                    await auth.signOut()
                    navigate('/')
                  },
                },
              ]}
            />
          </div>
        </div>
      </aside>

      <header className="topbar">
        <Link to="/app" className="sidebar__brand" aria-label="Lockin, go to Today">
          <Wordmark />
        </Link>
        <div className="topbar__actions">
          <button type="button" className="icon-btn" aria-label="Search or add" onClick={() => setPaletteOpen(true)}>
            <Icon name="search" />
          </button>
          <Link to="/app/settings" className="icon-btn" aria-label="Settings">
            <Icon name="gear" />
          </Link>
        </div>
      </header>

      <main id="main" className="main">
        {error && !data ? (
          <LoadError message={error.message} retrying={isFetching} onRetry={() => void refetch()} />
        ) : (
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        )}
      </main>

      <nav className="tabbar" aria-label="Primary">
        {NAV.slice(0, 2).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="tabbar__item">
            <Icon name={n.icon} size={20} />
            <span>{n.label}</span>
            {n.label === 'Review' && reviewCount > 0 ? (
              <span className="tabbar__count tabular" aria-label={`${reviewCount} to review`}>
                {reviewCount}
              </span>
            ) : null}
          </NavLink>
        ))}
        <TabbarLock />
        {NAV.slice(2).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => ['tabbar__item', isActive || (n.to === '/app/courses' && onTopic) ? 'active' : ''].join(' ')}
          >
            <Icon name={n.icon} size={20} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

function FocusCta() {
  const run = useFocusRun()
  const now = useTick(!!run && !run.pausedAt)
  if (run) {
    return (
      <Link to="/app/focus" className="focus-pill" data-paused={run.pausedAt ? 'true' : undefined}>
        <span className="focus-pill__pulse" aria-hidden />
        <span className="focus-pill__label">{run.pausedAt ? 'Paused' : 'Locked in'}</span>
        <span className="focus-pill__time t-mono tabular">{formatClock(elapsedMs(run, now))}</span>
      </Link>
    )
  }
  return (
    <Link to="/app/focus" className="lock-cta">
      <Icon name="timer" size={18} />
      <span>Lock in</span>
      <span className="lock-cta__hint">Start a focus session</span>
    </Link>
  )
}

function TabbarLock() {
  const run = useFocusRun()
  return (
    <NavLink to="/app/focus" className="tabbar__lock" data-running={run ? 'true' : undefined}>
      <span className="tabbar__lock-circle">
        <Icon name="timer" size={22} />
      </span>
      <span className="tabbar__lock-label">{run ? 'Focusing' : 'Focus'}</span>
    </NavLink>
  )
}

function PageFallback() {
  return (
    <div className="page" aria-busy="true">
      <span className="skeleton" style={{ height: 14, width: 120, marginBottom: 18 }} />
      <span className="skeleton" style={{ height: 44, width: '55%', marginBottom: 40 }} />
      <span className="skeleton" style={{ height: 180, width: '100%', borderRadius: 18 }} />
    </div>
  )
}

function LoadError({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
  return (
    <div className="page load-error" role="alert">
      <p className="t-eyebrow">Could not load your workspace</p>
      <h1 className="t-display load-error__title">The lamp flickered.</h1>
      <p className="t-muted load-error__body">
        {message || 'The server did not answer.'} If you just opened the app, the server may still be waking up. That can take
        up to a minute.
      </p>
      <Button variant="primary" icon="review" loading={retrying} onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
