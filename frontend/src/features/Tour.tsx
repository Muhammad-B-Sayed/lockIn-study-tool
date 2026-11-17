import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { endTour, setTourStep, useTourStep } from '../app/tourStore'
import { Button, Kbd } from '../ui/primitives'
import './tour.css'

type Step = {
  route: string
  /** Value of a `data-tour` attribute. The first visible match is highlighted. No target centres the card. */
  target: string | null
  title: string
  body: string
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

const STEPS: Step[] = [
  {
    route: '/app',
    target: null,
    title: 'Turn your syllabus into a study plan',
    body: 'LockIn runs on one loop. Add your courses, study a topic, rate how sure you feel, and LockIn tells you what to review next. This tour takes about a minute.',
  },
  {
    route: '/app/courses',
    target: 'nav-courses',
    title: 'Start with your courses',
    body: 'Add each course, then paste its syllabus schedule. Every lecture becomes a topic and every quiz, assignment or exam becomes a deadline. You check the list before anything is saved.',
  },
  {
    route: '/app',
    target: 'focus',
    title: 'Lock in to study',
    body: 'Pick a topic and how long you want to study. The timer keeps running while you use the rest of the app. When you finish, you rate the topic and can take a short break.',
  },
  {
    route: '/app/review',
    target: 'nav-review',
    title: 'Rate how sure you feel',
    body: 'After studying, rate a topic Shaky, Getting there or Solid. Shaky topics come back the next day, Getting there after three days and Solid after a week. Topics on a close exam move up the queue.',
  },
  {
    route: '/app/calendar',
    target: 'nav-calendar',
    title: 'Plan your week',
    body: 'Planned topics sit on the calendar, and you can drag them to another day. Deadlines stay fixed. Add your own events, like work shifts, so your plan fits around them.',
  },
  {
    route: '/app',
    target: 'search',
    title: 'Find or add anything',
    body: 'Search finds any course, topic or deadline. Type a line like "csc369 midterm nov 12" and LockIn adds the deadline in one go. Each day, start on Today: it shows what to study first and what is due.',
  },
]

const LOOP = ['Add courses', 'Study', 'Rate', 'Review']

const GAP = 14
const EDGE = 16
const PAD = 6

type Box = { top: number; left: number; width: number; height: number }
type Placement = { top: number; left: number; side: 'right' | 'below' | 'above' | 'center' }

function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

function place(target: Box | null, card: { width: number; height: number }): Placement {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const clampX = (x: number) => Math.min(Math.max(x, EDGE), vw - card.width - EDGE)
  const clampY = (y: number) => Math.min(Math.max(y, EDGE), vh - card.height - EDGE)
  if (!target) return { top: clampY((vh - card.height) / 2), left: clampX((vw - card.width) / 2), side: 'center' }
  const right = target.left + target.width + GAP
  if (right + card.width <= vw - EDGE) return { top: clampY(target.top - 8), left: right, side: 'right' }
  const below = target.top + target.height + GAP
  if (below + card.height <= vh - EDGE) return { top: below, left: clampX(target.left + target.width / 2 - card.width / 2), side: 'below' }
  return { top: clampY(target.top - GAP - card.height), left: clampX(target.left + target.width / 2 - card.width / 2), side: 'above' }
}

/** The first-run walkthrough. Mounted once in the app shell; started from tourStore. */
export function Tour({ userId }: { userId: string | null }) {
  const index = useTourStep()
  if (index === null) return null
  return <TourStep key={index} index={index} userId={userId} />
}

function TourStep({ index, userId }: { index: number; userId: string | null }) {
  const step = STEPS[index]
  const last = index === STEPS.length - 1
  const navigate = useNavigate()
  const location = useLocation()
  const cardRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const [target, setTarget] = useState<Box | null>(null)
  const [searching, setSearching] = useState(step.target !== null)
  const [pos, setPos] = useState<Placement | null>(null)

  const close = useCallback(() => endTour(userId), [userId])
  const next = useCallback(() => (last ? close() : setTourStep(index + 1)), [close, index, last])
  const back = useCallback(() => setTourStep(Math.max(0, index - 1)), [index])

  // Go to the step's page, then wait for its target to render (pages load lazily).
  useEffect(() => {
    if (location.pathname !== step.route) navigate(step.route)
    // Only on step change; the page may later change on its own and the tour stays put.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.route])

  useEffect(() => {
    const name = step.target
    if (!name) return
    let frame = 0
    const started = performance.now()
    const measure = () => {
      const el = findTarget(name)
      if (el) {
        const r = el.getBoundingClientRect()
        const top = Math.max(2, r.top - PAD)
        const left = Math.max(2, r.left - PAD)
        const bottom = Math.min(window.innerHeight - 2, r.bottom + PAD)
        const right = Math.min(window.innerWidth - 2, r.right + PAD)
        setTarget({ top, left, width: right - left, height: bottom - top })
        setSearching(false)
        return true
      }
      return false
    }
    const poll = () => {
      if (measure()) return
      // Give up after two seconds and centre the card, so a missing target never blocks the tour.
      if (performance.now() - started > 2000) {
        setTarget(null)
        setSearching(false)
        return
      }
      frame = requestAnimationFrame(poll)
    }
    poll()
    const onMove = () => measure()
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [step.target])

  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card || searching) return
    const measure = () => setPos(place(target, { width: card.offsetWidth, height: card.offsetHeight }))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [target, searching])

  // Focus the main button once the card is placed. The shell moves focus to the page heading on
  // navigation, so this runs after it.
  useEffect(() => {
    if (!pos) return
    const t = window.setTimeout(() => primaryRef.current?.focus({ preventScroll: true }), 30)
    return () => window.clearTimeout(t)
  }, [pos])

  // Escape and the arrow keys work wherever focus is, since a page can take focus as it loads.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault()
        back()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [back, close, index, next])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      // Keep keyboard focus inside the card while the tour is open.
      const items = cardRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
      if (!items?.length) return
      const first = items[0]
      const lastItem = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  const ready = pos !== null
  return createPortal(
    <div className="tour" data-ready={ready ? 'true' : undefined}>
      {/* The scrim blocks the page so a stray click cannot leave the tour half-way. */}
      <div className={target ? 'tour__veil' : 'tour__veil tour__veil--dim'} aria-hidden />
      {target ? (
        <div className="tour__spot" aria-hidden style={{ top: target.top, left: target.left, width: target.width, height: target.height }} />
      ) : null}
      <div
        ref={cardRef}
        className="tour__card"
        data-side={pos?.side}
        data-center={step.target ? undefined : 'true'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        style={pos ? { top: pos.top, left: pos.left } : undefined}
        onKeyDown={onKeyDown}
      >
        <div className="tour__head">
          <span className="tour__count t-mono tabular">
            {index === 0 ? 'Welcome to LockIn' : `Step ${index + 1} of ${STEPS.length}`}
          </span>
          <button type="button" className="tour__skip" onClick={close}>
            {last ? 'Close' : 'Skip tour'}
          </button>
        </div>
        <h2 id="tour-title" className="tour__title">
          {step.title}
        </h2>
        <p id="tour-body" className="tour__body">
          {step.body}
        </p>
        {index === 0 ? (
          <ol className="tour__loop" aria-label="How LockIn works">
            {LOOP.map((label, i) => (
              <li key={label}>
                <span className="tour__loop-n t-mono">{i + 1}</span>
                {label}
              </li>
            ))}
          </ol>
        ) : null}
        {last ? (
          <p className="tour__note">
            <span className="tour__desk">
              <span className="tour__keys">
                <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
                <Kbd>K</Kbd>
              </span>
              opens search from anywhere.{' '}
            </span>
            Replay this tour from Settings, under Help.
          </p>
        ) : null}
        <div className="tour__foot">
          <div className="tour__dots" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className="tour__dot" data-on={i === index ? 'true' : undefined} data-done={i < index ? 'true' : undefined} />
            ))}
          </div>
          <div className="tour__actions">
            {index > 0 ? (
              <Button variant="ghost" size="sm" onClick={back}>
                Back
              </Button>
            ) : null}
            <Button ref={primaryRef} variant="primary" size="sm" onClick={next}>
              {index === 0 ? 'Show me around' : last ? 'Get started' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
