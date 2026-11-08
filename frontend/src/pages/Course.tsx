import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCourseMutations, useTopicMutations } from '../lib/data'
import { coverage, diffDays, rankReview, today } from '../lib/domain'
import { formatDate, localDate } from '../app/format'
import type { Assessment, Course as CourseT, Topic } from '../lib/data/types'
import { useNow, useStudy, type StudyIndex } from '../app/useStudy'
import { AssessmentDialog, CourseDialog, SyllabusDialog } from '../features/forms'
import { DeadlineRow, ReviewRow } from '../features/rows'
import { startFocus, useRateWithUndo, useToggleDone } from '../features/actions'
import { Icon } from '../ui/Icon'
import { Menu } from '../ui/Menu'
import { Button, Dialog, EmptyState, IconButton, Input } from '../ui/primitives'
import { CoverageStrip } from '../ui/study'
import { RatePicker } from '../ui/RatePicker'
import { useToast } from '../ui/toastContext'
import { ConfidenceKey } from '../ui/ConfidenceKey'
import './course.css'

export default function Course() {
  const { id } = useParams()
  const { data } = useStudy()
  const now = useNow()
  if (!data) return <div className="page" aria-busy="true" />
  const course = id ? data.courseById.get(id) : undefined
  if (!course) {
    return (
      <div className="page">
        <EmptyState title="Course not found" action={<Link to="/app/courses" className="btn btn--secondary btn--md">Back to courses</Link>}>
          It may have been deleted.
        </EmptyState>
      </div>
    )
  }
  return <CourseView key={course.id} c={course} s={data} now={now} />
}

