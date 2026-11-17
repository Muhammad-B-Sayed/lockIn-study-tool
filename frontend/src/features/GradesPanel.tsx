import { useId, useMemo, useState } from 'react'
import { gradeSummary, neededAverage } from '../lib/domain/grades'
import type { Assessment, Course } from '../lib/data/types'
import { setScore, setTarget, useScoreBook } from '../app/scores'
import { withoutCode } from '../app/titles'
import { Input } from '../ui/primitives'
import './grades.css'

const trim = (n: number) => String(Math.round(n * 10) / 10)

/** A small percent field that saves each valid value as it is typed and clears on empty. */
function PercentInput({ value, max, label, onSave }: { value: number | undefined; max: number; label: string; onSave: (n: number | null) => void }) {
  const [text, setText] = useState(value === undefined ? '' : trim(value))
  const n = Number(text)
  const bad = text.trim() !== '' && (!Number.isFinite(n) || n < 0 || n > max)
  return (
    <span className="grades__field">
      <Input
        className="t-mono grades__input"
        inputMode="decimal"
        value={text}
        aria-label={label}
        aria-invalid={bad || undefined}
        placeholder="--"
        maxLength={6}
        onChange={(e) => {
          const next = e.target.value
          setText(next)
          const parsed = Number(next)
          if (!next.trim()) onSave(null)
          else if (Number.isFinite(parsed) && parsed >= 0 && parsed <= max) onSave(parsed)
        }}
      />
      <span className="grades__pct" aria-hidden>
        %
      </span>
    </span>
  )
}

/** Weighted grade so far for one course, and the average needed to reach a target. */
export function GradesPanel({ course, assessments }: { course: Course; assessments: Assessment[] }) {
  const id = useId()
  const book = useScoreBook()
  const weighted = useMemo(() => assessments.filter((a) => a.weight != null && a.weight > 0), [assessments])
  const summary = useMemo(() => gradeSummary(weighted, book.scores), [weighted, book.scores])
  if (!weighted.length) return null

  const target = book.targets[course.id]
  const needed = target === undefined ? null : neededAverage(summary, target)
  const unlisted = summary.basis - summary.listedWeight

  let verdict: string
  if (target === undefined) verdict = 'Enter the grade you are aiming for to see what you need on the rest.'
  else if (needed === null) verdict = summary.current !== null && summary.current >= target ? 'Everything is graded and you reached it.' : 'Everything is graded. Nothing is left to change the result.'
  else if (needed <= 0) verdict = `Already secured, whatever happens on the remaining ${trim(summary.remainingWeight)}%.`
  else if (needed > 100) verdict = `Out of reach on the listed weights. It would take ${trim(needed)}% on the remaining ${trim(summary.remainingWeight)}%.`
  else verdict = `You need an average of ${trim(needed)}% on the remaining ${trim(summary.remainingWeight)}% of the grade.`

  return (
    <section className="panel grades" aria-labelledby={`${id}-h`}>
      <header className="panel__head">
        <div>
          <h2 id={`${id}-h`} className="panel__title">
            Grade
          </h2>
          <p className="panel__sub">Type the score you got on each piece. Scores stay on this device.</p>
        </div>
      </header>

      <div className="grades__top">
        <p className="grades__big t-display tabular">
          {summary.current === null ? '--' : trim(summary.current)}
          <small>%</small>
        </p>
        <p className="grades__label">
          {summary.current === null ? 'No scores yet.' : 'average on graded work.'}
          <span className="t-faint">
            {' '}
            {trim(summary.gradedWeight)}% of the grade is in, worth {trim(summary.earned)} points so far.
          </span>
        </p>
      </div>

      <ul className="grades__list">
        {weighted.map((a) => (
          <li key={a.id} className="grades__row">
            <span className="grades__title">{withoutCode(a.title, course.code)}</span>
            <span className="grades__weight tabular t-faint">{trim(a.weight ?? 0)}%</span>
            <PercentInput value={book.scores[a.id]} max={200} label={`Score on ${a.title}, in percent`} onSave={(n) => setScore(a.id, n)} />
          </li>
        ))}
      </ul>

      <div className="grades__target">
        <span className="grades__target-label" aria-hidden>
          Aiming for
        </span>
        <PercentInput value={target} max={100} label="Target final grade, in percent" onSave={(n) => setTarget(course.id, n)} />
        <p className="grades__verdict" data-tone={needed !== null && needed > 100 ? 'late' : undefined} aria-live="polite">
          {verdict}
        </p>
      </div>

      {Math.abs(unlisted) > 0.05 || summary.listedWeight > 100 ? (
        <p className="grades__note t-faint">
          {summary.listedWeight > 100
            ? `The weights add up to ${trim(summary.listedWeight)}%, so the grade is worked out of ${trim(summary.basis)}.`
            : `The weights listed add up to ${trim(summary.listedWeight)}%. The other ${trim(unlisted)}% counts as not graded yet.`}
        </p>
      ) : null}
    </section>
  )
}
