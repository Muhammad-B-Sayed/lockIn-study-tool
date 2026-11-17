import { useId, useMemo, useState, type FormEvent } from 'react'
import { useSessionMutations } from '../lib/data'
import { addDays, today } from '../lib/domain'
import { formatMinutes, weekStats } from '../lib/domain/stats'
import type { StudySession } from '../lib/data/types'
import { formatDate, localDate } from '../app/format'
import { DAILY_GOAL_CHOICES, setPrefs, usePrefs } from '../app/prefs'
import type { StudyIndex } from '../app/useStudy'
import { Menu } from '../ui/Menu'
import { Button, Dialog, Field, IconButton, Input, Select } from '../ui/primitives'
import { PickerField } from '../ui/PickerField'
import { CourseTag } from '../ui/study'
import { useToast } from '../ui/toastContext'
import './week.css'

/** This week against last week, the daily goal, time per course, and the recent session log. */
export function WeekPanel({ s, now }: { s: StudyIndex; now: Date }) {
  const prefs = usePrefs()
  const toast = useToast()
  const { create, remove } = useSessionMutations()
  const [logging, setLogging] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const stats = useMemo(() => weekStats(s.ws, now), [s.ws, now])
  const day = today(now)
  const goal = prefs.dailyGoalMinutes
  const goalPct = goal ? Math.min(100, Math.round((stats.todayMinutes / goal) * 100)) : 0
  const delta = stats.minutes - stats.previousToDate
  const maxCourse = Math.max(1, ...stats.byCourse.map((c) => Math.max(c.minutes, c.previous)))

  const recent = useMemo(
    () =>
      [...s.ws.sessions]
        .filter((x) => localDate(x.startedAt) >= addDays(day, -13))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [s.ws.sessions, day],
  )
  const shown = showAll ? recent : recent.slice(0, 4)

  const removeSession = async (x: StudySession) => {
    try {
      await remove(x.id)
      toast.show({
        message: `Removed ${formatMinutes(x.minutes)} session`,
        action: {
          label: 'Undo',
          run: async () => {
            await create({ topicId: x.topicId, courseId: x.courseId, startedAt: x.startedAt, minutes: x.minutes, note: x.note })
          },
        },
      })
    } catch (err) {
      toast.error(err, 'Could not remove that session.')
    }
  }

  const compare =
    stats.previousToDate === 0 && stats.minutes === 0
      ? 'No study time logged yet this week.'
      : stats.previousToDate === 0
        ? 'Nothing logged by this point last week.'
        : delta === 0
          ? 'Level with this point last week.'
          : `${formatMinutes(Math.abs(delta))} ${delta > 0 ? 'ahead of' : 'behind'} this point last week.`

  return (
    <section className="panel week" aria-labelledby="week-h">
      <header className="panel__head">
        <div>
          <h2 id="week-h" className="panel__title">
            This week
          </h2>
          <p className="panel__sub">
            Since {formatDate(stats.weekStart, { weekday: 'long' })}. {compare}
          </p>
        </div>
        <Button size="sm" variant="ghost" icon="plus" onClick={() => setLogging(true)}>
          Log time
        </Button>
      </header>

      <div className="week__stats">
        <div>
          <p className="week__num t-display tabular">{formatMinutes(stats.minutes)}</p>
          <p className="t-faint week__label">studied</p>
        </div>
        <div>
          <p className="week__num t-display tabular">{stats.reviews}</p>
          <p className="t-faint week__label">{stats.reviews === 1 ? 'rating' : 'ratings'}</p>
        </div>
        <div>
          <p className="week__num t-display tabular">{formatMinutes(stats.previousTotal)}</p>
          <p className="t-faint week__label">all of last week</p>
        </div>
      </div>

      <div className="week__goal" data-met={goal && stats.todayMinutes >= goal ? 'true' : undefined}>
        <div className="week__goal-row">
          <p className="week__goal-text">
            {goal ? (
              <>
                <strong className="tabular">{formatMinutes(stats.todayMinutes)}</strong> of {formatMinutes(goal)} today
                {stats.todayMinutes >= goal ? '. Goal met.' : `. ${formatMinutes(goal - stats.todayMinutes)} to go.`}
              </>
            ) : (
              <>
                <strong className="tabular">{formatMinutes(stats.todayMinutes)}</strong> today. Set a daily goal to track against it.
              </>
            )}
          </p>
          <Menu
            label="Daily goal"
            trigger={(p) => (
              <Button {...p} size="sm" variant="ghost" icon="target">
                {goal ? 'Change goal' : 'Set goal'}
              </Button>
            )}
            items={[
              ...DAILY_GOAL_CHOICES.map((m) => ({
                label: `${formatMinutes(m)} a day`,
                checked: goal === m,
                onSelect: () => setPrefs({ dailyGoalMinutes: m }),
              })),
              'separator' as const,
              { label: 'No daily goal', checked: goal === null, onSelect: () => setPrefs({ dailyGoalMinutes: null }) },
            ]}
          />
        </div>
        {goal ? (
          <div
            className="week__track"
            role="progressbar"
            aria-label="Daily goal"
            aria-valuemin={0}
            aria-valuemax={goal}
            aria-valuenow={Math.min(goal, stats.todayMinutes)}
            aria-valuetext={`${stats.todayMinutes} of ${goal} minutes`}
          >
            <span className="week__fill" style={{ ['--w' as string]: `${goalPct}%` }} />
          </div>
        ) : null}
      </div>

      {stats.byCourse.length ? (
        <ul className="week__courses" aria-label="Time per course, this week against last week">
          {stats.byCourse.map((row) => {
            const c = row.courseId ? s.courseById.get(row.courseId) : undefined
            return (
              <li key={row.courseId ?? 'none'} className="week__course" data-hue={c?.color ?? 'slate'}>
                <span className="week__course-name">{c ? <CourseTag course={c} size="sm" /> : <span className="t-faint">No course</span>}</span>
                <span className="week__bars" aria-hidden>
                  <span className="week__bar" style={{ ['--w' as string]: `${(row.minutes / maxCourse) * 100}%` }} />
                  <span className="week__bar week__bar--prev" style={{ ['--w' as string]: `${(row.previous / maxCourse) * 100}%` }} />
                </span>
                <span className="week__course-n tabular">
                  {formatMinutes(row.minutes)}
                  <span className="t-faint"> / {formatMinutes(row.previous)}</span>
                </span>
              </li>
            )
          })}
          <li className="week__legend t-faint" aria-hidden>
            <span className="week__key" /> this week
            <span className="week__key week__key--prev" /> last week
          </li>
        </ul>
      ) : null}

      {recent.length ? (
        <>
          <h3 className="week__sub t-eyebrow">Recent sessions</h3>
          <ul className="week__log">
            {shown.map((x) => {
              const topic = x.topicId ? s.topicById.get(x.topicId) : undefined
              const c = s.courseById.get(topic?.courseId ?? x.courseId ?? '')
              const date = localDate(x.startedAt)
              return (
                <li key={x.id} className="week__entry">
                  <span className="week__entry-when tabular">{date === day ? 'Today' : formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <span className="week__entry-main">
                    <span className="week__entry-title">
                      {c ? <CourseTag course={c} size="sm" /> : null}
                      <span>{topic?.title ?? (c ? 'General study' : 'Open focus')}</span>
                    </span>
                    {x.note ? <span className="week__entry-note">{x.note}</span> : null}
                  </span>
                  <span className="week__entry-min tabular">{formatMinutes(x.minutes)}</span>
                  <IconButton icon="trash" size="sm" label={`Remove ${formatMinutes(x.minutes)} session`} onClick={() => removeSession(x)} />
                </li>
              )
            })}
          </ul>
          {recent.length > 4 ? (
            <Button size="sm" variant="ghost" className="week__more" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show fewer' : `Show all ${recent.length} from the last 2 weeks`}
            </Button>
          ) : null}
        </>
      ) : null}

      <LogTimeDialog open={logging} onClose={() => setLogging(false)} s={s} day={day} />
    </section>
  )
}

export function LogTimeDialog(props: Parameters<typeof LogTimeBody>[0]) {
  return props.open ? <LogTimeBody {...props} /> : null
}

function LogTimeBody({ open, onClose, s, day, defaultTopicId }: { open: boolean; onClose: () => void; s: StudyIndex; day: string; defaultTopicId?: string }) {
  const id = useId()
  const toast = useToast()
  const { create } = useSessionMutations()
  const [target, setTarget] = useState(defaultTopicId ? `t:${defaultTopicId}` : '')
  const [minutes, setMinutes] = useState('30')
  const [date, setDate] = useState(day)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const n = Number(minutes)
    if (!minutes.trim() || !Number.isInteger(n) || n < 1 || n > 1440) errs.minutes = 'Use whole minutes from 1 to 1440.'
    if (!date) errs.date = 'Pick the day.'
    else if (date > day) errs.date = 'That day has not happened yet.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const topic = target.startsWith('t:') ? s.topicById.get(target.slice(2)) : undefined
    const courseId = topic?.courseId ?? (target.startsWith('c:') ? target.slice(2) : null)
    // Today's entry is stamped as ending now; an earlier day is stamped at noon local time.
    const startedAt = date === day ? new Date(Date.now() - n * 60_000) : new Date(`${date}T12:00:00`)
    const startOfDay = new Date(`${date}T00:00:00`)
    setBusy(true)
    try {
      await create({
        topicId: topic?.id ?? null,
        courseId,
        startedAt: (startedAt < startOfDay ? startOfDay : startedAt).toISOString(),
        minutes: n,
        note: note.trim() || null,
      })
      toast.show({ message: `Logged ${formatMinutes(n)}` })
      onClose()
    } catch (err) {
      toast.error(err, 'Could not log that time.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Log study time"
      description="For study you did away from the focus timer. It counts toward your week, your streak and your daily goal."
      footer={
        <>
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={`${id}-form`} loading={busy}>
            Log time
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} className="form-grid" onSubmit={submit} noValidate>
        <Field label="What you studied" htmlFor={`${id}-what`}>
          <Select id={`${id}-what`} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">No course, just study</option>
            {s.activeCourses.map((c) => (
              <optgroup key={c.id} label={`${c.code} · ${c.name}`}>
                <option value={`c:${c.id}`}>{c.code}, general study</option>
                {(s.topicsByCourse.get(c.id) ?? []).map((t) => (
                  <option key={t.id} value={`t:${t.id}`}>
                    {t.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <div className="form-row">
          <Field label="Minutes" htmlFor={`${id}-min`} error={errors.minutes}>
            <Input id={`${id}-min`} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="t-mono" autoFocus />
          </Field>
          <Field label="Day" htmlFor={`${id}-date`} error={errors.date}>
            <PickerField
              id={`${id}-date`}
              type="date"
              icon="calendar"
              label="Day studied"
              value={date}
              display={date ? (date === day ? 'Today' : formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })) : ''}
              placeholder="Pick a day"
              onChange={setDate}
              invalid={!!errors.date}
            />
          </Field>
        </div>
        <Field label="Note" htmlFor={`${id}-note`} optional>
          <Input id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Past paper Q1 to Q4" maxLength={240} />
        </Field>
      </form>
    </Dialog>
  )
}
