import { Link, useNavigate } from 'react-router-dom'
import { formatTime, relativeDue } from '../lib/domain'
import { formatDate } from '../app/format'
import type { Assessment, Confidence, Course, Topic } from '../lib/data/types'
import { startFocus } from './actions'
import { withoutCode } from '../app/titles'
import { Icon } from '../ui/Icon'
import { Button } from '../ui/primitives'
import { CourseTag, DueTag, KindTag } from '../ui/study'
import { RatePicker } from '../ui/RatePicker'

export function ReviewRow({
  topic,
  course,
  reasons,
  index,
  onRate,
  compact,
}: {
  topic: Topic
  course?: Course
  reasons?: string[]
  index?: number
  onRate: (c: Confidence) => void
  compact?: boolean
}) {
  const navigate = useNavigate()
  return (
    <li className={['review-row', compact ? 'review-row--compact' : ''].join(' ')} data-conf={topic.confidence}>
      {index !== undefined ? <span className="review-row__rank t-mono tabular">{String(index + 1).padStart(2, '0')}</span> : null}
      <span className="review-row__mark" aria-hidden />
      <div className="review-row__main">
        <Link to={`/app/topics/${topic.id}`} className="review-row__title">
          {topic.title}
        </Link>
        <div className="review-row__meta">
          <CourseTag course={course} size="sm" />
          {reasons?.length ? <span className="review-row__why">{orderReasons(reasons).join(' · ')}</span> : null}
        </div>
      </div>
      <div className="review-row__actions">
        <RatePicker value={topic.confidence} onRate={onRate} title={topic.title} />
        <Button size="sm" variant="ghost" icon="timer" className="review-row__focus" aria-label={`Focus on ${topic.title}`} title="Start a focus session on this topic" onClick={() => startFocus(navigate, topic)}>
          Focus
        </Button>
      </div>
    </li>
  )
}

export function DeadlineRow({
  a,
  course,
  now,
  onToggle,
  onEdit,
  showDate = true,
  contextCode,
}: {
  a: Assessment
  course?: Course
  /** Course code of the page this row sits on, stripped from the title without showing a tag. */
  contextCode?: string
  now: Date
  onToggle: () => void
  onEdit?: () => void
  showDate?: boolean
}) {
  const due = relativeDue(a.dueDate, now, a.done)
  const tone = due.label === 'Today' && !a.done ? 'today' : due.tone
  return (
    <li className="deadline-row" data-done={a.done || undefined} data-kind={a.kind}>
      <button
        type="button"
        className="check"
        role="checkbox"
        aria-checked={a.done}
        aria-label={`Mark ${a.title} ${a.done ? 'not done' : 'done'}`}
        onClick={onToggle}
      >
        <Icon name="check" size={13} strokeWidth={2.4} />
      </button>
      <div className="deadline-row__main">
        {onEdit ? (
          <button type="button" className="deadline-row__title deadline-row__title--btn" onClick={onEdit} title="Edit deadline">
            {withoutCode(a.title, course?.code ?? contextCode)}
          </button>
        ) : (
          <span className="deadline-row__title">{withoutCode(a.title, course?.code ?? contextCode)}</span>
        )}
        <span className="deadline-row__meta">
          {course ? <CourseTag course={course} size="sm" /> : null}
          <KindTag kind={a.kind} />
          {showDate || a.weight ? (
            <span className="t-faint deadline-row__date tabular">
              {[
                showDate
                  ? formatDate(a.dueDate, { weekday: 'short', month: 'short', day: 'numeric' }) +
                    (a.dueTime && a.dueTime !== '23:59' ? `, ${formatTime(a.dueTime)}` : '')
                  : null,
                a.weight ? `${a.weight}% of grade` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          ) : null}
        </span>
      </div>
      <DueTag label={due.label} tone={tone} />
    </li>
  )
}

/** Urgency first (exam or quiz soon), then recency. The confidence label is already shown by the glyph. */
function orderReasons(reasons: string[]) {
  const urgent = reasons.filter((r) => /^(Exam|Quiz)/.test(r))
  const rest = reasons.filter((r) => !/^(Exam|Quiz)/.test(r) && !/^(Shaky|Getting there|Solid|Not rated)$/.test(r))
  return [...urgent, ...rest]
}
