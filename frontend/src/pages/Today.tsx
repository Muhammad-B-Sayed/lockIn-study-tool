import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { coverage, currentStreak, relativeDue, diffDays, formatTime, rankReview, studyMinutesByDay, today } from '../lib/domain'
import { formatDate, localDate } from '../app/format'
import type { Assessment, CalendarEvent, Topic } from '../lib/data/types'
import { useNow, useStudy, type StudyIndex } from '../app/useStudy'
import { DeadlineRow, ReviewRow } from '../features/rows'
import { startFocus, useRateWithUndo, useToggleDone } from '../features/actions'
import { Icon } from '../ui/Icon'
import { Button, EmptyState } from '../ui/primitives'
import { CourseTag, CoverageStrip } from '../ui/study'
import { ConfidenceGlyph } from '../ui/confidence'
import { ConfidenceKey } from '../ui/ConfidenceKey'
import { withoutCode } from '../app/titles'
import './today.css'

export default function Today() {
  const { data } = useStudy()
  const now = useNow()
  if (!data) return <TodaySkeleton />
  return <TodayView s={data} now={now} />
}

function TodayView({ s, now }: { s: StudyIndex; now: Date }) {
  const navigate = useNavigate()
  const rate = useRateWithUndo()
  const toggle = useToggleDone()
  const todayKey = today(now)

  const ranked = useMemo(() => rankReview(s.ws, now), [s.ws, now])
  const upcoming = useMemo(() => {
    return s.ws.assessments
      .filter((a) => !a.done && diffDays(a.dueDate, todayKey) <= 7)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99'))
  }, [s.ws.assessments, todayKey])
  const overdue = upcoming.filter((a) => a.dueDate < todayKey)
  const dueSoon = upcoming.filter((a) => a.dueDate >= todayKey)
  const recentlyDone = useMemo(
    () =>
      s.ws.assessments
        .filter((a) => a.done && a.doneAt && diffDays(todayKey, localDate(a.doneAt)) <= 1)
        .slice(0, 3),
    [s.ws.assessments, todayKey],
  )

  const agenda = useMemo(() => buildAgenda(s, todayKey), [s, todayKey])
  const brief = useMemo(() => writeBrief(s, now, ranked.length), [s, now, ranked.length])
  const next = ranked[0]?.topic ?? null

  const hour = now.getHours()
  const greeting = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="page today">
      <header className="today__head">
        <p className="t-eyebrow today__date">
          {formatDate(todayKey, { weekday: 'long' })} · {formatDate(todayKey, { month: 'long', day: 'numeric' })}
        </p>
        <h1 className="today__title t-display">
          {greeting}, <em>{s.ws.user.username}</em>.
        </h1>
        <p className="today__brief">{brief}</p>
        <div className="today__cta">
          <Button variant="primary" size="lg" icon="timer" className="today__lock" onClick={() => startFocus(navigate, next)}>
            {next ? `Lock in on ${next.title}` : 'Start a focus session'}
          </Button>
          {next ? (
            <Link to={`/app/topics/${next.id}`} className="today__cta-on">
              Open topic
            </Link>
          ) : null}
        </div>
        {overdue.length ? (
          <div className="overdue" role="status">
            <Icon name="flag" size={16} />
            <span className="overdue__text">
              <strong>{overdue.length === 1 ? withoutCode(overdue[0].title, s.courseById.get(overdue[0].courseId ?? '')?.code) : `${overdue.length} deadlines`}</strong>{' '}
              {overdue.length === 1 ? `(${s.courseById.get(overdue[0].courseId ?? '')?.code ?? 'no course'}) is ${relativeDue(overdue[0].dueDate, now).label.toLowerCase()}.` : 'are past due.'}
            </span>
            {overdue.length === 1 ? (
              <Button size="sm" variant="secondary" icon="check" onClick={() => toggle(overdue[0])}>
                Mark done
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="today__grid">
        <div className="today__col">
          <section className="panel today__review" aria-labelledby="review-h">
            <header className="panel__head">
              <div>
                <h2 id="review-h" className="panel__title">
                  Review next
                </h2>
                <p className="panel__sub">Weakest and most overdue first. Rate after each pass.</p>
              </div>
              {ranked.length > 3 ? (
                <Link to="/app/review" className="panel__link">
                  All {ranked.length} <Icon name="arrowRight" size={14} />
                </Link>
              ) : null}
            </header>
            {ranked.length ? (
              <ol className="review-list">
                {ranked.slice(0, 5).map((r, i) => (
                  <ReviewRow
                    key={r.topic.id}
                    index={i}
                    topic={r.topic}
                    course={s.courseById.get(r.topic.courseId)}
                    reasons={r.reasons}
                    onRate={(c) => rate(r.topic, c)}
                  />
                ))}
              </ol>
            ) : (
              <EmptyState title="All caught up" art={<ConfidenceGlyph value="solid" size={28} />}>
                Nothing needs review right now. Topics come back here as they get older or an exam gets close.
              </EmptyState>
            )}
          </section>

          <section className="panel" aria-labelledby="agenda-h">
            <header className="panel__head">
              <div>
                <h2 id="agenda-h" className="panel__title">
                  On today
                </h2>
                <p className="panel__sub">Planned topics, time blocks and your own events.</p>
              </div>
              <Link to="/app/calendar" className="panel__link">
                Calendar <Icon name="arrowRight" size={14} />
              </Link>
            </header>
            {agenda.length ? (
              <ol className="agenda">
                {agenda.map((item) => (
                  <AgendaItem key={item.key} item={item} s={s} />
                ))}
              </ol>
            ) : (
              <p className="panel__empty">
                Nothing planned for today. <Link to="/app/calendar">Plan a topic</Link> or use the time on review.
              </p>
            )}
          </section>

          <StudyRhythm s={s} now={now} />
        </div>

        <div className="today__col today__col--side">
          <section className="panel today__due" aria-labelledby="due-h">
            <header className="panel__head">
              <div>
                <h2 id="due-h" className="panel__title">
                  Deadlines
                </h2>
              </div>
              <span className="panel__count tabular">
                {[overdue.length ? `${overdue.length} overdue` : null, `${dueSoon.length} upcoming`].filter(Boolean).join(' · ')}
              </span>
            </header>
            {upcoming.length || recentlyDone.length ? (
              <ul className="deadline-list">
                {overdue.length ? <li className="deadline-group t-eyebrow">Overdue</li> : null}
                {overdue.map((a) => (
                  <DeadlineRow key={a.id} a={a} now={now} course={a.courseId ? s.courseById.get(a.courseId) : undefined} onToggle={() => toggle(a)} />
                ))}
                {overdue.length && dueSoon.length ? <li className="deadline-group t-eyebrow">Next 7 days</li> : null}
                {dueSoon.map((a) => (
                  <DeadlineRow key={a.id} a={a} now={now} course={a.courseId ? s.courseById.get(a.courseId) : undefined} onToggle={() => toggle(a)} />
                ))}
                {recentlyDone.map((a) => (
                  <DeadlineRow key={a.id} a={a} now={now} course={a.courseId ? s.courseById.get(a.courseId) : undefined} onToggle={() => toggle(a)} />
                ))}
              </ul>
            ) : (
              <p className="panel__empty">Nothing due in the next seven days.</p>
            )}
          </section>

          <section className="panel" aria-labelledby="term-h">
            <header className="panel__head">
              <div>
                <h2 id="term-h" className="panel__title">
                  This term
                </h2>
                <p className="panel__sub">Each cell is a topic, filled by how sure you feel.</p>
              </div>
            </header>
            <ul className="term-list">
              {s.activeCourses.map((c) => {
                const topics = s.topicsByCourse.get(c.id) ?? []
                const cov = coverage(topics)
                return (
                  <li key={c.id}>
                    <Link to={`/app/courses/${c.id}`} className="term-row">
                      <span className="term-row__head">
                        <CourseTag course={c} size="sm" />
                        <span className="term-row__pct tabular">
                          {cov.counts.solid}/{cov.eligible} solid
                        </span>
                      </span>
                      <CoverageStrip topics={topics} size="sm" />
                    </Link>
                  </li>
                )
              })}
            </ul>
            <ConfidenceKey withRetired={s.ws.topics.some((t) => t.confidence === 'retired')} />
          </section>

        </div>
      </div>
    </div>
  )
}

function StudyRhythm({ s, now }: { s: StudyIndex; now: Date }) {
  const days = useMemo(() => studyMinutesByDay(s.ws.sessions, now, 21), [s.ws.sessions, now])
  const streak = useMemo(() => currentStreak(s.ws.sessions, now), [s.ws.sessions, now])
  const week = days.slice(-7).reduce((n, d) => n + d.minutes, 0)
  const max = Math.max(60, ...days.map((d) => d.minutes))
  return (
    <section className="panel" aria-labelledby="rhythm-h">
      <header className="panel__head">
        <div>
          <h2 id="rhythm-h" className="panel__title">
            Rhythm
          </h2>
        </div>
      </header>
      <div className="rhythm__stats">
        <div>
          <p className="rhythm__num t-display tabular">
            {Math.floor(week / 60)}
            <small>h</small> {week % 60}
            <small>m</small>
          </p>
          <p className="t-faint rhythm__label">focused, last 7 days</p>
        </div>
        <div>
          <p className="rhythm__num t-display tabular">
            {streak}
            <small>{streak === 1 ? ' day' : ' days'}</small>
          </p>
          <p className="t-faint rhythm__label">in a row</p>
        </div>
      </div>
      <div className="rhythm__chart">
      <span className="rhythm__max tabular" aria-hidden>
        {max} min
      </span>
      <div className="rhythm__bars" role="img" aria-label={`Study minutes per day for the last 21 days. ${week} minutes in the last 7.`}>
        {days.map((d) => (
          <span
            key={d.date}
            className="rhythm__bar"
            data-today={d.date === today(now) || undefined}
            style={{ ['--h' as string]: `${Math.max(d.minutes ? 8 : 3, (d.minutes / max) * 100)}%` }}
            title={`${formatDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}: ${d.minutes} min`}
          />
        ))}
      </div>
      </div>
      <div className="rhythm__axis tabular" aria-hidden>
        {[0, 7, 14].map((i) => (
          <span key={i} style={{ ['--x' as string]: `${(i / 21) * 100}%` }}>
            {formatDate(days[i]?.date ?? today(now), { month: 'short', day: 'numeric' })}
          </span>
        ))}
        <span style={{ ['--x' as string]: '100%' }}>Today</span>
      </div>
    </section>
  )
}

// ---------- agenda ----------

type AgendaEntry =
  | { key: string; type: 'block'; time: string | null; minutes: number; topic: Topic }
  | { key: string; type: 'topic'; time: null; topic: Topic }
  | { key: string; type: 'event'; time: string | null; event: CalendarEvent }
  | { key: string; type: 'due'; time: string | null; a: Assessment }

function buildAgenda(s: StudyIndex, day: string): AgendaEntry[] {
  const out: AgendaEntry[] = []
  for (const t of s.ws.topics) {
    if (t.plannedDate !== day || t.confidence === 'retired') continue
    if (t.plannedStart) {
      const d = new Date(t.plannedStart)
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      out.push({ key: `b-${t.id}`, type: 'block', time, minutes: t.plannedMinutes ?? 60, topic: t })
    } else out.push({ key: `t-${t.id}`, type: 'topic', time: null, topic: t })
  }
  for (const e of s.ws.events) if (e.date === day) out.push({ key: `e-${e.id}`, type: 'event', time: e.startTime, event: e })
  for (const a of s.ws.assessments) if (a.dueDate === day && !a.done) out.push({ key: `d-${a.id}`, type: 'due', time: a.dueTime, a })
  return out.sort((x, y) => (x.time ?? '').localeCompare(y.time ?? ''))
}

function AgendaItem({ item, s }: { item: AgendaEntry; s: StudyIndex }) {
  const time = item.time ? formatTime(item.time) : 'Any time'
  if (item.type === 'event') {
    return (
      <li className="agenda__item" data-hue={item.event.color}>
        <span className="agenda__time tabular">{time}</span>
        <span className="agenda__bar" aria-hidden />
        <div className="agenda__body">
          <span className="agenda__title">{item.event.title}</span>
          <span className="agenda__meta">
            {item.event.endTime && item.event.startTime ? `${formatTime(item.event.startTime)} to ${formatTime(item.event.endTime)}` : 'Personal'}
          </span>
        </div>
      </li>
    )
  }
  if (item.type === 'due') {
    const c = item.a.courseId ? s.courseById.get(item.a.courseId) : undefined
    return (
      <li className="agenda__item agenda__item--due" data-hue={c?.color ?? 'slate'}>
        <span className="agenda__time tabular">{item.time ? formatTime(item.time) : 'Due'}</span>
        <span className="agenda__bar" aria-hidden />
        <div className="agenda__body">
          <span className="agenda__title">
            <Icon name="flag" size={14} /> {item.a.title}
          </span>
          <span className="agenda__meta">
            <CourseTag course={c} size="sm" /> due today
          </span>
        </div>
      </li>
    )
  }
  const c = s.courseById.get(item.topic.courseId)
  return (
    <li className="agenda__item" data-hue={c?.color ?? 'slate'}>
      <span className="agenda__time tabular">{time}</span>
      <span className="agenda__bar" aria-hidden />
      <div className="agenda__body">
        <Link to={`/app/topics/${item.topic.id}`} className="agenda__title">
          <ConfidenceGlyph value={item.topic.confidence} /> {item.topic.title}
        </Link>
        <span className="agenda__meta">
          <CourseTag course={c} size="sm" />
          {item.type === 'block' ? `${item.minutes} min block` : 'Planned for today'}
        </span>
      </div>
    </li>
  )
}

// ---------- the brief ----------

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

function inDays(n: number) {
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  return `in ${n} days`
}

/** One or two plain sentences about what matters most today. */
function writeBrief(s: StudyIndex, now: Date, queue: number): string {
  const day = today(now)
  const shakyFor = (a: Assessment) => {
    const topics = (a.topicIds.length ? a.topicIds.map((id) => s.topicById.get(id)).filter(Boolean) : s.topicsByCourse.get(a.courseId ?? '') ?? []) as Topic[]
    return topics.filter((t) => t.confidence === 'shaky' || (t.confidence === 'unrated' && t.plannedDate && t.plannedDate <= day)).length
  }
  const soon = s.ws.assessments
    .filter((a) => !a.done && (a.kind === 'exam' || a.kind === 'quiz') && diffDays(a.dueDate, day) >= 0 && diffDays(a.dueDate, day) <= 14)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  // Lead with the nearest test that still has shaky material; otherwise the nearest test.
  const exam = soon.find((a) => shakyFor(a) > 0) ?? soon[0]

  const parts: string[] = []
  if (exam) {
    const n = diffDays(exam.dueDate, day)
    const shaky = shakyFor(exam)
    parts.push(`${exam.title} is ${inDays(n)}.`)
    if (shaky) parts.push(`${plural(shaky, 'topic')} it covers still ${shaky === 1 ? 'feels' : 'feel'} shaky, so start there.`)
    else parts.push('Everything it covers feels at least okay, so a light review will do.')
  } else if (queue) {
    parts.push(`${plural(queue, 'topic is', 'topics are')} ready for review.`)
  }
  if (!parts.length) parts.push('Nothing pressing today. A good day to get ahead on next week’s topics.')
  return parts.join(' ')
}

function TodaySkeleton() {
  return (
    <div className="page today" aria-busy="true">
      <span className="skeleton" style={{ height: 12, width: 160, marginBottom: 18 }} />
      <span className="skeleton" style={{ height: 52, width: '60%', marginBottom: 16 }} />
      <span className="skeleton" style={{ height: 20, width: '45%', marginBottom: 40 }} />
      <div className="today__grid">
        <span className="skeleton" style={{ height: 360, borderRadius: 18 }} />
        <span className="skeleton" style={{ height: 360, borderRadius: 18 }} />
      </div>
    </div>
  )
}
