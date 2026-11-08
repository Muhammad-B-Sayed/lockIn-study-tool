import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { coverage, relativeDue, today } from '../lib/domain'
import type { Course } from '../lib/data/types'
import { useNow, useStudy, type StudyIndex } from '../app/useStudy'
import { CourseDialog } from '../features/forms'
import { Icon } from '../ui/Icon'
import { Button, EmptyState, Segmented } from '../ui/primitives'
import { CoverageStrip, DueTag } from '../ui/study'
import { ConfidenceKey } from '../ui/ConfidenceKey'
import { withoutCode } from '../app/titles'
import './courses.css'

export default function Courses() {
  const { data } = useStudy()
  const now = useNow()
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()

  if (!data) {
    return (
      <div className="page" aria-busy="true">
        <div className="course-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="skeleton" style={{ height: 230, borderRadius: 18 }} />
          ))}
        </div>
      </div>
    )
  }

  const list = tab === 'active' ? data.activeCourses : data.archivedCourses

  return (
    <div className="page courses">
      <header className="page-head">
        <div>
          <p className="t-eyebrow page-head__eyebrow">Courses</p>
          <h1 className="page-head__title t-display">
            {data.activeCourses.length ? (
              <>
                <span className="tabular">{data.activeCourses.length}</span> courses this term
              </>
            ) : (
              'Your courses'
            )}
          </h1>
        </div>
        <div className="page-head__actions">
          {data.archivedCourses.length ? (
            <Segmented
              label="Show"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'active', label: 'This term' },
                { value: 'archived', label: `Past (${data.archivedCourses.length})` },
              ]}
            />
          ) : null}
          <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
            New course
          </Button>
        </div>
      </header>

      {list.length ? <ConfidenceKey withRetired={data.ws.topics.some((t) => t.confidence === 'retired')} /> : null}
      {list.length ? (
        <ul className="course-grid">
          {list.map((c, i) => (
            <CourseCard key={c.id} c={c} s={data} now={now} i={i} />
          ))}
          {tab === 'active' ? (
            <li>
              <button type="button" className="course-card course-card--add" onClick={() => setAdding(true)}>
                <Icon name="plus" size={22} />
                <span>Add a course</span>
              </button>
            </li>
          ) : null}
        </ul>
      ) : (
        <EmptyState
          title={tab === 'active' ? 'Start with one course' : 'No past courses'}
          action={
            tab === 'active' ? (
              <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
                Add your first course
              </Button>
            ) : null
          }
        >
          {tab === 'active'
            ? 'Add the course, paste its syllabus, and LockIn turns each line into a topic or deadline.'
            : 'Archive a course from its menu when the term ends. Its history stays here.'}
        </EmptyState>
      )}

      <CourseDialog
        open={adding}
        onClose={() => setAdding(false)}
        usedColors={data.activeCourses.map((c) => c.color)}
        onSaved={(c) => navigate(`/app/courses/${c.id}`)}
      />
    </div>
  )
}

function CourseCard({ c, s, now, i }: { c: Course; s: StudyIndex; now: Date; i: number }) {
  const topics = s.topicsByCourse.get(c.id) ?? []
  const cov = coverage(topics)
  const day = today(now)
  const next = useMemo(
    () => (s.assessmentsByCourse.get(c.id) ?? []).find((a) => !a.done && a.dueDate >= day) ?? null,
    [s.assessmentsByCourse, c.id, day],
  )
  const lateItems = (s.assessmentsByCourse.get(c.id) ?? []).filter((a) => !a.done && a.dueDate < day)
  const late = lateItems.length
  const lead = lateItems[0] ?? next
  const due = lead ? relativeDue(lead.dueDate, now) : null

  return (
    <li style={{ ['--i' as string]: i }}>
      <Link to={`/app/courses/${c.id}`} className="course-card" data-hue={c.color}>
        <div className="course-card__cover" aria-hidden>
          <span className="course-card__glyph t-display">{c.code.match(/\d+\w*/)?.[0] ?? c.code.slice(0, 3)}</span>
          <span className="course-card__num t-mono">{c.code.replace(/\d+.*/, '') || ''}</span>
        </div>
        <div className="course-card__body">
          <p className="course-card__code t-mono">{c.code}</p>
          <h2 className="course-card__name">{c.name}</h2>
          <p className="course-card__meta">{[c.instructor, c.term].filter(Boolean).join(' · ') || ' '}</p>
          <div className="course-card__strip">
            <CoverageStrip topics={topics} />
            <span className="course-card__stat tabular">
              {cov.counts.solid}/{cov.eligible} solid
            </span>
          </div>
          <div className="course-card__foot">
            {lead && due ? (
              <span className="course-card__next">
                <span className="course-card__next-title">{withoutCode(lead.title, c.code)}</span>
                <DueTag label={due.label} tone={due.label === 'Today' ? 'today' : due.tone} />
              </span>
            ) : (
              <span className="t-faint">No upcoming deadlines</span>
            )}
            {late > 1 ? <span className="course-card__late">+{late - 1} late</span> : null}
          </div>
        </div>
      </Link>
    </li>
  )
}