function CourseView({ c, s, now }: { c: CourseT; s: StudyIndex; now: Date }) {
  const navigate = useNavigate()
  const toast = useToast()
  const courseM = useCourseMutations()
  const topicsM = useTopicMutations()
  const rate = useRateWithUndo()
  const toggle = useToggleDone()
  const [editing, setEditing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [deadline, setDeadline] = useState<Assessment | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newTopic, setNewTopic] = useState('')

  const topics = s.topicsByCourse.get(c.id) ?? []
  const deadlines = s.assessmentsByCourse.get(c.id) ?? []
  const cov = coverage(topics)
  const day = today(now)
  const ranked = useMemo(() => rankReview(s.ws, now, { courseId: c.id }), [s.ws, now, c.id])
  const open = deadlines.filter((a) => !a.done)
  const done = deadlines.filter((a) => a.done)

  const addTopic = async (e: FormEvent) => {
    e.preventDefault()
    const title = newTopic.trim()
    if (!title) return
    setNewTopic('')
    try {
      await topicsM.create({
        courseId: c.id,
        title,
        details: null,
        notes: '',
        plannedDate: null,
        plannedStart: null,
        plannedMinutes: null,
        confidence: 'unrated',
        position: topics.length,
      })
    } catch (err) {
      setNewTopic(title)
      toast.error(err, 'Could not add that topic.')
    }
  }

  const setStatus = async (status: CourseT['status']) => {
    try {
      await courseM.update(c.id, { status })
      toast.show({ message: status === 'archived' ? `${c.code} moved to past courses` : `${c.code} is back this term` })
    } catch (err) {
      toast.error(err)
    }
  }

  const nextLecture = topics.find((t) => t.plannedDate && t.plannedDate >= day && t.confidence === 'unrated')

  return (
    <div className="page course" data-hue={c.color} data-empty={topics.length ? undefined : 'true'}>
      <Link to="/app/courses" className="back-link">
        <Icon name="arrowLeft" size={15} /> Courses
      </Link>

      <header className="course__head">
        <div className="course__id">
          <p className="course__code t-mono">
            <span className="course__swatch" aria-hidden />
            {c.code}
            {c.status === 'archived' ? <span className="course__archived">Past</span> : null}
          </p>
          <h1 className="course__title t-display">{c.name}</h1>
          <ul className="course__facts">
            {c.instructor ? <li>{c.instructor}</li> : null}
            {c.term ? <li>{c.term}</li> : null}
            {c.email ? (
              <li>
                <a href={`mailto:${c.email}`}>{c.email}</a>
              </li>
            ) : null}
            {c.website ? (
              <li>
                <a href={c.website} target="_blank" rel="noreferrer">
                  Course site <Icon name="external" size={13} />
                </a>
              </li>
            ) : null}
          </ul>
        </div>
        <div className="course__actions">
          {topics.length ? (
            <Button variant="primary" icon="timer" onClick={() => startFocus(navigate, ranked[0]?.topic ?? nextLecture ?? null)}>
              Lock in
            </Button>
          ) : null}
          {topics.length ? (
            <Button icon="import" onClick={() => setImporting(true)}>
              Import syllabus
            </Button>
          ) : (
            <Button icon="flag" onClick={() => setDeadline('new')}>
              Add deadline
            </Button>
          )}
          <Menu
            label={`${c.code} options`}
            trigger={(p) => <IconButton {...p} icon="more" label="More options" variant="secondary" />}
            items={[
              { label: 'Edit details', icon: 'edit', onSelect: () => setEditing(true) },
              { label: 'Add deadline', icon: 'flag', onSelect: () => setDeadline('new') },
              c.status === 'active'
                ? { label: 'Move to past courses', icon: 'archive', onSelect: () => setStatus('archived') }
                : { label: 'Move back to this term', icon: 'archive', onSelect: () => setStatus('active') },
              'separator',
              { label: 'Delete course', icon: 'trash', tone: 'danger', onSelect: () => setConfirmDelete(true) },
            ]}
          />
        </div>
      </header>

      {topics.length ? (
        <section className="course__coverage" aria-labelledby="cov-h">
          <div className="course__cov-top">
            <h2 id="cov-h" className="sr-only">
              Coverage
            </h2>
            <p className="course__cov-big t-display tabular">
              {cov.counts.solid}
              <span className="t-faint">/{cov.eligible}</span>
            </p>
            <p className="course__cov-label">
              topics feel solid.
              <span className="t-faint">
                {' '}
                {cov.counts.okay} getting there, {cov.counts.shaky} shaky, {cov.counts.unrated} not rated
                {cov.counts.retired ? `, ${cov.counts.retired} not on exam` : ''}.
              </span>
            </p>
          </div>
          <CoverageStrip topics={topics} size="lg" />
          <ConfidenceKey withRetired={topics.some((t) => t.confidence === 'retired')} />
        </section>
      ) : null}

      {topics.length ? (
        <nav className="course__jumps" aria-label="On this page">
          {deadlines.length ? <a href="#deadlines">Deadlines</a> : null}
          {ranked.length ? <a href="#review-next">Review next</a> : null}
          <a href="#topics">Topics ({topics.length})</a>
        </nav>
      ) : null}

      <div className="course__grid">
        <section className="panel course__topics" id="topics" aria-labelledby="topics-h">
          <header className="panel__head">
            <div>
              <h2 id="topics-h" className="panel__title">
                Topics
              </h2>
              <p className="panel__sub">In syllabus order. Rate each one after you study it.</p>
            </div>
            <span className="panel__count tabular">{topics.length}</span>
          </header>
          {topics.length ? (
            <ol className="topic-list">
              {topics.map((t, i) => (
                <TopicLine key={t.id} t={t} i={i} day={day} onRate={(r) => rate(t, r, 'topic')} />
              ))}
            </ol>
          ) : (
            <EmptyState
              title="No topics yet"
              action={
                <Button variant="primary" icon="import" onClick={() => setImporting(true)}>
                  Import syllabus
                </Button>
              }
            >
              Paste the schedule from the syllabus and each lecture becomes a topic. Or add them one by one below.
            </EmptyState>
          )}
          <form className="topic-add" onSubmit={addTopic}>
            <Input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder="New topic, e.g. Page tables"
              aria-label="New topic title"
              maxLength={160}
            />
            <Button type="submit" icon="plus" disabled={!newTopic.trim()}>
              Add topic
            </Button>
          </form>
        </section>

        <div className="course__side">
          <section className="panel" id="deadlines" aria-labelledby="dl-h">
            <header className="panel__head">
              <div>
                <h2 id="dl-h" className="panel__title">
                  Deadlines
                </h2>
              </div>
              <Button size="sm" variant="ghost" icon="plus" onClick={() => setDeadline('new')}>
                Add
              </Button>
            </header>
            {deadlines.length ? (
              <ul className="deadline-list">
                {[...open, ...done].map((a) => (
                  <DeadlineRow key={a.id} a={a} now={now} contextCode={c.code} onToggle={() => toggle(a)} onEdit={() => setDeadline(a)} />
                ))}
              </ul>
            ) : (
              <p className="panel__empty">No deadlines yet. Add assignments, quizzes and exams so they show up on Today.</p>
            )}
          </section>

          {topics.length ? (
          <section className="panel course__review" id="review-next" aria-labelledby="crq-h">
            <header className="panel__head">
              <div>
                <h2 id="crq-h" className="panel__title">
                  Review next
                </h2>
              </div>
              {ranked.length > 4 ? (
                <Link className="panel__link" to={`/app/review?courses=${c.id}`}>
                  All {ranked.length} <Icon name="arrowRight" size={14} />
                </Link>
              ) : null}
            </header>
            {ranked.length ? (
              <ol className="review-list">
                {ranked.slice(0, 4).map((r) => (
                  <ReviewRow key={r.topic.id} topic={r.topic} reasons={r.reasons} onRate={(x) => rate(r.topic, x)} compact />
                ))}
              </ol>
            ) : (
              <p className="panel__empty">Nothing due for review in {c.code}.</p>
            )}
          </section>
          ) : null}
        </div>
      </div>

      <CourseDialog open={editing} onClose={() => setEditing(false)} course={c} />
      <SyllabusDialog open={importing} onClose={() => setImporting(false)} course={c} startPosition={topics.length} />
      <AssessmentDialog
        open={deadline !== null}
        onClose={() => setDeadline(null)}
        assessment={deadline && deadline !== 'new' ? deadline : undefined}
        courses={s.activeCourses}
        topics={s.ws.topics}
        defaultCourseId={c.id}
      />
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        size="sm"
        title={`Delete ${c.code}?`}
        description={`This removes ${topics.length} topics, ${deadlines.length} deadlines and their review history. It cannot be undone. Moving it to past courses keeps everything.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={async () => {
                try {
                  await courseM.remove(c.id)
                  toast.show({ message: `Deleted ${c.code}` })
                  navigate('/app/courses')
                } catch (err) {
                  toast.error(err)
                }
              }}
            >
              Delete course
            </Button>
          </>
        }
      >
        <span className="sr-only">Confirm delete</span>
      </Dialog>
    </div>
  )
}

function TopicLine({ t, i, day, onRate }: { t: Topic; i: number; day: string; onRate: (c: Topic['confidence']) => void }) {
  const upcoming = t.plannedDate && t.plannedDate > day
  const isToday = t.plannedDate === day
  const reviewed = t.lastReviewedAt ? diffDays(day, localDate(t.lastReviewedAt)) : null
  return (
    <li className="topic-line" data-conf={t.confidence} data-upcoming={upcoming || undefined}>
      <span className="topic-line__n t-mono tabular">{String(i + 1).padStart(2, '0')}</span>
      <span className="review-row__mark topic-line__mark" aria-hidden />
      <div className="topic-line__main">
        <Link to={`/app/topics/${t.id}`} className="topic-line__title">
          {t.title}
        </Link>
        {t.details ? <p className="topic-line__details">{t.details}</p> : null}
      </div>
      <div className="topic-line__when tabular">
        {t.plannedDate ? (
          <span data-today={isToday || undefined}>{isToday ? 'Today' : formatDate(t.plannedDate, { month: 'short', day: 'numeric' })}</span>
        ) : (
          <span className="t-faint">No date</span>
        )}
        <span className="t-faint">{reviewed === null ? '' : reviewed === 0 ? 'rated today' : reviewed === 1 ? 'rated yesterday' : `rated ${reviewed} days ago`}</span>
      </div>
      <div className="topic-line__rate">
        <RatePicker value={t.confidence} onRate={onRate} title={t.title} />
      </div>
    </li>
  )
}
