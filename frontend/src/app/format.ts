import { parseDateOnly } from '../lib/domain'

const cache = new Map<string, Intl.DateTimeFormat>()

/** Format a YYYY-MM-DD date with exactly the parts asked for, in local time. */
export function formatDate(date: string, options: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify(options)
  let f = cache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', options)
    cache.set(key, f)
  }
  return f.format(parseDateOnly(date))
}

/** The learner's local calendar date for an ISO instant. */
export function localDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
