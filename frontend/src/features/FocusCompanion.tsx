import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { breakTimer, chime, useBreakRun } from '../app/breakStore'
import { elapsedMs, formatClock, useFocusRun, useTick } from '../app/focusStore'
import { usePrefs } from '../app/prefs'
import { Icon } from '../ui/Icon'
import { useToast } from '../ui/toastContext'
import './companion.css'

const TITLE_MARK = '​' // marks a tab title this component wrote

/**
 * Keeps the focus timer honest away from the Focus page: the tab title counts down,
 * a chime and a toast mark the goal, and a break between sessions gets its own countdown.
 */
export function FocusCompanion() {
  const run = useFocusRun()
  const rest = useBreakRun()
  const prefs = usePrefs()
  const toast = useToast()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const onFocusPage = pathname === '/app/focus'
  const now = useTick((!!run && !run.pausedAt) || !!rest, 1000)

  const ms = run ? elapsedMs(run, now) : 0
  const goalMs = run ? run.goalMinutes * 60_000 : 0
  const over = !!run && ms > goalMs
  // The tick can be up to a second stale right after a break starts, so cap at the full length.
  const restLeft = rest ? Math.min(rest.endsAt - now, rest.minutes * 60_000) : 0

  // Starting a focus session ends the break.
  useEffect(() => {
    if (run && rest) breakTimer.clear()
  }, [run, rest])

  // Goal reached while on another page. The Focus page handles its own chime.
  const chimedFor = useRef<number | null>(over && run ? run.startedAt : null)
  useEffect(() => {
    if (!run || !over || chimedFor.current === run.startedAt) return
    chimedFor.current = run.startedAt
    if (onFocusPage) return
    chime()
    toast.show({ message: `Focus goal reached: ${run.goalMinutes} min`, action: { label: 'Check in', run: () => navigate('/app/focus') } }, 15_000)
  }, [run, over, onFocusPage, toast, navigate])

  // Break finished.
  useEffect(() => {
    if (!rest || restLeft > 0) return
    breakTimer.clear()
    if (restLeft < -60_000) return // it ended while the app was closed
    chime()
    toast.show({ message: 'Break over. Ready for the next one?', action: { label: 'Lock in', run: () => navigate('/app/focus') } }, 15_000)
  }, [rest, restLeft, toast, navigate])

  // Tab title countdown. The page's own title comes back when there is nothing to count.
  const baseTitle = useRef<string | null>(null)
  const label =
    rest && restLeft > 0
      ? `Break ${formatClock(restLeft)}`
      : run && !onFocusPage
        ? `${run.pausedAt ? 'Paused ' : over ? '+' : ''}${formatClock(over ? ms - goalMs : goalMs - ms)} · Focus`
        : null
  useEffect(() => {
    if (!document.title.startsWith(TITLE_MARK)) baseTitle.current = document.title
    if (label) document.title = `${TITLE_MARK}${label} · LockIn`
    else if (document.title.startsWith(TITLE_MARK) && baseTitle.current) document.title = baseTitle.current
  })
  useEffect(
    () => () => {
      if (document.title.startsWith(TITLE_MARK) && baseTitle.current) document.title = baseTitle.current
    },
    [],
  )

  if (!rest || restLeft <= 0) return null
  const pct = Math.max(0, Math.min(1, 1 - restLeft / (rest.minutes * 60_000)))
  return (
    <div className="break-pill" role="status" aria-label={`Break, ${Math.ceil(restLeft / 60_000)} minutes left`}>
      <Icon name="clock" size={16} />
      <span className="break-pill__label">Break</span>
      <span className="break-pill__time t-mono tabular" aria-hidden>
        {formatClock(restLeft)}
      </span>
      <button type="button" className="break-pill__btn" onClick={() => breakTimer.start(prefs.breakMinutes)} title={`Restart at ${prefs.breakMinutes} minutes`}>
        Restart
      </button>
      <button type="button" className="break-pill__btn" onClick={() => breakTimer.clear()}>
        End
      </button>
      <span className="break-pill__track" aria-hidden>
        <span className="break-pill__fill" style={{ ['--w' as string]: `${pct * 100}%` }} />
      </span>
    </div>
  )
}
