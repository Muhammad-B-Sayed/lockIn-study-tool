import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSessionMutations } from '../lib/data'
import { rankReview } from '../lib/domain'
import type { Confidence, Topic } from '../lib/data/types'
import { elapsedMs, focus, formatClock, useFocusRun, useTick, type FocusRun } from '../app/focusStore'
import { useNow, useStudy, type StudyIndex } from '../app/useStudy'
import { useRateWithUndo } from '../features/actions'
import { ConfidenceGlyph } from '../ui/confidence'
import { CONFIDENCE, RATABLE } from '../ui/confidenceMeta'
import { Button, Kbd, Select } from '../ui/primitives'
import { CourseTag } from '../ui/study'
import { useToast } from '../ui/toastContext'
import { ignoreShortcut } from '../app/keys'
import './review.css'
import './focus.css'

const GOALS = [25, 50, 90]

export default function Focus() {
  const { data } = useStudy()
  const run = useFocusRun()
  const [finished, setFinished] = useState<{ run: FocusRun; ms: number } | null>(null)
  if (!data) return <div className="focus" aria-busy="true" />
  if (finished) return <CheckIn s={data} done={finished} onClose={() => setFinished(null)} />
  if (run) return <Running s={data} run={run} onFinish={(ms) => setFinished({ run, ms })} />
  return <Setup s={data} />
}

function FocusFrame({ children, progress = 0, hue }: { children: React.ReactNode; progress?: number; hue?: string }) {
  return (
    <div className="focus" data-hue={hue} style={{ ['--p' as string]: Math.min(1, progress) }}>
      <div className="focus__inner">{children}</div>
    </div>
  )
}

// ---------- setup ----------

