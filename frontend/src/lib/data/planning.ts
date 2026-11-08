import { dateOnly } from './seed'

/** An explicit date, including null, always wins over an instant's calendar date. */
export function withLocalPlannedDate<T extends { plannedDate?: string | null; plannedStart?: string | null }>(input: T): T {
  if (Object.hasOwn(input, 'plannedDate') || !input.plannedStart) return input
  const start = new Date(input.plannedStart)
  // Let the adapter's normal validation report invalid instants.
  return Number.isFinite(start.getTime()) ? { ...input, plannedDate: dateOnly(start) } : input
}
