import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { diffDays, today } from '../lib/domain'
import type { Assessment, Course, Topic } from '../lib/data/types'
import { formatDate } from '../app/format'
import { withoutCode } from '../app/titles'
import { startFocus } from './actions'
import { Button } from '../ui/primitives'
import { CoverageStrip, KindTag } from '../ui/study'
import './readiness.css'

const WEAKEST: Topic['confidence'][] = ['shaky', 'unrated', 'okay']

type Readiness = { a: Assessment; days: number; topics: Topic[]; solid: number; okay: number; open: number; weakest: Topic | undefined; linked: boolean }

function readiness(a: Assessment, courseTopics: Topic[], day: string): Readiness {
  const linked = a.topicIds.length > 0
  const ids = new Set(a.topicIds)
  // With no linked topics, the test covers everything scheduled up to its date.
  const topics = courseTopics.filter((t) => t.confidence !== 'retired' && (linked ? ids.has(t.id) : !t.plannedDate || t.plannedDate <= a.dueDate))
  const count = (c: Topic['confidence']) => topics.filter((t) => t.confidence === c).length
  const weakest = WEAKEST.map((c) => topics.find((t) => t.confidence === c)).find(Boolean)
  return { a, days: diffDays(a.dueDate, day), topics, solid: count('solid'), okay: count('okay'), open: count('shaky') + count('unrated'), weakest, linked }
}

/** Countdown to the next tests in a course, and how much of what they cover feels solid. */
export function ExamReadiness({ course, topics, assessments, now }: { course: Course; topics: Topic[]; assessments: Assessment[]; now: Date }) {
  const navigate = useNavigate()
  const day = today(now)
  const next = useMemo(
    () =>
      assessments
        .filter((a) => !a.done && (a.kind === 'exam' || a.kind === 'quiz') && a.dueDate >= day)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 2)
        .map((a) => readiness(a, topics, day))
        .filter((r) => r.topics.length > 0),
    [assessments, topics, day],
  )
  if (!next.length) return null

  return (
    <section className="panel ready" aria-label="Upcoming tests">
      <ul className="ready__list">
        {next.map((r) => {
          const perDay = r.open ? Math.ceil(r.open / Math.max(1, r.days)) : 0
          return (
            <li key={r.a.id} className="ready__item">
              <div className="ready__count" data-soon={r.days <= 3 || undefined}>
                <span className="ready__days t-display tabular">{r.days}</span>
                <span className="ready__unit">{r.days === 1 ? 'day left' : 'days left'}</span>
              </div>
              <div className="ready__body">
                <p className="ready__title">
                  <KindTag kind={r.a.kind} />
                  <span>{withoutCode(r.a.title, course.code)}</span>
                  <span className="t-faint ready__date">
                    {formatDate(r.a.dueDate, { weekday: 'short', month: 'short', day: 'numeric' })}
                    {r.a.weight != null ? ` · ${r.a.weight}% of grade` : ''}
                  </span>
                </p>
                <CoverageStrip topics={r.topics} size="sm" />
                <p className="ready__line">
                  <strong className="tabular">
                    {r.solid} of {r.topics.length}
                  </strong>{' '}
                  topics feel solid{r.okay ? `, ${r.okay} getting there` : ''}.{' '}
                  {r.open
                    ? r.days === 0
                      ? `${r.open} still shaky or not rated, and it is today.`
                      : `${r.open} still shaky or not rated. That is about ${perDay} a day to cover them in time.`
                    : 'Nothing shaky or unrated left.'}
                  {r.linked ? '' : ' Link topics to this deadline to count only what it covers.'}
                </p>
              </div>
              <div className="ready__actions">
                {r.weakest ? (
                  <Button size="sm" variant="secondary" icon="timer" onClick={() => startFocus(navigate, r.weakest ?? null)} title={`Start a focus session on ${r.weakest.title}`}>
                    Lock in on weakest
                  </Button>
                ) : null}
                <Link className="panel__link" to={`/app/review?courses=${course.id}`}>
                  Review {course.code}
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