function Setup({ s }: { s: StudyIndex }) {
  const now = useNow()
  const navigate = useNavigate()
  const ranked = useMemo(() => rankReview(s.ws, now).slice(0, 3), [s.ws, now])
  const [topicId, setTopicId] = useState<string>(ranked[0]?.topic.id ?? '')
  const [goal, setGoal] = useState(50)
  const topic = topicId ? s.topicById.get(topicId) : undefined
  const course = topic ? s.courseById.get(topic.courseId) : undefined

  const begin = () => focus.start({ topicId: topic?.id ?? null, courseId: topic?.courseId ?? null, goalMinutes: goal })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignoreShortcut(e)) return
      if (e.key === 'Enter') begin()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <FocusFrame hue={course?.color}>
      <div className="focus__top">
        <Button variant="ghost" size="sm" icon="arrowLeft" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>
      <div className="setup">
        <p className="t-eyebrow setup__eyebrow">Focus session</p>
        <h1 className="setup__title t-display">
          What are you <em>locking in</em> on?
        </h1>

        {ranked.length ? (
          <ul className="setup__picks" aria-label="Suggested topics">
            {ranked.map((r) => {
              const c = s.courseById.get(r.topic.courseId)
              return (
                <li key={r.topic.id}>
                  <button type="button" className="pick" aria-pressed={topicId === r.topic.id} data-hue={c?.color} onClick={() => setTopicId(r.topic.id)}>
                    <span className="pick__row">
                      <CourseTag course={c} size="sm" />
                      <ConfidenceGlyph value={r.topic.confidence} />
                    </span>
                    <span className="pick__title">{r.topic.title}</span>
                    <span className="pick__why">{r.reasons[0]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}

        <div className="setup__other">
          <label htmlFor="focus-topic" className="t-faint">
            {ranked.length ? 'Or pick any topic' : 'Pick a topic'}
          </label>
          <Select id="focus-topic" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">No topic, just focus</option>
            {s.activeCourses.map((c) => (
              <optgroup key={c.id} label={`${c.code} · ${c.name}`}>
                {(s.topicsByCourse.get(c.id) ?? [])
                  .filter((t) => t.confidence !== 'retired')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </div>

        <div className="setup__goal" role="radiogroup" aria-label="Session length">
          {GOALS.map((g) => (
            <button key={g} type="button" role="radio" aria-checked={goal === g} className="goal" onClick={() => setGoal(g)}>
              <span className="goal__n t-display tabular">{g}</span>
              <span className="goal__u">min</span>
            </button>
          ))}
        </div>

        <Button variant="primary" size="lg" icon="timer" className="setup__go" onClick={begin}>
          Lock in{topic ? ` on ${topic.title.length > 28 ? 'this' : topic.title}` : ''}
        </Button>
        <p className="setup__hint t-faint kbd-hint">
          Press <Kbd>Enter</Kbd> to start. The timer keeps running if you leave this page.
        </p>
      </div>
    </FocusFrame>
  )
}

// ---------- running ----------

function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const notes = [659.25, 987.77]
    notes.forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      const t0 = ctx.currentTime + i * 0.18
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(0.12, t0 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4)
      o.connect(g).connect(ctx.destination)
      o.start(t0)
      o.stop(t0 + 1.5)
    })
    window.setTimeout(() => void ctx.close(), 2200)
  } catch {
    /* audio is optional */
  }
}

function Running({ s, run, onFinish }: { s: StudyIndex; run: FocusRun; onFinish: (ms: number) => void }) {
  const navigate = useNavigate()
  const now = useTick(!run.pausedAt, 250)
  const ms = elapsedMs(run, now)
  const goalMs = run.goalMinutes * 60_000
  const over = ms > goalMs
  const topic = run.topicId ? s.topicById.get(run.topicId) : undefined
  const course = topic ? s.courseById.get(topic.courseId) : run.courseId ? s.courseById.get(run.courseId) : undefined
  const chimed = useRef(over)

  useEffect(() => {
    if (over && !chimed.current) {
      chimed.current = true
      chime()
    }
  }, [over])

  useEffect(() => {
    const prev = document.title
    document.title = `${over ? '+' : ''}${formatClock(over ? ms - goalMs : goalMs - ms)} · ${topic?.title ?? 'Focus'} · LockIn`
    return () => {
      document.title = prev
    }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignoreShortcut(e)) return
      if (e.key === ' ') {
        e.preventDefault()
        if (run.pausedAt) focus.resume()
        else focus.pause()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run.pausedAt])

  const display = over ? `+${formatClock(ms - goalMs)}` : formatClock(goalMs - ms)

  return (
    <FocusFrame progress={ms / goalMs} hue={course?.color}>
      <div className="focus__top">
        <Button variant="ghost" size="sm" icon="arrowLeft" onClick={() => navigate('/app')} title="The timer keeps running">
          Leave running
        </Button>
        <span className="focus__status t-mono" data-paused={run.pausedAt ? 'true' : undefined}>
          <span className="focus__dot" aria-hidden />
          {run.pausedAt ? 'Paused' : over ? 'Past your goal' : 'Locked in'}
        </span>
        <span className="focus__goal t-faint tabular">{run.goalMinutes} min goal</span>
      </div>

      <div className="clock">
        {topic ? (
          <div className="clock__topic">
            <CourseTag course={course} />
            <Link to={`/app/topics/${topic.id}`} className="clock__title">
              {topic.title}
            </Link>
          </div>
        ) : (
          <p className="clock__title">Open focus</p>
        )}
        <p className="clock__time t-display tabular" data-over={over || undefined} role="timer" aria-live="off" aria-label={`${formatClock(ms)} elapsed`}>
          {display}
        </p>
        <div className="clock__track" aria-hidden>
          <span className="clock__fill" />
        </div>
        <p className="clock__elapsed t-faint tabular">
          {over ? `past your ${run.goalMinutes} min goal` : `left of ${run.goalMinutes} min`} ·{' '}
          {ms < 60_000 ? 'started just now' : `${Math.floor(ms / 60_000)} min in`}
        </p>

        <div className="clock__controls">
          {run.pausedAt ? (
            <Button variant="secondary" size="lg" icon="play" onClick={() => focus.resume()}>
              Resume
            </Button>
          ) : (
            <Button variant="secondary" size="lg" icon="pause" onClick={() => focus.pause()}>
              Pause
            </Button>
          )}
          <Button variant="primary" size="lg" icon="check" onClick={() => onFinish(ms)}>
            Finish
          </Button>
        </div>
        <p className="clock__hint t-faint kbd-hint">
          <Kbd>space</Kbd> pause or resume
        </p>
        {topic?.details ? <p className="clock__details">{topic.details}</p> : null}
      </div>
    </FocusFrame>
  )
}

// ---------- check-in ----------

function CheckIn({ s, done, onClose }: { s: StudyIndex; done: { run: FocusRun; ms: number }; onClose: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const rate = useRateWithUndo()
  const { create } = useSessionMutations()
  const topic: Topic | undefined = done.run.topicId ? s.topicById.get(done.run.topicId) : undefined
  const course = topic ? s.courseById.get(topic.courseId) : undefined
  const [rating, setRating] = useState<Confidence | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [sessionSaved, setSessionSaved] = useState(false)
  const minutes = Math.max(1, Math.round(done.ms / 60_000))

  const save = async () => {
    setBusy(true)
    try {
      // Save the session once; a retry after a failed rating must not log it twice.
      if (!sessionSaved) {
        await create({
          topicId: topic?.id ?? null,
          courseId: topic?.courseId ?? done.run.courseId,
          startedAt: new Date(done.run.startedAt).toISOString(),
          minutes,
          note: note.trim() || null,
        })
        setSessionSaved(true)
      }
      if (topic && rating) {
        const ok = await rate(topic, rating, 'focus')
        if (!ok) return
      } else toast.show({ message: `Logged ${minutes} min` })
      focus.clear()
      onClose()
      navigate(topic ? `/app/topics/${topic.id}` : '/app')
    } catch (err) {
      toast.error(err, 'Could not save the session. Your timer is still running.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <FocusFrame progress={1} hue={course?.color}>
      <div className="checkin">
        <p className="t-eyebrow">Session done</p>
        <h1 className="checkin__title t-display">
          <span className="tabular">{minutes}</span> minutes{topic ? (
            <>
              {' '}
              on <em>{topic.title}</em>.
            </>
          ) : (
            ' of focus.'
          )}
        </h1>
        {topic ? (
          <>
            <p className="checkin__ask">How sure do you feel about it now?</p>
            <div className="checkin__choices" role="radiogroup" aria-label="Confidence">
              {RATABLE.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={rating === c} className="pass__choice" data-conf={c} onClick={() => setRating(c)}>
                  <ConfidenceGlyph value={c} size={26} />
                  <span className="pass__choice-label">{CONFIDENCE[c].label}</span>
                  <span className="pass__choice-hint">{CONFIDENCE[c].hint}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
        <label className="checkin__note">
          <span className="t-faint">One line for future you</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Got stuck on the TLB miss path; redo example 3" maxLength={240} />
        </label>
        <div className="checkin__actions">
          <Button
            variant="ghost"
            onClick={() => {
              focus.clear()
              onClose()
              navigate('/app')
            }}
          >
            Discard session
          </Button>
          <Button variant="secondary" icon="play" onClick={onClose}>
            Keep going
          </Button>
          <Button variant="primary" icon="check" loading={busy} onClick={save} disabled={!!topic && !rating}>
            Save session
          </Button>
        </div>
        {topic && !rating ? <p className="t-faint checkin__need">Pick how it felt to save. It decides when this topic comes back.</p> : null}
      </div>
    </FocusFrame>
  )
}

