import { useId, useMemo, useState, type FormEvent } from 'react'
import { useAssessmentMutations, useCourseMutations, useEventMutations, useTopicMutations } from '../lib/data'
import { addDays, formatTime, parseSyllabus, today } from '../lib/domain'
import type { Assessment, AssessmentKind, CalendarEvent, ColorKey, Course, Topic } from '../lib/data/types'
import { Button, Dialog, Field, Input, Select, Textarea } from '../ui/primitives'
import { useToast } from '../ui/toastContext'
import { Icon } from '../ui/Icon'
import { PickerField } from '../ui/PickerField'
import { formatDate } from '../app/format'
import './forms.css'

const COLORS: ColorKey[] = ['ember', 'amber', 'moss', 'teal', 'sky', 'iris', 'orchid', 'slate']
const KINDS: AssessmentKind[] = ['assignment', 'exam', 'quiz', 'project', 'task']

function ColorPicker({ value, onChange }: { value: ColorKey; onChange: (c: ColorKey) => void }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Color">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          title={c}
          data-hue={c}
          className="swatch"
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  )
}

const emptyToNull = (s: string) => (s.trim() ? s.trim() : null)

// ---------- course ----------

export function CourseDialog(props: Parameters<typeof CourseDialogBody>[0]) {
  return props.open ? <CourseDialogBody {...props} /> : null
}

