import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAssessmentMutations, useTopicMutations } from '../lib/data'
import { parseQuickAdd, today } from '../lib/domain'
import { formatDate } from '../app/format'
import { useNow, useStudy } from '../app/useStudy'
import { Icon, type IconName } from '../ui/Icon'
import { ConfidenceGlyph } from '../ui/confidence'
import { CourseTag } from '../ui/study'
import { Kbd } from '../ui/primitives'
import { useToast } from '../ui/toastContext'
import type { Course } from '../lib/data/types'

type Item = {
  id: string
  group: string
  label: string
  sub?: string
  icon?: IconName
  lead?: React.ReactNode
  course?: Course
  run: () => void | Promise<void>
}

const PAGES: { label: string; to: string; icon: IconName; keywords: string }[] = [
  { label: 'Today', to: '/app', icon: 'today', keywords: 'home dashboard agenda' },
  { label: 'Review', to: '/app/review', icon: 'review', keywords: 'queue confidence' },
  { label: 'Calendar', to: '/app/calendar', icon: 'calendar', keywords: 'week month schedule' },
  { label: 'Courses', to: '/app/courses', icon: 'courses', keywords: 'classes syllabus' },
  { label: 'Lock in', to: '/app/focus', icon: 'lock', keywords: 'focus timer pomodoro study session' },
  { label: 'Settings', to: '/app/settings', icon: 'settings', keywords: 'account theme password export' },
]

