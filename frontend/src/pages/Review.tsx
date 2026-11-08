import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { coverage, rankReview, today, diffDays } from '../lib/domain'
import { formatDate, localDate } from '../app/format'
import type { Confidence, Topic } from '../lib/data/types'
import { useNow, useStudy, type StudyIndex } from '../app/useStudy'
import { ReviewRow } from '../features/rows'
import { useRateWithUndo } from '../features/actions'
import { ConfidenceGlyph } from '../ui/confidence'
import { CONFIDENCE, RATABLE } from '../ui/confidenceMeta'
import { Icon } from '../ui/Icon'
import { Button, EmptyState, Kbd, Segmented, Select } from '../ui/primitives'
import { CourseTag } from '../ui/study'
import { useIsPhone } from '../app/useMedia'
import { ignoreShortcut } from '../app/keys'
import { RatePicker } from '../ui/RatePicker'
import './review.css'

type View = 'queue' | 'groups'

export default function Review() {
  const { data } = useStudy()
  const now = useNow()
  if (!data) return <div className="page" aria-busy="true" />
  return <ReviewView s={data} now={now} />
}

function ReviewView({ s, now }: { s: StudyIndex; now: Date }) {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'groups' ? 'groups' : 'queue'
  const selected = useMemo(() => new Set((params.get('courses') ?? '').split(',').filter(Boolean)), [params])
  const [pass, setPass] = useState<string[] | null>(null)
  const rate = useRateWithUndo()
  const phone = useIsPhone()

  const setView = (v: View) => {
    const p = new URLSearchParams(params)
    if (v === 'queue') p.delete('view')
    else p.set('view', v)
    setParams(p, { replace: true })
  }
  const toggleCourse = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    const p = new URLSearchParams(params)
    if (next.size) p.set('courses', [...next].join(','))
    else p.delete('courses')
    setParams(p, { replace: true })
  }

  const inScope = (courseId: string) => selected.size === 0 || selected.has(courseId)
  const ranked = useMemo(() => rankReview(s.ws, now).filter((r) => inScope(r.topic.courseId)), [s.ws, now, selected]) // eslint-disable-line react-hooks/exhaustive-deps
  const scopedTopics = useMemo(
    () => s.ws.topics.filter((t) => inScope(t.courseId) && s.courseById.get(t.courseId)?.status === 'active'),
    [s.ws.topics, s.courseById, selected], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const cov = coverage(scopedTopics)

  if (pass) {
    return <ReviewPass ids={pass} s={s} now={now} onExit={() => setPass(null)} />
  }

  return (
    <div className="page review">
      <header className="page-head">
        <div>
          <p className="t-eyebrow page-head__eyebrow">Review</p>
          <h1 className="page-head__title t-display">
            {view === 'groups' ? (
              <>
                Where your <span className="tabular">{cov.eligible}</span> topics stand
              </>
            ) : ranked.length ? (
              <>
                <span className="tabular">{ranked.length}</span> {ranked.length === 1 ? 'topic wants' : 'topics want'} another look
              </>
            ) : (
              'Nothing to review'
            )}
          </h1>
          <p className="page-head__sub">
            {view === 'groups'
              ? `Grouped by how sure you feel. ${ranked.length} are due for review now.${cov.counts.retired ? ` ${cov.counts.retired} marked not on exam are set aside.` : ''}`
              : 'Shaky topics return after a day, ones getting there after three, solid ones after a week. A close exam pulls its topics forward.'}
          </p>
        </div>
        <div className="page-head__actions">
          <Button variant="primary" icon="play" disabled={!ranked.length} onClick={() => setPass(ranked.map((r) => r.topic.id))}>
            Start a review pass
          </Button>
        </div>
      </header>

      <div className="review__bar">
        <Segmented<View>
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'queue', label: 'Queue', icon: 'list' },
            { value: 'groups', label: 'By confidence', icon: 'grid' },
          ]}
        />
        <label className="review__course-select">
          <span className="sr-only">Course</span>
          <Select
            value={selected.size === 1 ? [...selected][0] : ''}
            onChange={(e) => {
              const p = new URLSearchParams(params)
              if (e.target.value) p.set('courses', e.target.value)
              else p.delete('courses')
              setParams(p, { replace: true })
            }}
          >
            <option value="">All courses</option>
            {s.activeCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </Select>
        </label>
        <div className="chip-row review__chips" role="group" aria-label="Filter by course">
          <button
            type="button"
            className="chip"
            aria-pressed={selected.size === 0}
            onClick={() => setParams(new URLSearchParams(view === 'groups' ? 'view=groups' : ''), { replace: true })}
          >
            All courses
          </button>
          {s.activeCourses.map((c) => (
            <button key={c.id} type="button" className="chip" data-hue={c.color} aria-pressed={selected.has(c.id)} onClick={() => toggleCourse(c.id)}>
              <span className="chip__dot" aria-hidden />
              <span className="t-mono">{c.code}</span>
            </button>
          ))}

        </div>
      </div>

      <details className="term-progress" open={!phone}>
        <summary className="term-progress__summary">
          Term progress <span className="t-faint">· {cov.counts.solid} of {cov.eligible} solid</span>
          <Icon name="chevronDown" size={14} />
        </summary>
        <CoverageMeter counts={cov.counts} eligible={cov.eligible} scope={selected.size ? 'in the selected courses' : 'this term'} />
      </details>

      {view === 'queue' ? (
        <section className="panel" aria-label="Review queue">
          {ranked.length ? (
            <ol className="review-list">
              {ranked.map((r, i) => (
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
            <EmptyState title="You’re caught up" art={<ConfidenceGlyph value="solid" size={30} />}>
              Topics come back here as time passes or an exam gets close. Topics planned for later stay out until their date.
            </EmptyState>
          )}
        </section>
      ) : (
        <Groups topics={scopedTopics} s={s} now={now} />
      )}
    </div>
  )
}

function CoverageMeter({ counts, eligible, scope }: { counts: Record<Confidence, number>; eligible: number; scope: string }) {
  const order: Confidence[] = ['solid', 'okay', 'shaky', 'unrated']
  return (
    <div className="meter">
      <p className="meter__caption t-eyebrow">
        {eligible} topics {scope}
        {counts.retired ? `, plus ${counts.retired} set aside` : ''}
      </p>
      <div className="meter__bar" role="img" aria-label={order.map((c) => `${counts[c]} ${CONFIDENCE[c].label}`).join(', ')}>
        {order.map((c) =>
          counts[c] ? <span key={c} className="meter__seg" data-conf={c} style={{ flexGrow: counts[c] }} /> : null,
        )}
      </div>
      <ul className="meter__legend">
        {order.map((c) => (
          <li key={c} data-conf={c}>
            <ConfidenceGlyph value={c} size={13} />
            <span>{CONFIDENCE[c].label}</span>
            <span className="tabular meter__n">{counts[c]}</span>
            <span className="tabular t-faint">{eligible ? Math.round((counts[c] / eligible) * 100) : 0}%</span>
          </li>
        ))}
        {counts.retired ? (
          <li data-conf="retired">
            <ConfidenceGlyph value="retired" size={13} />
            <span>Not on exam</span>
            <span className="tabular meter__n">{counts.retired}</span>
          </li>
        ) : null}
      </ul>
    </div>
  )
}

function Groups({ topics, s, now }: { topics: Topic[]; s: StudyIndex; now: Date }) {
  const rate = useRateWithUndo()
  const phone = useIsPhone()
  const [expanded, setExpanded] = useState<Set<Confidence>>(new Set())
  const order: Confidence[] = ['shaky', 'okay', 'solid', 'unrated', 'retired']
  const day = today(now)
  const renderGroup = (c: Confidence) => {
        const list = topics
          .filter((t) => t.confidence === c)
          .sort((a, b) => (a.lastReviewedAt ?? '').localeCompare(b.lastReviewedAt ?? ''))
        if (!list.length && (c === 'retired' || c === 'unrated')) return null
        return (
          <details key={c} className="group" data-conf={c} open={!phone}>
            <summary className="group__head">
              <ConfidenceGlyph value={c} size={16} />
              <h2 className="group__title">{CONFIDENCE[c].label}</h2>
              <span className="t-faint tabular">{list.length}</span>
              <Icon name="chevronDown" size={15} className="group__chev" />
            </summary>
            <ul className="group__list">
              {(expanded.has(c) ? list : list.slice(0, 6)).map((t) => (
                <li key={t.id} className="group__item">
                  <div className="group__main">
                    <Link to={`/app/topics/${t.id}`} className="group__name">
                      {t.title}
                    </Link>
                    <span className="group__meta">
                      <CourseTag course={s.courseById.get(t.courseId)} size="sm" />
                      <span className="t-faint">
                        {t.lastReviewedAt
                          ? `Reviewed ${ago(diffDays(day, localDate(t.lastReviewedAt)))}`
                          : t.plannedDate
                            ? `Planned ${formatDate(t.plannedDate, { month: 'short', day: 'numeric' })}`
                            : 'Never reviewed'}
                      </span>
                    </span>
                  </div>
                  <RatePicker value={t.confidence} onRate={(r) => rate(t, r)} title={t.title} />
                </li>
              ))}
              {!list.length ? <li className="group__none">None</li> : null}
              {list.length > 6 ? (
                <li>
                  <button
                    type="button"
                    className="group__more"
                    aria-expanded={expanded.has(c)}
                    onClick={() =>
                      setExpanded((e) => {
                        const n = new Set(e)
                        if (n.has(c)) n.delete(c)
                        else n.add(c)
                        return n
                      })
                    }
                  >
                    {expanded.has(c) ? 'Show fewer' : `Show ${list.length - 6} more`}
                  </button>
                </li>
              ) : null}
            </ul>
          </details>
        )
  }
  return (
    <>
      <div className="groups">{order.filter((c) => c !== 'retired').map(renderGroup)}</div>
      {renderGroup('retired')}
    </>
  )
}

function ago(days: number) {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  return `${Math.round(days / 7)} weeks ago`
}

// ---------- review pass: one topic at a time ----------

function ReviewPass({ ids, s, now, onExit }: { ids: string[]; s: StudyIndex; now: Date; onExit: () => void }) {
  const [i, setI] = useState(0)
  const [results, setResults] = useState<Record<string, Confidence>>({})
  const [showNotes, setShowNotes] = useState(false)
  const rate = useRateWithUndo()
  const topic = ids[i] ? s.topicById.get(ids[i]) : undefined
  const done = i >= ids.length
  const day = today(now)

  useEffect(() => {
    document.documentElement.dataset.immersive = 'true'
    return () => {
      delete document.documentElement.dataset.immersive
    }
  }, [])

  const next = () => {
    setShowNotes(false)
    setI((n) => n + 1)
  }
  const [saving, setSaving] = useState(false)
  const pick = async (c: Confidence) => {
    if (!topic || saving) return
    setSaving(true)
    const ok = await rate(topic, c, 'review')
    setSaving(false)
    if (!ok) return
    setResults((r) => ({ ...r, [topic.id]: c }))
    next()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target as HTMLElement).closest?.('dialog')) return onExit()
      if (ignoreShortcut(e, { allowOnButtons: e.key !== ' ' })) return
      if (done) return
      if (e.key === '1') void pick('shaky')
      if (e.key === '2') void pick('okay')
      if (e.key === '3') void pick('solid')
      if (e.key.toLowerCase() === 's') next()
      if (e.key === ' ') {
        e.preventDefault()
        setShowNotes((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (done || !topic) {
    const counts = RATABLE.map((c) => [c, Object.values(results).filter((r) => r === c).length] as const)
    return (
      <div className="page pass">
        <div className="pass__done">
          <p className="t-eyebrow">Pass complete</p>
          <h1 className="t-display pass__done-title">
            {Object.keys(results).length} {Object.keys(results).length === 1 ? 'topic' : 'topics'} checked.
          </h1>
          <ul className="pass__tally">
            {counts.map(([c, n]) => (
              <li key={c} data-conf={c}>
                <ConfidenceGlyph value={c} size={22} />
                <span className="t-display tabular">{n}</span>
                <span className="t-faint">{CONFIDENCE[c].label}</span>
              </li>
            ))}
          </ul>
          <p className="t-muted">Shaky topics come back tomorrow. Solid ones rest for a week.</p>
          <Button variant="primary" onClick={onExit}>
            Back to review
          </Button>
        </div>
      </div>
    )
  }

  const course = s.courseById.get(topic.courseId)
  return (
    <div className="page pass">
      <div className="pass__top">
        <button type="button" className="back-link" onClick={onExit}>
          <Icon name="close" size={15} /> End pass
        </button>
        <div className="pass__progress" role="progressbar" aria-valuemin={0} aria-valuemax={ids.length} aria-valuenow={i} aria-label="Pass progress">
          {ids.map((id, n) => (
            <span key={id} className="pass__tick" data-state={n < i ? 'done' : n === i ? 'now' : 'todo'} data-conf={results[id]} />
          ))}
        </div>
        <span className="t-faint tabular">
          {i + 1} / {ids.length}
        </span>
      </div>

      <article className="pass__card" key={topic.id} data-hue={course?.color}>
        <div className="pass__meta">
          <CourseTag course={course} />
          <span className="conf-label" data-conf={topic.confidence}>
            <ConfidenceGlyph value={topic.confidence} /> {CONFIDENCE[topic.confidence].label} now
          </span>
          <span className="t-faint pass__last">
            {topic.lastReviewedAt ? `Last reviewed ${ago(diffDays(day, localDate(topic.lastReviewedAt)))}` : 'Never reviewed'}
          </span>
        </div>
        <h1 className="pass__title t-display">{topic.title}</h1>
        {topic.details ? <p className="pass__details">{topic.details}</p> : null}

        <div className="pass__prompt">
          <p>Before you peek: explain it out loud, or sketch it on paper. Then check your notes.</p>
          {topic.notes || topic.resources.length ? (
            <Button variant="ghost" size="sm" icon={showNotes ? 'chevronDown' : 'chevronRight'} onClick={() => setShowNotes((v) => !v)}>
              {showNotes ? 'Hide notes' : 'Show notes'} <Kbd>space</Kbd>
            </Button>
          ) : null}
        </div>
        {showNotes ? (
          <div className="pass__notes">
            {topic.notes ? <p className="pass__notes-text">{topic.notes}</p> : null}
            {topic.resources.length ? (
              <ul className="pass__links">
                {topic.resources.map((r) => (
                  <li key={r.id}>
                    <a href={r.url} target="_blank" rel="noreferrer">
                      <Icon name="external" size={14} /> {r.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <footer className="pass__rate">
          <p className="pass__ask">How did that go?</p>
          <div className="pass__choices">
            {RATABLE.map((c, n) => (
              <button key={c} type="button" className="pass__choice" data-conf={c} onClick={() => void pick(c)}>
                <ConfidenceGlyph value={c} size={26} />
                <span className="pass__choice-label">{CONFIDENCE[c].label}</span>
                <span className="pass__choice-hint">{CONFIDENCE[c].hint}</span>
                <Kbd>{n + 1}</Kbd>
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={next}>
            Skip for now <Kbd>S</Kbd>
          </Button>
        </footer>
      </article>
    </div>
  )
}
