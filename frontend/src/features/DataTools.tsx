import { useRef, useState, type ChangeEvent } from 'react'
import { useAssessmentMutations, useCourseMutations, useEventMutations, useSessionMutations, useTopicMutations, useWorkspace } from '../lib/data'
import { chunk, MAX_IMPORT_BYTES, planImport, planIsEmpty, type ImportPlan } from '../lib/data/backup'
import { buildIcs } from '../lib/domain/ics'
import { formatMinutes } from '../lib/domain/stats'
import { DAILY_GOAL_CHOICES, setPrefs, usePrefs } from '../app/prefs'
import { Button, Dialog, Select } from '../ui/primitives'
import { errorMessage, useToast } from '../ui/toastContext'
import './datatools.css'

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Settings rows: daily goal, calendar file, and import of an exported JSON file. */
export function DataTools() {
  const { data: ws } = useWorkspace()
  const prefs = usePrefs()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const courseM = useCourseMutations()
  const topicM = useTopicMutations()
  const assessmentM = useAssessmentMutations()
  const eventM = useEventMutations()
  const sessionM = useSessionMutations()

  const exportCalendar = () => {
    if (!ws) return
    const ics = buildIcs(ws, new Date())
    if (!ics.deadlines && !ics.studyBlocks && !ics.events) {
      toast.show({ message: 'Nothing to export yet. Add a deadline or plan a topic first.' })
      return
    }
    download(`lockin-calendar-${new Date().toISOString().slice(0, 10)}.ics`, ics.text, 'text/calendar')
    toast.show({
      message: `Calendar file saved: ${[
        ics.deadlines ? count(ics.deadlines, 'deadline') : null,
        ics.studyBlocks ? count(ics.studyBlocks, 'planned topic') : null,
        ics.events ? count(ics.events, 'event') : null,
      ]
        .filter(Boolean)
        .join(', ')}`,
    })
  }

  const chooseFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !ws) return
    setFileError(null)
    if (file.size > MAX_IMPORT_BYTES) {
      setFileError('That file is too large to be a LockIn export.')
      return
    }
    try {
      const result = planImport(await file.text(), ws)
      if (!result.ok) {
        setFileError(result.error)
        return
      }
      setFileName(file.name)
      setPlan(result.plan)
    } catch {
      setFileError('That file could not be read.')
    }
  }

  const runImport = async (p: ImportPlan) => {
    const reviewed = p.topics.filter((t) => t.lastReviewedAt).length
    const total = p.courses.length + p.topics.length + reviewed + p.assessments.length + p.events.length + p.sessions.length
    let done = 0
    const step = (n = 1) => {
      done += n
      setProgress({ done, total })
    }
    setProgress({ done: 0, total })
    try {
      const courseIds = new Map(Object.entries(p.existingCourseIds))
      for (const c of p.courses) {
        const created = await courseM.create({
          code: c.code, name: c.name, color: c.color, term: c.term, instructor: c.instructor, email: c.email, website: c.website, status: c.status,
        })
        courseIds.set(c.id, created.id)
        step()
      }

      const topicIds = new Map<string, string>()
      for (const batch of chunk(p.topics, 50)) {
        const created = await topicM.createMany(
          batch.map((t) => ({
            courseId: courseIds.get(t.courseId) ?? t.courseId,
            title: t.title,
            details: t.details,
            notes: t.notes,
            plannedDate: t.plannedDate,
            plannedStart: t.plannedStart,
            plannedMinutes: t.plannedMinutes,
            confidence: t.confidence,
            position: t.position,
            resources: t.resources.map((r) => ({ label: r.label, url: r.url })),
          })),
        )
        // Match by position in the reply, and fall back to title if the server reordered it.
        const unclaimed = new Set(created.map((row) => row.id))
        batch.forEach((t, i) => {
          const same = (row: (typeof created)[number] | undefined) => !!row && unclaimed.has(row.id) && row.title === t.title.trim() && row.position === t.position
          const match = same(created[i]) ? created[i] : created.find(same)
          if (!match) return
          unclaimed.delete(match.id)
          topicIds.set(t.id, match.id)
        })
        step(batch.length)
      }
      // Creating a topic cannot set its last review date, so restore it afterwards.
      for (const t of p.topics) {
        if (!t.lastReviewedAt) continue
        const id = topicIds.get(t.id)
        if (id) await topicM.update(id, { lastReviewedAt: t.lastReviewedAt })
        step()
      }

      for (const batch of chunk(p.assessments, 50)) {
        await assessmentM.createMany(
          batch.map((a) => ({
            courseId: a.courseId ? courseIds.get(a.courseId) ?? null : null,
            title: a.title,
            kind: a.kind,
            dueDate: a.dueDate,
            dueTime: a.dueTime,
            weight: a.weight,
            done: a.done,
            notes: a.notes,
            topicIds: a.topicIds.map((id) => topicIds.get(id)).filter((id): id is string => !!id),
          })),
        )
        step(batch.length)
      }

      for (const ev of p.events) {
        await eventM.create({ title: ev.title, date: ev.date, startTime: ev.startTime, endTime: ev.endTime, color: ev.color, done: ev.done })
        step()
      }

      for (const x of p.sessions) {
        await sessionM.create({
          topicId: x.topicId ? topicIds.get(x.topicId) ?? null : null,
          courseId: x.courseId ? courseIds.get(x.courseId) ?? null : null,
          startedAt: x.startedAt,
          minutes: x.minutes,
          note: x.note,
        })
        step()
      }

      toast.show({ message: `Import finished: ${count(p.courses.length, 'course')}, ${count(p.topics.length, 'topic')}, ${count(p.assessments.length, 'deadline')} added` })
      setPlan(null)
    } catch (err) {
      toast.show({
        tone: 'error',
        message: `Import stopped after ${done} of ${total} items: ${errorMessage(err, 'something went wrong')} What was added stays, and nothing you had before was changed.`,
      }, 12_000)
      setPlan(null)
    } finally {
      setProgress(null)
    }
  }

  const empty = plan ? planIsEmpty(plan) : false
  const busy = progress !== null
  const skippedParts = plan
    ? [
        plan.skipped.courses ? `${count(plan.skipped.courses, 'course')} (with ${count(plan.skipped.topics, 'topic')})` : null,
        plan.skipped.assessments ? count(plan.skipped.assessments, 'deadline') : null,
        plan.skipped.events ? count(plan.skipped.events, 'event') : null,
        plan.skipped.sessions ? count(plan.skipped.sessions, 'study session') : null,
      ].filter(Boolean)
    : []

  return (
    <>
      <section className="srow">
        <div className="srow__text">
          <h2 className="srow__title">Daily goal</h2>
          <p className="srow__body">Minutes of study to aim for each day. Today shows your progress. Saved on this device only.</p>
        </div>
        <div className="srow__control">
          <Select
            aria-label="Daily study goal"
            className="dtools__select"
            value={prefs.dailyGoalMinutes === null ? '' : String(prefs.dailyGoalMinutes)}
            onChange={(e) => setPrefs({ dailyGoalMinutes: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">No goal</option>
            {[...new Set([...DAILY_GOAL_CHOICES, ...(prefs.dailyGoalMinutes ? [prefs.dailyGoalMinutes] : [])])]
              .sort((a, b) => a - b)
              .map((m) => (
                <option key={m} value={m}>
                  {formatMinutes(m)} a day
                </option>
              ))}
          </Select>
        </div>
      </section>

      <section className="srow">
        <div className="srow__text">
          <h2 className="srow__title">Break length</h2>
          <p className="srow__body">After you save a focus session, LockIn offers a break this long and chimes when it ends.</p>
        </div>
        <div className="srow__control">
          <Select
            aria-label="Break length"
            className="dtools__select"
            value={String(prefs.breakMinutes)}
            onChange={(e) => setPrefs({ breakMinutes: Number(e.target.value) })}
          >
            {[...new Set([5, 10, 15, 20, 30, prefs.breakMinutes])]
              .sort((a, b) => a - b)
              .map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
          </Select>
        </div>
      </section>

      <section className="srow">
        <div className="srow__text">
          <h2 className="srow__title">Calendar file</h2>
          <p className="srow__body">Download open deadlines, planned topics and your events as an .ics file for Google Calendar, Apple Calendar or Outlook.</p>
        </div>
        <div className="srow__control">
          <Button variant="secondary" icon="calendar" onClick={exportCalendar} disabled={!ws}>
            Export calendar
          </Button>
        </div>
      </section>

      <section className="srow">
        <div className="srow__text">
          <h2 className="srow__title">Import</h2>
          <p className="srow__body">Add the contents of a file made with Export data. It only adds. Nothing you have now is changed or deleted.</p>
          {fileError ? (
            <p className="dtools__error" role="alert">
              {fileError}
            </p>
          ) : null}
        </div>
        <div className="srow__control">
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden onChange={chooseFile} />
          <Button variant="secondary" icon="import" onClick={() => fileRef.current?.click()} disabled={!ws}>
            Import data
          </Button>
        </div>
      </section>

      <Dialog
        open={plan !== null}
        onClose={() => {
          if (!busy) setPlan(null)
        }}
        size="sm"
        title={empty ? 'Nothing new to import' : 'Import this file?'}
        description={fileName}
        footer={
          <>
            <span className="spacer" />
            <Button variant="ghost" onClick={() => setPlan(null)} disabled={busy}>
              {empty ? 'Close' : 'Cancel'}
            </Button>
            {plan && !empty ? (
              <Button variant="primary" icon="import" loading={busy} onClick={() => runImport(plan)}>
                {busy && progress ? `Importing ${progress.done} of ${progress.total}` : 'Import'}
              </Button>
            ) : null}
          </>
        }
      >
        {plan ? (
          <div className="dtools__plan">
            {empty ? (
              <p>Everything in this file is already here.</p>
            ) : (
              <>
                <p>This will add:</p>
                <ul className="dtools__list">
                  {plan.courses.length ? <li>{count(plan.courses.length, 'course')}</li> : null}
                  {plan.topics.length ? <li>{count(plan.topics.length, 'topic')}, with notes, links, confidence and last review date</li> : null}
                  {plan.assessments.length ? <li>{count(plan.assessments.length, 'deadline')}</li> : null}
                  {plan.events.length ? <li>{count(plan.events.length, 'calendar event')}</li> : null}
                  {plan.sessions.length ? <li>{count(plan.sessions.length, 'study session')}</li> : null}
                </ul>
                <p>Nothing you have now is replaced, changed or deleted.</p>
              </>
            )}
            {skippedParts.length ? <p className="t-faint">Already here, so skipped: {skippedParts.join(', ')}.</p> : null}
            {plan.reviewsInFile && !empty ? (
              <p className="t-faint">The file's rating history ({count(plan.reviewsInFile, 'rating')}) is not imported. Each topic keeps its current confidence.</p>
            ) : null}
          </div>
        ) : (
          <span className="sr-only">Import</span>
        )}
      </Dialog>
    </>
  )
}
