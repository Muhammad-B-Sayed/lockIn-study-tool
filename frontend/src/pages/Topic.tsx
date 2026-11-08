import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTopicMutations } from '../lib/data'
import { diffDays, formatTime, nextDueDate, relativeDue, today } from '../lib/domain'
import { formatDate, localDate } from '../app/format'
import type { Topic as TopicT, TopicPatch } from '../lib/data/types'
import { useNow, useStudy, type StudyIndex } from '../app/useStudy'
import { startFocus, useRateWithUndo } from '../features/actions'
import { ConfidenceGlyph } from '../ui/confidence'
import { CONFIDENCE } from '../ui/confidenceMeta'
import { Icon } from '../ui/Icon'
import { Menu } from '../ui/Menu'
import { Button, EmptyState, IconButton, Input } from '../ui/primitives'
import { PickerField } from '../ui/PickerField'
import { CourseTag, DueTag, KindTag, RateControl } from '../ui/study'
import { useToast } from '../ui/toastContext'
import './topic.css'

export default function Topic() {
  const { id } = useParams()
  const { data } = useStudy()
  const now = useNow()
  if (!data) return <div className="page" aria-busy="true" />
  const topic = id ? data.topicById.get(id) : undefined
  if (!topic) {
    return (
      <div className="page">
        <EmptyState title="Topic not found" action={<Link to="/app/courses" className="btn btn--secondary btn--md">Back to courses</Link>}>
          It may have been deleted.
        </EmptyState>
      </div>
    )
  }
  return <TopicView key={topic.id} t={topic} s={data} now={now} />
}

function useSaver(t: TopicT) {
  const { update } = useTopicMutations()
  const toast = useToast()
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const save = async (patch: TopicPatch, quiet = false) => {
    setState('saving')
    try {
      await update(t.id, patch)
      setState('saved')
      if (!quiet) toast.show({ message: 'Saved' })
    } catch (err) {
      setState('idle')
      toast.error(err, 'Could not save. Your text is still here.')
      throw err
    }
  }
  return { save, state }
}

