import { useTopicMutations } from '../lib/data'
import { addDays } from '../lib/domain'
import type { DateOnly, Topic, TopicPatch } from '../lib/data/types'
import { useToast } from '../ui/toastContext'

type Dated = Pick<Topic, 'id' | 'plannedDate' | 'plannedStart'>

function shifted(t: Dated, days: number): Dated {
  if (!t.plannedDate) return t
  let plannedStart = t.plannedStart
  if (plannedStart) {
    // Move the time block by whole local days, so it keeps its clock time across a DST change.
    const start = new Date(plannedStart)
    start.setDate(start.getDate() + days)
    plannedStart = start.toISOString()
  }
  return { id: t.id, plannedDate: addDays(t.plannedDate, days), plannedStart }
}

/**
 * Move every planned topic date from `from` onward by a number of days.
 * For the week a lecture is cancelled or the schedule slips. Deadlines never move.
 */
export function useShiftDates() {
  const { update } = useTopicMutations()
  const toast = useToast()

  const apply = async (rows: Dated[]) => {
    for (const row of rows) {
      const patch: TopicPatch = { plannedDate: row.plannedDate }
      if (row.plannedStart) patch.plannedStart = row.plannedStart
      await update(row.id, patch)
    }
  }

  return async (topics: Topic[], days: number, from: DateOnly) => {
    const before: Dated[] = topics
      .filter((t) => t.plannedDate && t.plannedDate >= from && t.confidence !== 'retired')
      .map((t) => ({ id: t.id, plannedDate: t.plannedDate, plannedStart: t.plannedStart }))
    if (!before.length) {
      toast.show({ message: 'No upcoming topic dates to move in this course.' })
      return
    }
    const size = Math.abs(days)
    const amount = size % 7 === 0 ? `${size / 7} ${size === 7 ? 'week' : 'weeks'}` : `${size} ${size === 1 ? 'day' : 'days'}`
    try {
      await apply(before.map((t) => shifted(t, days)))
      toast.show(
        {
          message: `Moved ${before.length} topic ${before.length === 1 ? 'date' : 'dates'} ${days > 0 ? 'later' : 'earlier'} by ${amount}`,
          action: { label: 'Undo', run: () => apply(before) },
        },
        10_000,
      )
    } catch (err) {
      toast.error(err, 'Some topic dates could not be moved. Check the course and try again.')
    }
  }
}
