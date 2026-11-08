import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useIsPhone } from '../app/useMedia'
import { withoutCode } from '../app/titles'
import { Link, useSearchParams } from 'react-router-dom'
import { useTopicMutations } from '../lib/data'
import { addDays, formatTime, monthMatrix, today, weekDays } from '../lib/domain'
import { formatDate } from '../app/format'
import type { Assessment, CalendarEvent, Topic } from '../lib/data/types'
import { useNow, useStudy, type StudyIndex } from '../app/useStudy'
import { AssessmentDialog, EventDialog } from '../features/forms'
import { ConfidenceGlyph } from '../ui/confidence'
import { Icon } from '../ui/Icon'
import { Menu } from '../ui/Menu'
import { Button, IconButton, Segmented } from '../ui/primitives'
import { useToast } from '../ui/toastContext'
import './calendar.css'

type View = 'week' | 'month'
const HOUR_START = 7
const HOUR_END = 23
const HOUR_PX = 52

export default function Calendar() {
  const { data } = useStudy()
  const now = useNow()
  if (!data) return <div className="page" aria-busy="true" />
  return <CalendarView s={data} now={now} />
}

function isoTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function CalendarView({ s, now }: { s: StudyIndex; now: Date }) {
  const phone = useIsPhone()
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'month' ? 'month' : 'week'
  const day = today(now)
  const raw = params.get('d')
  const anchor = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(new Date(`${raw}T00:00:00`).getTime()) ? raw : day
  const [eventDialog, setEventDialog] = useState<{ event?: CalendarEvent; date?: string } | null>(null)
  const [dueDialog, setDueDialog] = useState<{ a?: Assessment; date?: string } | null>(null)
  const [unplannedOpen, setUnplannedOpen] = useState(false)
  const [picked, setPicked] = useState(day)
  const { update } = useTopicMutations()
  const toast = useToast()

  const set = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: true })
  }
  const step = (dir: number) => {
    if (view === 'week') set({ d: addDays(anchor, dir * 7) })
    else {
      const [y, m] = anchor.split('-').map(Number)
      const d = new Date(y, m - 1 + dir, 1)
      set({ d: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` })
    }
  }

  const byDay = useMemo(() => {
    const map = new Map<string, { topics: Topic[]; blocks: Topic[]; dues: Assessment[]; events: CalendarEvent[] }>()
    const get = (d: string) => {
      if (!map.has(d)) map.set(d, { topics: [], blocks: [], dues: [], events: [] })
      return map.get(d)!
    }
    for (const t of s.ws.topics) {
      if (!t.plannedDate || t.confidence === 'retired') continue
      if (s.courseById.get(t.courseId)?.status !== 'active') continue
      if (t.plannedStart) get(t.plannedDate).blocks.push(t)
      else get(t.plannedDate).topics.push(t)
    }
    for (const a of s.ws.assessments) get(a.dueDate).dues.push(a)
    for (const e of s.ws.events) get(e.date).events.push(e)
    return map
  }, [s])

  const unplanned = useMemo(
    () =>
      s.ws.topics.filter(
        (t) => !t.plannedDate && t.confidence !== 'retired' && s.courseById.get(t.courseId)?.status === 'active',
      ),
    [s],
  )

  // Drag a topic onto a day or a time slot. Deadlines are not draggable: they are fixed.
  const moveTopic = async (topicId: string, date: string, time: string | null) => {
    const t = s.topicById.get(topicId)
    if (!t) return
    const before = { plannedDate: t.plannedDate, plannedStart: t.plannedStart, plannedMinutes: t.plannedMinutes }
    const patch = time
      ? { plannedDate: date, plannedStart: new Date(`${date}T${time}:00`).toISOString(), plannedMinutes: t.plannedMinutes ?? 60 }
      : { plannedDate: date, plannedStart: null, plannedMinutes: null }
    try {
      await update(t.id, patch)
      toast.show({
        message: `${t.title} → ${formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}${time ? `, ${formatTime(time)}` : ''}`,
        action: { label: 'Undo', run: () => update(t.id, before).then(() => undefined) },
      })
    } catch (err) {
      toast.error(err, 'Could not move that topic.')
    }
  }

  const label =
    view === 'week'
      ? (() => {
          const days = weekDays(anchor)
          const a = days[0]
          const b = days[6]
          const sameMonth = a.slice(0, 7) === b.slice(0, 7)
          return sameMonth
            ? `${formatDate(a, { month: 'long' })} ${formatDate(a, { day: 'numeric' })} to ${formatDate(b, { day: 'numeric' })}`
            : `${formatDate(a, { month: 'short', day: 'numeric' })} to ${formatDate(b, { month: 'short', day: 'numeric' })}`
        })()
      : formatDate(anchor, { month: 'long', year: 'numeric' })

  return (
    <div className="page cal">
      <header className="page-head cal__head">
        <div>
          <p className="t-eyebrow page-head__eyebrow">Calendar</p>
          <h1 className="page-head__title t-display">{label}</h1>
        </div>
        <div className="page-head__actions cal__actions">
          <div className="cal__nav">
            <IconButton icon="chevronLeft" label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={() => step(-1)} variant="secondary" />
            <Button onClick={() => set({ d: null })} aria-current={anchor === day ? 'date' : undefined}>
              Today
            </Button>
            <IconButton icon="chevronRight" label={view === 'week' ? 'Next week' : 'Next month'} onClick={() => step(1)} variant="secondary" />
          </div>
          <Segmented<View>
            label="View"
            value={view}
            onChange={(v) => set({ view: v === 'week' ? null : v })}
            options={[
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
          <Menu
            label="Add"
            trigger={(p) => (
              <Button {...p} variant="primary" icon="plus" aria-label="Add" className="cal__add">
                <span className="cal__add-label">Add</span>
              </Button>
            )}
            items={[
              { label: 'Deadline', icon: 'flag', onSelect: () => setDueDialog({ date: anchor }) },
              { label: 'Personal event', icon: 'calendar', onSelect: () => setEventDialog({ date: anchor }) },
            ]}
          />
        </div>
      </header>

      <div className="cal__legend">
        <span>
          <span className="lg lg--topic" /> Planned topic, drag to move
        </span>
        <span>
          <span className="lg lg--due" /> Deadline, fixed
        </span>
        <span>
          <span className="lg lg--event" /> Your events
        </span>
        {unplanned.length ? (
          <button type="button" className="cal__unplanned-btn" aria-expanded={unplannedOpen} onClick={() => setUnplannedOpen((o) => !o)}>
            <Icon name="grip" size={14} /> {unplanned.length} topics without a date
          </button>
        ) : null}
      </div>

      {unplannedOpen && unplanned.length ? (
        <div className="cal__tray" aria-label="Topics without a date">
          {unplanned.map((t) => (
            <TopicChip key={t.id} t={t} s={s} />
          ))}
        </div>
      ) : null}

      {view === 'week' && phone ? (
        <Agenda s={s} anchor={anchor} day={day} byDay={byDay} onEditDue={(a) => setDueDialog({ a })} onEditEvent={(e) => setEventDialog({ event: e })} />
      ) : view === 'week' ? (
        <Week s={s} anchor={anchor} day={day} now={now} byDay={byDay} onMove={moveTopic} onEditDue={(a) => setDueDialog({ a })} onEditEvent={(e) => setEventDialog({ event: e })} onNewEvent={(date) => setEventDialog({ date })} />
      ) : (
        <>
          <Month
            s={s}
            anchor={anchor}
            day={day}
            byDay={byDay}
            selected={phone ? picked : null}
            onMove={moveTopic}
            onPick={(d) => (phone ? setPicked(d) : set({ view: null, d }))}
            onEditDue={(a) => setDueDialog({ a })}
          />
          {phone ? (
            <div className="month__agenda">
              <p className="month__key t-faint">
                <span className="month__key-dot" /> topic <span className="month__key-box" /> deadline <span className="month__key-ring" /> your event · tap a day
              </p>
              <Agenda s={s} anchor={picked} days={[picked]} day={day} byDay={byDay} onEditDue={(a) => setDueDialog({ a })} onEditEvent={(e) => setEventDialog({ event: e })} />
            </div>
          ) : null}
        </>
      )}

      <EventDialog open={!!eventDialog} onClose={() => setEventDialog(null)} event={eventDialog?.event} defaultDate={eventDialog?.date} />
      <AssessmentDialog
        open={!!dueDialog}
        onClose={() => setDueDialog(null)}
        assessment={dueDialog?.a}
        defaultDate={dueDialog?.date}
        courses={s.activeCourses}
        topics={s.ws.topics}
      />
    </div>
  )
}

type DayBucket = { topics: Topic[]; blocks: Topic[]; dues: Assessment[]; events: CalendarEvent[] }

function onDragStart(e: DragEvent, id: string) {
  e.dataTransfer.setData('text/x-topic', id)
  e.dataTransfer.effectAllowed = 'move'
}
function readDrag(e: DragEvent) {
  return e.dataTransfer.getData('text/x-topic')
}
function accepts(e: DragEvent) {
  return Array.from(e.dataTransfer.types).includes('text/x-topic')
}

function TopicChip({ t, s, compact }: { t: Topic; s: StudyIndex; compact?: boolean }) {
  const c = s.courseById.get(t.courseId)
  return (
    <Link
      to={`/app/topics/${t.id}`}
      className={['cal-chip', 'cal-chip--topic', compact ? 'cal-chip--compact' : ''].join(' ')}
      data-hue={c?.color}
      draggable
      onDragStart={(e) => onDragStart(e, t.id)}
      title={`${c?.code ?? ''} ${t.title}. Drag to move.`}
    >
      <ConfidenceGlyph value={t.confidence} size={11} />
      <span className="cal-chip__stack">
        <span className="cal-chip__course cal-chip__course--agenda t-mono">{c?.code}</span>
        <span className="cal-chip__title">{t.title}</span>
      </span>
    </Link>
  )
}

function DueChip({ a, s, onClick, compact }: { a: Assessment; s: StudyIndex; onClick: () => void; compact?: boolean }) {
  const c = a.courseId ? s.courseById.get(a.courseId) : undefined
  return (
    <button
      type="button"
      className={['cal-chip', 'cal-chip--due', compact ? 'cal-chip--compact' : ''].join(' ')}
      data-hue={c?.color ?? 'slate'}
      data-done={a.done || undefined}
      data-kind={a.kind}
      onClick={onClick}
      title={`${a.title}${a.dueTime ? ` at ${formatTime(a.dueTime)}` : ''}. Fixed deadline.`}
    >
      <Icon name={a.done ? 'check' : 'flag'} size={11} />
      <span className="cal-chip__stack">
        {c ? <span className="cal-chip__course t-mono">{c.code}</span> : null}
        <span className="cal-chip__title">{withoutCode(a.title, c?.code)}</span>
      </span>
      {a.done ? <span className="sr-only">(done)</span> : null}
    </button>
  )
}

// ---------- week ----------

function Week({
  s,
  anchor,
  day,
  now,
  byDay,
  onMove,
  onEditDue,
  onEditEvent,
  onNewEvent,
}: {
  s: StudyIndex
  anchor: string
  day: string
  now: Date
  byDay: Map<string, DayBucket>
  onMove: (id: string, date: string, time: string | null) => void
  onEditDue: (a: Assessment) => void
  onEditEvent: (e: CalendarEvent) => void
  onNewEvent: (date: string) => void
}) {
  const days = weekDays(anchor)
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
  const [hover, setHover] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const showsToday = days.includes(day)
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    // Start at the earliest timed item this week (or now, whichever comes first), with a little room above.
    const starts: number[] = []
    for (const d of days) {
      const b = byDay.get(d)
      for (const t of b?.blocks ?? []) starts.push(toMinutes(isoTime(t.plannedStart!)))
      for (const e of b?.events ?? []) if (e.startTime) starts.push(toMinutes(e.startTime))
    }
    if (showsToday) starts.push(nowMin)
    const first = starts.length ? Math.min(...starts) : 9 * 60
    el.scrollTop = Math.max(0, ((first - HOUR_START * 60) / 60) * HOUR_PX - 24)
  }, [anchor]) // eslint-disable-line react-hooks/exhaustive-deps

  const slotFromEvent = (e: DragEvent, date: string) => {
    const col = e.currentTarget as HTMLElement
    const y = e.clientY - col.getBoundingClientRect().top
    const mins = Math.max(0, Math.min((HOUR_END - HOUR_START) * 60 - 30, Math.round((y / HOUR_PX) * 2) * 30))
    const total = HOUR_START * 60 + mins
    return { date, time: `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` }
  }

  return (
    <div className="week" style={{ ['--hour' as string]: `${HOUR_PX}px` }}>
      <div className="week__head">
        <span />
        {days.map((d) => (
          <div key={d} className="week__day" data-today={d === day || undefined} data-past={d < day || undefined}>
            <span className="week__dow t-mono">{formatDate(d, { weekday: 'short' })}</span>
            <span className="week__num t-display tabular">{formatDate(d, { day: 'numeric' })}</span>
          </div>
        ))}
      </div>

      <div className="week__allday">
        <span className="week__gutter-label tabular">All day</span>
        {days.map((d) => {
          const b = byDay.get(d)
          return (
            <div
              key={d}
              className="week__allday-cell"
              data-drop={hover === `${d}-all` || undefined}
              onDragOver={(e) => {
                if (!accepts(e)) return
                e.preventDefault()
                setHover(`${d}-all`)
              }}
              onDragLeave={() => setHover(null)}
              onDrop={(e) => {
                e.preventDefault()
                setHover(null)
                const id = readDrag(e)
                if (id) onMove(id, d, null)
              }}
            >
              {b?.dues.map((a) => <DueChip key={a.id} a={a} s={s} onClick={() => onEditDue(a)} />)}
              {b?.topics.map((t) => <TopicChip key={t.id} t={t} s={s} />)}
              {b?.events.filter((e) => !e.startTime).map((e) => (
                <button key={e.id} type="button" className="cal-chip cal-chip--event" data-hue={e.color} onClick={() => onEditEvent(e)}>
                  <span className="cal-chip__title">{e.title}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>

      <div className="week__body" ref={gridRef}>
        <div className="week__gutter">
          {hours.map((h) => (
            <span key={h} className="week__hour tabular">
              {formatTime(`${String(h).padStart(2, '0')}:00`)}
            </span>
          ))}
        </div>
        {days.map((d) => {
          const b = byDay.get(d)
          return (
            <div
              key={d}
              className="week__col"
              data-today={d === day || undefined}
              data-drop={hover?.startsWith(`${d}-t`) || undefined}
              onDragOver={(e) => {
                if (!accepts(e)) return
                e.preventDefault()
                setHover(`${d}-t`)
              }}
              onDragLeave={() => setHover(null)}
              onDrop={(e) => {
                e.preventDefault()
                setHover(null)
                const id = readDrag(e)
                const slot = slotFromEvent(e, d)
                if (id) onMove(id, slot.date, slot.time)
              }}
              onDoubleClick={() => onNewEvent(d)}
            >
              {b?.blocks.map((t) => {
                const start = toMinutes(isoTime(t.plannedStart!))
                const len = t.plannedMinutes ?? 60
                const c = s.courseById.get(t.courseId)
                const top = ((start - HOUR_START * 60) / 60) * HOUR_PX
                return (
                  <Link
                    key={t.id}
                    to={`/app/topics/${t.id}`}
                    className="block block--topic"
                    data-hue={c?.color}
                    draggable
                    onDragStart={(e) => onDragStart(e, t.id)}
                    style={{ top: Math.max(0, top), height: Math.max(40, (len / 60) * HOUR_PX - 3) }}
                    title={`${t.title}. Drag to move.`}
                  >
                    <span className="block__time tabular">
                      {formatTime(isoTime(t.plannedStart!))} · <span className="block__code">{c?.code}</span>
                    </span>
                    <span className="block__title">
                      <ConfidenceGlyph value={t.confidence} size={11} /> {t.title}
                    </span>
                  </Link>
                )
              })}
              {b?.events
                .filter((e) => e.startTime)
                .map((e) => {
                  const start = toMinutes(e.startTime!)
                  const end = e.endTime ? toMinutes(e.endTime) : start + 60
                  const top = ((start - HOUR_START * 60) / 60) * HOUR_PX
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className="block block--event"
                      data-hue={e.color}
                      style={{ top: Math.max(0, top), height: Math.max(40, ((end - start) / 60) * HOUR_PX - 3) }}
                      onClick={() => onEditEvent(e)}
                    >
                      <span className="block__time tabular">{formatTime(e.startTime!)}</span>
                      <span className="block__title">{e.title}</span>
                    </button>
                  )
                })}
              {d === day && nowMin >= HOUR_START * 60 && nowMin <= HOUR_END * 60 ? (
                <span className="week__now" style={{ top: ((nowMin - HOUR_START * 60) / 60) * HOUR_PX }} aria-hidden />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- month ----------

function Month({
  s,
  anchor,
  day,
  byDay,
  selected,
  onMove,
  onPick,
  onEditDue,
}: {
  s: StudyIndex
  anchor: string
  day: string
  byDay: Map<string, DayBucket>
  selected: string | null
  onMove: (id: string, date: string, time: string | null) => void
  onPick: (d: string) => void
  onEditDue: (a: Assessment) => void
}) {
  const weeks = monthMatrix(anchor)
  const month = anchor.slice(0, 7)
  const [hover, setHover] = useState<string | null>(null)
  return (
    <div className="month">
      <div className="month__dows">
        {weeks[0].map((d) => (
          <span key={d} className="t-mono">
            {formatDate(d, { weekday: 'short' })}
          </span>
        ))}
      </div>
      <div className="month__grid">
        {weeks.flat().map((d) => {
          const b = byDay.get(d)
          const items = [...(b?.dues ?? []).map((a) => ({ k: `a${a.id}`, a })), ...[...(b?.blocks ?? []), ...(b?.topics ?? [])].map((t) => ({ k: `t${t.id}`, t }))]
          const evs = b?.events.length ?? 0
          const evDots = (b?.events ?? []).slice(0, 2)
          const shown = items.slice(0, 3)
          const more = items.length - shown.length + evs
          return (
            <div
              key={d}
              className="month__cell"
              data-out={d.slice(0, 7) !== month || undefined}
              data-today={d === day || undefined}
              data-selected={selected === d || undefined}
              data-drop={hover === d || undefined}
              onClick={selected !== null ? () => onPick(d) : undefined}
              onDragOver={(e) => {
                if (!accepts(e)) return
                e.preventDefault()
                setHover(d)
              }}
              onDragLeave={() => setHover(null)}
              onDrop={(e) => {
                e.preventDefault()
                setHover(null)
                const id = readDrag(e)
                if (id) onMove(id, d, null)
              }}
            >
              <button type="button" className="month__num tabular" onClick={() => onPick(d)} aria-label={`Open week of ${formatDate(d, { month: 'long', day: 'numeric' })}`}>
                {formatDate(d, { day: 'numeric' })}
              </button>
              <div className="month__items">
                {shown.map((x) =>
                  'a' in x && x.a ? (
                    <DueChip key={x.k} a={x.a} s={s} onClick={() => onEditDue(x.a!)} compact />
                  ) : 't' in x && x.t ? (
                    <TopicChip key={x.k} t={x.t} s={s} compact />
                  ) : null,
                )}
                {more > 0 ? (
                  <button type="button" className="month__more" onClick={() => onPick(d)}>
                    +{more} more
                  </button>
                ) : null}
                {evDots.map((e) => (
                  <span key={e.id} className="month__ev" data-hue={e.color} aria-hidden />
                ))}
                {more > 0 ? <span className="month__plus tabular">+{more}</span> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- phone agenda: the week as a list, today first in view ----------

function Agenda({
  s,
  anchor,
  day,
  byDay,
  onEditDue,
  onEditEvent,
  days: only,
}: {
  s: StudyIndex
  anchor: string
  day: string
  byDay: Map<string, DayBucket>
  onEditDue: (a: Assessment) => void
  onEditEvent: (e: CalendarEvent) => void
  days?: string[]
}) {
  const days = only ?? weekDays(anchor)
  return (
    <ol className="agenda-week">
      {days.map((d) => {
        const b = byDay.get(d)
        const blocks = [...(b?.blocks ?? [])].sort((x, y) => x.plannedStart!.localeCompare(y.plannedStart!))
        const timed = [...(b?.events ?? [])].sort((x, y) => (x.startTime ?? '').localeCompare(y.startTime ?? ''))
        const empty = !b || (!b.dues.length && !b.topics.length && !blocks.length && !timed.length)
        return (
          <li key={d} className="agenda-day" data-today={d === day || undefined} data-past={d < day || undefined}>
            <div className="agenda-day__date">
              <span className="t-mono agenda-day__dow">{formatDate(d, { weekday: 'short' })}</span>
              <span className="t-display agenda-day__num tabular">{formatDate(d, { day: 'numeric' })}</span>
            </div>
            <div className="agenda-day__items">
              {b?.dues.map((a) => <DueChip key={a.id} a={a} s={s} onClick={() => onEditDue(a)} />)}
              {blocks.map((t) => (
                <div key={t.id} className="agenda-day__timed">
                  <span className="agenda-day__time tabular">{formatTime(isoTime(t.plannedStart!))}</span>
                  <TopicChip t={t} s={s} />
                </div>
              ))}
              {b?.topics.map((t) => <TopicChip key={t.id} t={t} s={s} />)}
              {timed.map((e) => (
                <div key={e.id} className="agenda-day__timed">
                  <span className="agenda-day__time tabular">{e.startTime ? formatTime(e.startTime) : ''}</span>
                  <button type="button" className="cal-chip cal-chip--event" data-hue={e.color} onClick={() => onEditEvent(e)}>
                    <span className="cal-chip__title">{e.title}</span>
                  </button>
                </div>
              ))}
              {empty ? <span className="agenda-day__free">Free</span> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
