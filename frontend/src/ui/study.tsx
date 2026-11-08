import { Link } from 'react-router-dom'
import type { Confidence, Course, Topic } from '../lib/data/types'
import { ConfidenceGlyph } from './confidence'
import { CONFIDENCE, RATABLE } from './confidenceMeta'

export function CourseTag({ course, link = false, size = 'md' }: { course: Course | undefined; link?: boolean; size?: 'sm' | 'md' }) {
  if (!course) return null
  const inner = (
    <>
      <span className="course-tag__dot" aria-hidden />
      <span className="t-mono">{course.code}</span>
    </>
  )
  const cls = `course-tag course-tag--${size}`
  return link ? (
    <Link to={`/app/courses/${course.id}`} className={cls} data-hue={course.color}>
      {inner}
    </Link>
  ) : (
    <span className={cls} data-hue={course.color}>
      {inner}
    </span>
  )
}

/**
 * The syllabus strip. One cell per topic in syllabus order, filled by confidence.
 * The course reads as a row of lights: dark cells are what is left to learn.
 */
export function CoverageStrip({
  topics,
  size = 'md',
  label,
}: {
  topics: Topic[]
  size?: 'sm' | 'md' | 'lg'
  label?: string
}) {
  const counted = topics.filter((t) => t.confidence !== 'retired')
  const solid = counted.filter((t) => t.confidence === 'solid').length
  const okay = counted.filter((t) => t.confidence === 'okay').length
  const shaky = counted.filter((t) => t.confidence === 'shaky').length
  const summary =
    label ??
    `${counted.length} topics: ${solid} solid, ${okay} getting there, ${shaky} shaky, ${counted.length - solid - okay - shaky} not rated`
  return (
    <div className={`strip strip--${size}`} role="img" aria-label={summary}>
      {topics.map((t) => (
        <span key={t.id} className="strip__cell" data-conf={t.confidence} title={`${t.title}: ${CONFIDENCE[t.confidence].label}`} />
      ))}
      {topics.length === 0
        ? Array.from({ length: 12 }, (_, i) => <span key={i} className="strip__cell strip__cell--ghost" aria-hidden />)
        : null}
    </div>
  )
}

/** One-tap rating. Three jars, each labelled. Current value is pressed. */
export function RateControl({
  value,
  onRate,
  size = 'md',
  showLabels = true,
  disabled,
}: {
  value: Confidence
  onRate: (c: Confidence) => void
  size?: 'sm' | 'md' | 'lg'
  showLabels?: boolean
  disabled?: boolean
}) {
  return (
    <div className={`rate rate--${size}`} role="group" aria-label="How confident do you feel?">
      {RATABLE.map((c) => (
        <button
          key={c}
          type="button"
          className="rate__opt"
          data-conf={c}
          aria-pressed={value === c}
          disabled={disabled}
          title={`${CONFIDENCE[c].label}: ${CONFIDENCE[c].hint}`}
          aria-label={showLabels ? undefined : CONFIDENCE[c].label}
          onClick={() => onRate(c)}
        >
          <ConfidenceGlyph value={c} size={size === 'lg' ? 22 : size === 'sm' ? 13 : 15} />
          {showLabels ? <span>{CONFIDENCE[c].label}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function DueTag({ label, tone }: { label: string; tone: 'late' | 'soon' | 'later' | 'done' | 'today' }) {
  return (
    <span className="due-tag" data-tone={tone}>
      {label}
    </span>
  )
}

export function KindTag({ kind }: { kind: string }) {
  return (
    <span className="kind-tag" data-kind={kind}>
      {kind}
    </span>
  )
}