function TopicView({ t, s, now }: { t: TopicT; s: StudyIndex; now: Date }) {
  const navigate = useNavigate()
  const toast = useToast()
  const rate = useRateWithUndo()
  const { remove } = useTopicMutations()
  const { save, state } = useSaver(t)
  const course = s.courseById.get(t.courseId)
  const day = today(now)

  const [title, setTitle] = useState(t.title)
  const [details, setDetails] = useState(t.details ?? '')
  const [notes, setNotes] = useState(t.notes)
  const notesTimer = useRef<number | undefined>(undefined)

  // Notes autosave: 900 ms after typing stops, and on leave.
  const latestNotes = useRef(notes)
  const savedNotes = useRef(t.notes)
  const saveNotes = (v: string) =>
    save({ notes: v }, true).then(
      () => {
        savedNotes.current = v
      },
      () => {},
    )
  useEffect(() => {
    return () => {
      window.clearTimeout(notesTimer.current)
      if (latestNotes.current !== savedNotes.current) void saveNotes(latestNotes.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const onNotes = (v: string) => {
    setNotes(v)
    latestNotes.current = v
    window.clearTimeout(notesTimer.current)
    notesTimer.current = window.setTimeout(() => {
      void saveNotes(v)
    }, 900)
  }

  const history = useMemo(
    () => s.ws.reviews.filter((r) => r.topicId === t.id).sort((a, b) => b.at.localeCompare(a.at)),
    [s.ws.reviews, t.id],
  )
  const minutes = useMemo(() => s.ws.sessions.filter((x) => x.topicId === t.id).reduce((n, x) => n + x.minutes, 0), [s.ws.sessions, t.id])
  const linked = useMemo(
    () => s.ws.assessments.filter((a) => a.topicIds.includes(t.id)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [s.ws.assessments, t.id],
  )

  const dueNext = t.confidence === 'retired' ? null : nextDueDate(t, s.ws, now)
  const nextLabel = !dueNext ? null : dueNext <= day ? 'due for review now' : `back in review ${formatDate(dueNext, { weekday: 'short', month: 'short', day: 'numeric' })}`

  const topics = s.topicsByCourse.get(t.courseId) ?? []
  const idx = topics.findIndex((x) => x.id === t.id)
  const prev = topics[idx - 1]
  const next = topics[idx + 1]

  return (
    <div className="page topic" data-hue={course?.color}>
      <nav className="topic__crumbs" aria-label="Breadcrumb">
        <Link to={`/app/courses/${t.courseId}`} className="back-link">
          <Icon name="arrowLeft" size={15} /> {course?.name ?? "Course"}
        </Link>
        <span className="topic__pos t-faint tabular">
          Topic {idx + 1} of {topics.length}
        </span>
        <span className="topic__nav">
          <IconButton icon="chevronLeft" label="Previous topic" size="sm" disabled={!prev} onClick={() => prev && navigate(`/app/topics/${prev.id}`)} />
          <IconButton icon="chevronRight" label="Next topic" size="sm" disabled={!next} onClick={() => next && navigate(`/app/topics/${next.id}`)} />
        </span>
      </nav>

      <header className="topic__head">
        <div className="topic__titles">
          <CourseTag course={course} link />
          <h1 className="sr-only">{t.title}</h1>
          <textarea
            className="topic__title t-display"
            value={title}
            rows={1}
            aria-label="Topic title"
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
            onBlur={() => {
              const v = title.trim()
              if (!v) setTitle(t.title)
              else if (v !== t.title) void save({ title: v }).catch(() => setTitle(t.title))
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
          />
          <textarea
            className="topic__details"
            value={details}
            rows={1}
            placeholder="Add a one-line summary"
            aria-label="Summary"
            onChange={(e) => setDetails(e.target.value.replace(/\n/g, ' '))}
            onBlur={() => {
              const v = details.trim() || null
              if (v !== t.details) void save({ details: v }).catch(() => setDetails(t.details ?? ''))
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
          />
        </div>
        <div className="topic__actions">
          <Button variant="primary" icon="timer" onClick={() => startFocus(navigate, t)}>
            Lock in on this
          </Button>
          <Menu
            label="Topic options"
            trigger={(p) => <IconButton {...p} icon="more" label="More options" variant="secondary" />}
            items={[
              t.confidence === 'retired'
                ? { label: 'Put back in review', icon: 'review', onSelect: () => rate(t, 'unrated', 'topic') }
                : { label: 'Not on the exam', icon: 'archive', hint: 'hide from review', onSelect: () => rate(t, 'retired', 'topic') },
              'separator',
              {
                label: 'Delete topic',
                icon: 'trash',
                tone: 'danger',
                onSelect: async () => {
                  try {
                    await remove(t.id)
                    toast.show({ message: `Deleted ${t.title}` })
                    navigate(`/app/courses/${t.courseId}`)
                  } catch (err) {
                    toast.error(err)
                  }
                },
              },
            ]}
          />
        </div>
      </header>

      <div className="topic__grid">
        <div className="topic__main">
          <section className="panel notes" aria-labelledby="notes-h">
            <header className="panel__head">
              <h2 id="notes-h" className="panel__title">
                Notes
              </h2>
              <span className="notes__state tabular" aria-live="polite">
                {state === 'saving' ? 'Saving…' : notes !== t.notes ? 'Unsaved' : state === 'saved' ? 'Saved' : 'Saves as you type'}
              </span>
            </header>
            <textarea
              className="notes__area"
              value={notes}
              onChange={(e) => onNotes(e.target.value)}
              placeholder={'What is this topic about, in your own words?\n\nTry: the one-sentence version, a worked example, and what tripped you up.'}
              aria-label="Notes"
            />
          </section>

          <Resources t={t} />
        </div>

        <aside className="topic__side">
          <section className="panel conf-card" data-conf={t.confidence} aria-labelledby="conf-h">
            <h2 id="conf-h" className="t-eyebrow">
              How sure you feel
            </h2>
            <div className="conf-card__now">
              <ConfidenceGlyph value={t.confidence} size={40} />
              <div>
                <p className="conf-card__label t-display">{CONFIDENCE[t.confidence].label}</p>
                <p className="t-faint conf-card__when">
                  {t.lastReviewedAt ? `Last checked ${agoLabel(diffDays(day, localDate(t.lastReviewedAt)))}` : 'Not checked yet'}
                  {nextLabel ? <span className="conf-card__next"> · {nextLabel}</span> : null}
                </p>
              </div>
            </div>
            {t.confidence !== 'retired' ? (
              <>
                <p className="conf-card__ask">After studying, how did it feel?</p>
                <RateControl value={t.confidence} onRate={(c) => rate(t, c, 'topic')} />
              </>
            ) : (
              <p className="t-muted conf-card__ask">Marked not on the exam. It stays out of review and coverage.</p>
            )}
            {history.length ? (
              <ol className="history" aria-label="Rating history">
                {history.slice(0, 8).map((r) => (
                  <li key={r.id} className="history__item">
                    <ConfidenceGlyph value={r.rating} size={13} />
                    <span className="history__label">{CONFIDENCE[r.rating].label}</span>
                    <span className="history__src t-faint">{r.source === 'focus' ? 'after focus' : r.source === 'review' ? 'in review' : ''}</span>
                    <span className="history__date t-faint tabular">{formatDate(localDate(r.at), { month: 'short', day: 'numeric' })}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>

          <PlanCard t={t} save={save} />

          <section className="panel facts" aria-label="Details">
            <dl className="facts__list">
              <div>
                <dt>Focused time</dt>
                <dd className="t-mono">{minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : 'None yet'}</dd>
              </div>
              <div>
                <dt>Reviews</dt>
                <dd className="t-mono">{history.length}</dd>
              </div>
            </dl>
            {linked.length ? (
              <>
                <p className="t-eyebrow facts__h">On these deadlines</p>
                <ul className="facts__dues">
                  {linked.map((a) => {
                    const d = relativeDue(a.dueDate, now, a.done)
                    return (
                      <li key={a.id}>
                        <KindTag kind={a.kind} />
                        <span className="facts__due-title">{a.title}</span>
                        <DueTag label={d.label} tone={d.tone} />
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  )
}

function agoLabel(days: number) {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

function PlanCard({ t, save }: { t: TopicT; save: (p: TopicPatch, quiet?: boolean) => Promise<void> }) {
  const startTime = t.plannedStart
    ? (() => {
        const d = new Date(t.plannedStart)
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      })()
    : ''
  const todayKey = today(new Date())
  const past = !!t.plannedDate && t.plannedDate < todayKey
  const missed = past && (!t.lastReviewedAt || localDate(t.lastReviewedAt) < t.plannedDate!)
  const setDate = (date: string) => {
    if (!date) return save({ plannedDate: null, plannedStart: null, plannedMinutes: null }).catch(() => {})
    const patch: TopicPatch = { plannedDate: date }
    if (startTime) patch.plannedStart = new Date(`${date}T${startTime}:00`).toISOString()
    return save(patch).catch(() => {})
  }
  const setTime = (time: string) => {
    if (!t.plannedDate) return
    if (!time) return save({ plannedStart: null, plannedMinutes: null }).catch(() => {})
    return save({ plannedStart: new Date(`${t.plannedDate}T${time}:00`).toISOString(), plannedMinutes: t.plannedMinutes ?? 60 }).catch(() => {})
  }
  return (
    <section className="panel plan" aria-labelledby="plan-h">
      <h2 id="plan-h" className="t-eyebrow">
        Plan
      </h2>
      <div className="plan__row">
        <div className="plan__field">
          <span>{past ? 'Was planned for' : 'Study on'}</span>
          <PickerField
            type="date"
            icon="calendar"
            label="Study date"
            value={t.plannedDate ?? ''}
            display={t.plannedDate ? formatDate(t.plannedDate, { weekday: 'short', month: 'short', day: 'numeric' }) : ''}
            placeholder="Pick a day"
            onChange={(v) => void setDate(v)}
            onClear={() => void setDate('')}
          />
        </div>
        <div className="plan__field">
          <span>At</span>
          <PickerField
            type="time"
            icon="clock"
            label="Start time"
            value={startTime}
            display={startTime ? formatTime(startTime) : ''}
            placeholder="Any time"
            disabled={!t.plannedDate}
            onChange={(v) => void setTime(v)}
            onClear={() => void setTime('')}
          />
        </div>
      </div>
      {missed ? (
        <div className="plan__missed">
          <span>Missed. Nothing was logged since this date.</span>
          <Button size="sm" variant="quiet" onClick={() => void setDate(today(new Date()))}>
            Move to today
          </Button>
        </div>
      ) : null}
      {t.plannedStart ? (
        <div className="plan__len" role="group" aria-label="Block length">
          {[30, 45, 60, 90, 120].map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={(t.plannedMinutes ?? 60) === m} onClick={() => void save({ plannedMinutes: m }, true).catch(() => {})}>
              {m < 60 ? `${m}m` : `${m / 60}h`.replace('.5h', 'h 30m')}
            </button>
          ))}
        </div>
      ) : (
        <p className="plan__hint t-faint">Add a time to block it on your calendar. Plans can move; deadlines don’t.</p>
      )}
    </section>
  )
}

function Resources({ t }: { t: TopicT }) {
  const { update } = useTopicMutations()
  const toast = useToast()
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const list = t.resources.map(({ label, url }) => ({ label, url }))
  const add = async (e: FormEvent) => {
    e.preventDefault()
    let u = url.trim()
    if (!u) return
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`
    try {
      new URL(u)
    } catch {
      setError('That does not look like a link.')
      return
    }
    const name = label.trim() || new URL(u).hostname.replace(/^www\./, '')
    setError(null)
    setUrl('')
    setLabel('')
    try {
      await update(t.id, { resources: [...list, { label: name, url: u }] })
    } catch (err) {
      toast.error(err)
    }
  }
  const removeAt = async (i: number) => {
    try {
      await update(t.id, { resources: list.filter((_, n) => n !== i) })
    } catch (err) {
      toast.error(err)
    }
  }
  return (
    <section className="panel resources" aria-labelledby="res-h">
      <header className="panel__head">
        <div>
          <h2 id="res-h" className="panel__title">
            Materials
          </h2>
          <p className="panel__sub">Slides, readings, recordings, past exams. Anything with a link.</p>
        </div>
      </header>
      {t.resources.length ? (
        <ul className="res-list">
          {t.resources.map((r, i) => (
            <li key={r.id} className="res">
              <span className="res__icon" aria-hidden>
                <Icon name="link" size={15} />
              </span>
              <a href={r.url} target="_blank" rel="noreferrer" className="res__main">
                <span className="res__label">{r.label}</span>
                <span className="res__host t-mono">{safeHost(r.url)}</span>
              </a>
              <IconButton icon="close" label={`Remove ${r.label}`} size="sm" onClick={() => void removeAt(i)} />
            </li>
          ))}
        </ul>
      ) : null}
      <form className="res-add" onSubmit={add}>
        <label className="res-field">
          <span>Link</span>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" />
        </label>
        <label className="res-field">
          <span>Name, optional</span>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Lecture 6 slides" />
        </label>
        <Button type="submit" icon="plus" disabled={!url.trim()}>
          Add
        </Button>
      </form>
      {error ? <p className="field__error">{error}</p> : null}
    </section>
  )
}

function safeHost(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return u
  }
}