function CourseDialogBody({
  open,
  onClose,
  course,
  usedColors = [],
  onSaved,
}: {
  open: boolean
  onClose: () => void
  course?: Course
  usedColors?: ColorKey[]
  onSaved?: (c: Course) => void
}) {
  const id = useId()
  const m = useCourseMutations()
  const toast = useToast()
  const [code, setCode] = useState(course?.code ?? '')
  const [name, setName] = useState(course?.name ?? '')
  const [color, setColor] = useState<ColorKey>(() => course?.color ?? COLORS.find((c) => !usedColors.includes(c)) ?? 'amber')
  const [term, setTerm] = useState(course?.term ?? '')
  const [instructor, setInstructor] = useState(course?.instructor ?? '')
  const [email, setEmail] = useState(course?.email ?? '')
  const [website, setWebsite] = useState(course?.website ?? '')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})


  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!code.trim()) errs.code = 'Add a short code, like CSC369.'
    if (!name.trim()) errs.name = 'Add the course name.'
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'That email looks off.'
    if (website.trim() && !/^https?:\/\//i.test(website.trim())) errs.website = 'Start the link with https://'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    const input = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      color,
      term: emptyToNull(term),
      instructor: emptyToNull(instructor),
      email: emptyToNull(email),
      website: emptyToNull(website),
      status: course?.status ?? ('active' as const),
    }
    try {
      const saved = course ? await m.update(course.id, input) : await m.create(input)
      toast.show({ message: course ? 'Course saved' : `Added ${input.code}` })
      onSaved?.(saved)
      onClose()
    } catch (err) {
      toast.error(err, 'Could not save the course.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={course ? `Edit ${course.code}` : 'New course'}
      description={course ? undefined : 'Start with the code and name. You can add topics and deadlines next.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={`${id}-form`} loading={busy}>
            {course ? 'Save' : 'Add course'}
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} className="form-grid" onSubmit={submit} noValidate>
        <div className="form-row form-row--code">
          <Field label="Code" htmlFor={`${id}-code`} error={errors.code}>
            <Input id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="CSC369" className="t-mono" autoFocus maxLength={20} />
          </Field>
          <Field label="Name" htmlFor={`${id}-name`} error={errors.name}>
            <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Operating Systems" maxLength={120} />
          </Field>
        </div>
        <Field label="Color" htmlFor={`${id}-color`}>
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        <div className="form-row">
          <Field label="Instructor" htmlFor={`${id}-inst`} optional>
            <Input id={`${id}-inst`} value={instructor} onChange={(e) => setInstructor(e.target.value)} placeholder="Prof. Demke Brown" />
          </Field>
          <Field label="Term" htmlFor={`${id}-term`} optional>
            <Input id={`${id}-term`} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Fall 2026" />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Email" htmlFor={`${id}-email`} optional error={errors.email}>
            <Input id={`${id}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="instructor@school.edu" />
          </Field>
          <Field label="Course website" htmlFor={`${id}-web`} optional error={errors.website}>
            <Input id={`${id}-web`} type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
          </Field>
        </div>
      </form>
    </Dialog>
  )
}

// ---------- deadline ----------

export function AssessmentDialog(props: Parameters<typeof AssessmentDialogBody>[0]) {
  return props.open ? <AssessmentDialogBody {...props} /> : null
}

function AssessmentDialogBody({
  open,
  onClose,
  assessment,
  courses,
  topics,
  defaultCourseId,
  defaultDate,
}: {
  open: boolean
  onClose: () => void
  assessment?: Assessment
  courses: Course[]
  topics: Topic[]
  defaultCourseId?: string | null
  defaultDate?: string
}) {
  const id = useId()
  const m = useAssessmentMutations()
  const toast = useToast()
  const [title, setTitle] = useState(assessment?.title ?? '')
  const [kind, setKind] = useState<AssessmentKind>(assessment?.kind ?? 'assignment')
  const [courseId, setCourseId] = useState<string>(assessment?.courseId ?? defaultCourseId ?? '')
  const [dueDate, setDueDate] = useState(() => assessment?.dueDate ?? defaultDate ?? addDays(today(new Date()), 7))
  const [dueTime, setDueTime] = useState(assessment?.dueTime ?? '')
  const [weight, setWeight] = useState(assessment?.weight != null ? String(assessment.weight) : '')
  const [notes, setNotes] = useState(assessment?.notes ?? '')
  const [topicIds, setTopicIds] = useState<string[]>(assessment?.topicIds ?? [])
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})


  const courseTopics = useMemo(() => topics.filter((t) => t.courseId === courseId && t.confidence !== 'retired'), [topics, courseId])
  const [topicQuery, setTopicQuery] = useState('')
  const shownTopics = courseTopics.filter((t) => !topicQuery.trim() || t.title.toLowerCase().includes(topicQuery.trim().toLowerCase()))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Give it a name.'
    if (!dueDate) errs.dueDate = 'Pick the due date.'
    const w = weight.trim() ? Number(weight) : null
    if (w !== null && (Number.isNaN(w) || w < 0 || w > 100)) errs.weight = 'Use a number from 0 to 100.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    const input = {
      title: title.trim(),
      kind,
      courseId: courseId || null,
      dueDate,
      dueTime: dueTime || null,
      weight: w,
      notes,
      topicIds: topicIds.filter((t) => courseTopics.some((x) => x.id === t)),
      done: assessment?.done ?? false,
    }
    try {
      if (assessment) await m.update(assessment.id, input)
      else await m.create(input)
      toast.show({ message: assessment ? 'Deadline saved' : `Added ${input.title}` })
      onClose()
    } catch (err) {
      toast.error(err, 'Could not save the deadline.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={assessment ? 'Edit deadline' : 'New deadline'}
      description="Moving study sessions on the calendar never changes a deadline. Edit it here if the date changes."
      footer={
        <>
          {assessment ? (
            <Button
              variant="danger"
              icon="trash"
              onClick={async () => {
                try {
                  await m.remove(assessment.id)
                  toast.show({ message: 'Deadline deleted' })
                  onClose()
                } catch (err) {
                  toast.error(err)
                }
              }}
            >
              Delete
            </Button>
          ) : null}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={`${id}-form`} loading={busy}>
            {assessment ? 'Save' : 'Add deadline'}
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} className="form-grid" onSubmit={submit} noValidate>
        <Field label="Title" htmlFor={`${id}-title`} error={errors.title}>
          <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Problem set 3" autoFocus maxLength={120} />
        </Field>
        <div className="form-row">
          <Field label="Type" htmlFor={`${id}-kind`}>
            <Select id={`${id}-kind`} value={kind} onChange={(e) => setKind(e.target.value as AssessmentKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k[0].toUpperCase() + k.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Course" htmlFor={`${id}-course`}>
            <Select id={`${id}-course`} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">No course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="form-row form-row--3">
          <Field label="Due" htmlFor={`${id}-date`} error={errors.dueDate}>
            <PickerField id={`${id}-date`} type="date" icon="calendar" label="Due date" value={dueDate} display={dueDate ? formatDate(dueDate, { weekday: 'short', month: 'short', day: 'numeric' }) : ''} placeholder="Pick a day" onChange={(v) => setDueDate(v)} />
          </Field>
          <Field label="Time" htmlFor={`${id}-time`} optional>
            <PickerField id={`${id}-time`} type="time" icon="clock" label="Due time" value={dueTime} display={dueTime ? formatTime(dueTime) : ''} placeholder="Any time" onChange={(v) => setDueTime(v)} onClear={() => setDueTime('')} />
          </Field>
          <Field label="% of final grade" htmlFor={`${id}-w`} optional error={errors.weight}>
            <span className="suffix-field">
              <Input id={`${id}-w`} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className="t-mono" />
              <span className="suffix-field__suffix" aria-hidden>
                %
              </span>
            </span>
          </Field>
        </div>
        {courseTopics.length ? (
          <details className="link-topics" open={(assessment?.topicIds.length ?? 0) > 0}>
            <summary className="link-topics__summary">
              <span className="link-topics__label">Link topics</span>
              <span className="link-topics__count">
                {topicIds.length ? `${topicIds.length} linked` : 'optional'}
              </span>
              <Icon name="chevronDown" size={15} className="link-topics__chev" />
            </summary>
            <p className="field__hint">Linked topics climb the review queue as this date gets close.</p>
            <div className="link-topics__tools">
              <Input value={topicQuery} onChange={(e) => setTopicQuery(e.target.value)} placeholder={`Search ${courseTopics.length} topics`} aria-label="Search topics" className="topic-filter" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setTopicIds((ids) => (shownTopics.every((t) => ids.includes(t.id)) ? ids.filter((x) => !shownTopics.some((t) => t.id === x)) : [...new Set([...ids, ...shownTopics.map((t) => t.id)])]))
                }
              >
                {shownTopics.length && shownTopics.every((t) => topicIds.includes(t.id)) ? 'Clear' : 'Select all'}
              </Button>
            </div>
            <div className="topic-picks" id={`${id}-topics`}>
              {shownTopics.map((t) => {
                const on = topicIds.includes(t.id)
                return (
                  <button
                    type="button"
                    key={t.id}
                    className="topic-pick"
                    aria-pressed={on}
                    onClick={() => setTopicIds((ids) => (on ? ids.filter((x) => x !== t.id) : [...ids, t.id]))}
                  >
                    <span className="topic-pick__box" aria-hidden>
                      {on ? <Icon name="check" size={12} strokeWidth={2.6} /> : null}
                    </span>
                    {t.title}
                  </button>
                )
              })}
            </div>
          </details>
        ) : null}
        <Field label="Notes" htmlFor={`${id}-notes`} optional>
          <Textarea id={`${id}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Allowed aids, room, submission link…" />
        </Field>
      </form>
    </Dialog>
  )
}

// ---------- personal event ----------

export function EventDialog(props: Parameters<typeof EventDialogBody>[0]) {
  return props.open ? <EventDialogBody {...props} /> : null
}

function EventDialogBody({
  open,
  onClose,
  event,
  defaultDate,
}: {
  open: boolean
  onClose: () => void
  event?: CalendarEvent
  defaultDate?: string
}) {
  const id = useId()
  const m = useEventMutations()
  const toast = useToast()
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(() => event?.date ?? defaultDate ?? today(new Date()))
  const [start, setStart] = useState(event?.startTime ?? '')
  const [end, setEnd] = useState(event?.endTime ?? '')
  const [color, setColor] = useState<ColorKey>(event?.color ?? 'slate')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)


  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return setError('Give it a name.')
    if (start && end && end <= start) return setError('End after it starts.')
    setBusy(true)
    const input = { title: title.trim(), date, startTime: start || null, endTime: end || null, color, done: event?.done ?? false }
    try {
      if (event) await m.update(event.id, input)
      else await m.create(input)
      onClose()
    } catch (err) {
      toast.error(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={event ? 'Edit event' : 'New event'}
      description="Work shifts, club meetings, anything that takes time away from study."
      footer={
        <>
          {event ? (
            <Button
              variant="danger"
              icon="trash"
              onClick={async () => {
                try {
                  await m.remove(event.id)
                  onClose()
                } catch (err) {
                  toast.error(err)
                }
              }}
            >
              Delete
            </Button>
          ) : null}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={`${id}-form`} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} className="form-grid" onSubmit={submit} noValidate>
        <Field label="Title" htmlFor={`${id}-t`} error={error}>
          <Input id={`${id}-t`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Shift at the library" autoFocus />
        </Field>
        <div className="form-row form-row--3">
          <Field label="Date" htmlFor={`${id}-d`}>
            <PickerField id={`${id}-d`} type="date" icon="calendar" label="Date" value={date} display={date ? formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' }) : ''} placeholder="Pick a day" onChange={(v) => setDate(v)} />
          </Field>
          <Field label="Start" htmlFor={`${id}-s`} optional>
            <PickerField id={`${id}-s`} type="time" icon="clock" label="Start" value={start} display={start ? formatTime(start) : ''} placeholder="Any time" onChange={(v) => setStart(v)} onClear={() => setStart('')} />
          </Field>
          <Field label="End" htmlFor={`${id}-e`} optional>
            <PickerField id={`${id}-e`} type="time" icon="clock" label="End" value={end} display={end ? formatTime(end) : ''} placeholder="Any time" onChange={(v) => setEnd(v)} onClear={() => setEnd('')} />
          </Field>
        </div>
        <Field label="Color" htmlFor={`${id}-c`}>
          <ColorPicker value={color} onChange={setColor} />
        </Field>
      </form>
    </Dialog>
  )
}

// ---------- syllabus import ----------

type DraftRow = { key: string; include: boolean; kind: 'topic' | AssessmentKind; title: string; date: string; low: boolean }

const SAMPLE = `Week 1 (Sep 8): Introduction and OS structure
Week 2 (Sep 15): Processes and threads
Sep 22 - CPU scheduling
Assignment 1 due Oct 3
Lecture 6: Paging and TLBs
Midterm Oct 15`

export function SyllabusDialog(props: Parameters<typeof SyllabusDialogBody>[0]) {
  return props.open ? <SyllabusDialogBody {...props} /> : null
}

function SyllabusDialogBody({ open, onClose, course, startPosition }: { open: boolean; onClose: () => void; course: Course; startPosition: number }) {
  const id = useId()
  const topicsM = useTopicMutations()
  const assessM = useAssessmentMutations()
  const toast = useToast()
  const [text, setText] = useState('')
  const [rows, setRows] = useState<DraftRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [topicsSaved, setTopicsSaved] = useState(false)


  const parse = () => {
    const drafts = parseSyllabus(text, { year: new Date().getFullYear(), courseId: course.id })
    const order = (r: DraftRow) => (r.kind !== 'topic' && !r.date ? 0 : r.low ? 1 : 2)
    setRows(
      drafts
        .map((d, i) => ({
        key: `${i}`,
        include: true,
        kind: d.kind,
        title: d.title,
        date: d.date ?? '',
        low: d.confidence === 'low',
      }))
        .sort((a, b) => order(a) - order(b)),
    )
  }

  const chosen = rows?.filter((r) => r.include && r.title.trim()) ?? []
  const nTopics = chosen.filter((r) => r.kind === 'topic').length
  const nDue = chosen.length - nTopics
  const undatedTopics = chosen.filter((r) => r.kind === 'topic' && !r.date).length
  const undatedDues = chosen.filter((r) => r.kind !== 'topic' && !r.date).length

  const save = async () => {
    setBusy(true)
    try {
      const topics = chosen.filter((r) => r.kind === 'topic')
      const dues = chosen.filter((r) => r.kind !== 'topic')
      if (topics.length && !topicsSaved) {
        await topicsM.createMany(
          topics.map((r, i) => ({
            courseId: course.id,
            title: r.title.trim(),
            details: null,
            notes: '',
            plannedDate: r.date || null,
            plannedStart: null,
            plannedMinutes: null,
            confidence: 'unrated' as const,
            position: startPosition + i,
          })),
        )
        setTopicsSaved(true)
      }
      if (dues.length) {
        await assessM.createMany(
          dues.map((r) => ({
            courseId: course.id,
            title: r.title.trim(),
            kind: r.kind as AssessmentKind,
            dueDate: r.date,
            dueTime: null,
            weight: null,
            done: false,
            notes: '',
            topicIds: [],
          })),
        )
      }
      toast.show({ message: `Added ${nTopics} topics and ${nDue} deadlines to ${course.code}` })
      onClose()
    } catch (err) {
      toast.error(err, topicsSaved ? 'Topics were added, but the deadlines failed. Try again to add just the deadlines.' : 'Could not import. Nothing was saved; try again.')
    } finally {
      setBusy(false)
    }
  }

  const update = (key: string, patch: Partial<DraftRow>) => setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={rows ? 'Check what we found' : `Paste the ${course.code} syllabus`}
      description={
        rows
          ? 'Fix anything that looks wrong. A type with an amber outline is the parser’s guess.'
          : 'Copy the schedule from the course page or PDF. One line per lecture or deadline works best.'
      }
      footer={
        rows ? (
          <>
            <Button variant="ghost" icon="arrowLeft" onClick={() => setRows(null)}>
              Back
            </Button>
            <span className="spacer" />
            {undatedDues ? (
              <button
                type="button"
                className="import-warn"
                onClick={() => {
                  const el = document.querySelector<HTMLInputElement>('.import-date[data-missing="hard"] input')
                  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                  el?.focus()
                }}
              >
                {undatedDues === 1 ? '1 deadline needs a date. Show it' : `${undatedDues} deadlines need a date. Show the first`}
              </button>
            ) : undatedTopics ? (
              <span className="import-note">{undatedTopics === 1 ? '1 topic has no date yet' : `${undatedTopics} topics have no date yet`}</span>
            ) : null}
            <Button variant="primary" onClick={save} loading={busy} disabled={!chosen.length || undatedDues > 0}>
              Add {nTopics} {nTopics === 1 ? 'topic' : 'topics'}
              {nDue ? ` and ${nDue} ${nDue === 1 ? 'deadline' : 'deadlines'}` : ''}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setText(SAMPLE)}>
              Try an example
            </Button>
            <span className="spacer" />
            <Button variant="primary" onClick={parse} disabled={!text.trim()} iconRight="arrowRight">
              Read syllabus
            </Button>
          </>
        )
      }
    >
      {rows ? (
        rows.length ? (
          <div className="import-table" role="table" aria-label="Parsed syllabus">
            <div className="import-row import-row--head" role="row">
              <span role="columnheader">
                <span className="sr-only">Include</span>
              </span>
              <span role="columnheader">Type</span>
              <span role="columnheader">Title</span>
              <span role="columnheader">Date</span>
            </div>
            {rows.map((r) => (
              <div key={r.key} className="import-row" role="row" data-off={!r.include || undefined}>
                <span role="cell">
                  <input type="checkbox" className="import-check" checked={r.include} aria-label={`Include ${r.title}`} onChange={(e) => update(r.key, { include: e.target.checked })} />
                </span>
                <span role="cell" className="import-kind" data-guess={r.low || undefined}>
                  <span className="import-cell-label">Type{r.low ? ' · a guess, check it' : ''}</span>
                  {r.low ? <span className="import-guess">check type</span> : null}
                  <Select value={r.kind} aria-label="Type" onChange={(e) => update(r.key, { kind: e.target.value as DraftRow['kind'] })}>
                    <option value="topic">Topic</option>
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k[0].toUpperCase() + k.slice(1)}
                      </option>
                    ))}
                  </Select>
                </span>
                <span role="cell" className="import-title">
                  <span className="import-cell-label">Title</span>
                  <Input value={r.title} aria-label="Title" onChange={(e) => update(r.key, { title: e.target.value })} />

                </span>
                <span role="cell" className="import-date" data-missing={!r.date ? (r.kind === 'topic' ? 'soft' : 'hard') : undefined}>
                  <span className="import-cell-label">{r.date ? 'Date' : r.kind === 'topic' ? 'Date · optional, stays unscheduled' : 'Date · required'}</span>
                  <PickerField type="date" icon="calendar" label="Date" value={r.date} display={r.date ? formatDate(r.date, { month: 'short', day: 'numeric' }) : ''} placeholder={r.kind === 'topic' ? 'No date' : 'Needs a date'} invalid={!r.date && r.kind !== 'topic'} onChange={(v) => update(r.key, { date: v })} onClear={() => update(r.key, { date: '' })} />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="t-muted">We could not find any lines to import. Try one lecture or deadline per line.</p>
        )
      ) : (
        <Field label="Syllabus schedule" htmlFor={`${id}-text`} hint="Dates like “Sep 22”, “10/03” or “Week 3” work. Lines with “assignment”, “quiz”, “midterm” or “exam” become deadlines.">
          <Textarea id={`${id}-text`} value={text} onChange={(e) => setText(e.target.value)} rows={10} className="t-mono import-text" placeholder={SAMPLE} autoFocus />
        </Field>
      )}
    </Dialog>
  )
}