function score(hay: string, q: string) {
  const h = hay.toLowerCase()
  if (!q) return 1
  if (h.startsWith(q)) return 3
  if (h.includes(` ${q}`)) return 2
  if (h.includes(q)) return 1
  return 0
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <PaletteBody onClose={onClose} /> : null
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const { data } = useStudy()
  const now = useNow()
  const navigate = useNavigate()
  const toast = useToast()
  const topicsM = useTopicMutations()
  const assessM = useAssessmentMutations()

  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
    inputRef.current?.focus()
  }, [])

  const items = useMemo<Item[]>(() => {
    const query = q.trim().toLowerCase()
    const go = (to: string) => () => {
      onClose()
      navigate(to)
    }
    const out: Item[] = []

    if (query && data) {
      const draft = parseQuickAdd(q, data.activeCourses, now)
      const course = draft.courseId ? data.courseById.get(draft.courseId) : undefined
      const when = draft.date ? formatDate(draft.date, { weekday: 'short', month: 'short', day: 'numeric' }) : 'no date'
      const isTopic = draft.kind === 'topic'
      // Existing deadlines that look like what is being typed, shown first so nobody adds a duplicate.
      const words = draft.title.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
      const similar = isTopic
        ? []
        : data.ws.assessments.filter(
            (a) =>
              (!course || a.courseId === course.id) &&
              a.kind === draft.kind &&
              words.length > 0 &&
              words.every((w) => a.title.toLowerCase().includes(w)),
          )
      const sameDate = similar.filter((a) => !draft.date || a.dueDate === draft.date)
      const listed: Item[] = []
      for (const a of similar.slice(0, 3)) {
        const differs = !!draft.date && a.dueDate !== draft.date
        listed.push({
          id: `same-${a.id}`,
          group: 'Already on your list',
          icon: 'flag',
          label: `Open ${a.title}`,
          sub: `${formatDate(a.dueDate, { weekday: 'short', month: 'short', day: 'numeric' })}${differs ? ' · different date' : ''}`,
          course: a.courseId ? data.courseById.get(a.courseId) : undefined,
          run: () => {
            onClose()
            navigate(a.courseId ? `/app/courses/${a.courseId}#deadlines` : '/app/calendar')
          },
        })
      }
      // Same date already exists: offer it first. Different date: creating is the likely intent.
      if (sameDate.length) out.push(...listed)
      if (draft.title && (!isTopic || course)) {
        out.push({
          id: 'quick-add',
          group: 'Add',
          icon: 'plus',
          label: `${sameDate.length ? 'Add another' : 'Create'} ${isTopic ? 'topic' : draft.kind} “${draft.title}”`,
          sub: [course?.code, when, draft.time].filter(Boolean).join(' · '),
          run: async () => {
            onClose()
            try {
              if (isTopic) {
                const siblings = data.topicsByCourse.get(course!.id) ?? []
                await topicsM.create({
                  courseId: course!.id,
                  title: draft.title,
                  details: null,
                  notes: '',
                  plannedDate: draft.date ?? (draft.time ? today(now) : null),
                  plannedStart: draft.time ? new Date(`${draft.date ?? today(now)}T${draft.time}:00`).toISOString() : null,
                  plannedMinutes: draft.time ? 60 : null,
                  confidence: 'unrated',
                  position: siblings.length,
                })
              } else {
                await assessM.create({
                  courseId: course?.id ?? null,
                  title: draft.title,
                  kind: draft.kind as Exclude<typeof draft.kind, 'topic'>,
                  dueDate: draft.date ?? today(now),
                  dueTime: draft.time,
                  weight: null,
                  done: false,
                  notes: '',
                  topicIds: [],
                })
              }
              toast.show({ message: `Added “${draft.title}”` })
            } catch (err) {
              toast.error(err)
            }
          },
        })
      }
      if (!sameDate.length) out.push(...listed)
    }

    for (const p of PAGES) {
      if (score(`${p.label} ${p.keywords}`, query)) {
        out.push({ id: `page-${p.to}`, group: 'Go to', label: p.label, icon: p.icon, run: go(p.to) })
      }
    }
    if (data) {
      const courses = data.ws.courses
        .map((c) => ({ c, s: Math.max(score(c.code, query), score(c.name, query)) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, query ? 6 : 0)
      for (const { c } of courses) {
        out.push({ id: `course-${c.id}`, group: 'Courses', label: c.name, course: c, run: go(`/app/courses/${c.id}`) })
      }
      if (query) {
        const topics = data.ws.topics
          .map((t) => ({ t, s: score(t.title, query) }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s)
          .slice(0, 7)
        for (const { t } of topics) {
          out.push({
            id: `topic-${t.id}`,
            group: 'Topics',
            label: t.title,
            lead: <ConfidenceGlyph value={t.confidence} />,
            course: data.courseById.get(t.courseId),
            run: go(`/app/topics/${t.id}`),
          })
        }
        const due = data.ws.assessments
          .map((a) => ({ a, s: score(a.title, query) }))
          .filter((x) => x.s > 0)
          .slice(0, 5)
        for (const { a } of due) {
          out.push({
            id: `due-${a.id}`,
            group: 'Deadlines',
            label: a.title,
            icon: 'flag',
            sub: formatDate(a.dueDate, { month: 'short', day: 'numeric' }),
            course: a.courseId ? data.courseById.get(a.courseId) : undefined,
            run: go(a.courseId ? `/app/courses/${a.courseId}#deadlines` : '/app/calendar'),
          })
        }
      }
    }
    return out
  }, [q, data, now, navigate, onClose, toast, topicsM, assessM])

  useEffect(() => {
    document.getElementById(`cmd-${items[active]?.id}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, items])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(items.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      void items[active]?.run()
    }
  }

  let lastGroup = ''
  return (
    <dialog
      ref={ref}
      className="palette"
      aria-label="Search or add"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {(
        <div className="palette__panel" onKeyDown={onKeyDown}>
          <div className="palette__search">
            <Icon name="search" size={18} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setActive(0)
              }}
              placeholder="Search, or type “CSC369 midterm nov 12” to add"
              aria-label="Search or add"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
              aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined}
              autoComplete="off"
              spellCheck={false}
            />
            <Kbd>esc</Kbd>
            <button type="button" className="icon-btn palette__close" aria-label="Close" onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          <ul className="palette__list" id="palette-list" role="listbox" aria-label="Results">
            {items.map((it, i) => {
              const header = it.group !== lastGroup ? it.group : null
              lastGroup = it.group
              return (
                <li key={it.id} role="presentation">
                  {header ? (
                    <p className="palette__group t-eyebrow" role="presentation">
                      {header}
                    </p>
                  ) : null}
                  <div
                    id={`cmd-${it.id}`}
                    role="option"
                    aria-selected={i === active}
                    className="palette__item"
                    onMouseMove={() => setActive(i)}
                    onClick={() => void it.run()}
                  >
                    <span className="palette__icon">{it.lead ?? (it.icon ? <Icon name={it.icon} size={16} /> : null)}</span>
                    {it.course && it.group === 'Courses' ? <CourseTag course={it.course} size="sm" /> : null}
                    <span className="palette__label">{it.label}</span>
                    {it.course && it.group !== 'Courses' ? <CourseTag course={it.course} size="sm" /> : null}
                    {it.sub ? <span className="palette__sub tabular">{it.sub}</span> : null}
                    {i === active ? <Icon name="arrowRight" size={14} className="palette__enter" /> : null}
                  </div>
                </li>
              )
            })}
            {items.length === 0 ? <li className="palette__none">Nothing matches “{q}”.</li> : null}
          </ul>
          <footer className="palette__foot">
            <span>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> move
            </span>
            <span>
              <Kbd>↵</Kbd> open
            </span>
            <span className="palette__tip">Tip: add “exam”, “quiz” or “due” to create a deadline</span>
          </footer>
        </div>
      )}
    </dialog>
  )
}
