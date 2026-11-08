import type { AssessmentKind, DateOnly } from '../data/types'
import { diffDays, parseDateOnly } from './dates'
import { classifyTitle, cleanTitle, extractDates, removeMatch, stripTitlePrefixes, type ParsedDate } from './parsing'

export type SyllabusDraft = {
  kind: 'topic' | AssessmentKind
  title: string
  date: DateOnly | null
  courseId: string
  raw: string
  confidence: 'high' | 'low'
}

function inheritYear(parsed: ParsedDate, year: number, previous: DateOnly | null): DateOnly | null {
  if (parsed.explicitYear) return parsed.date
  try {
    let date = `${String(year).padStart(4, '0')}${parsed.date.slice(4)}`
    if (previous && diffDays(previous, date) > 60) date = `${String(year + 1).padStart(4, '0')}${parsed.date.slice(4)}`
    parseDateOnly(date)
    return date
  } catch { return null }
}

function attachedDate(text: string, dates: ParsedDate[]): ParsedDate | undefined {
  return dates.find((date) => /\b(?:due|by|on)\s*[:-]?\s*$/i.test(text.slice(0, date.index)))
}

/** Mixed table rows can produce both a topic and an uncertain assessment. */
export function parseSyllabus(text: string, options: { year: number; courseId: string }): SyllabusDraft[] {
  if (!Number.isInteger(options.year) || options.year < 1 || options.year > 9999) throw new RangeError('Invalid syllabus year')
  let year = options.year
  let previous: DateOnly | null = null
  return text.split(/\r?\n/).flatMap((raw): SyllabusDraft[] => {
    const line = raw.trim().replace(/^\|\s*|\s*\|$/g, '').replace(/^(?:[-*•●▪◦]\s*|\(?\d+[.)]\s+)/, '')
    if (!line || /^[|\s:–—-]+$/.test(line)) return []
    const cells = line.split(/\t+|\s*\|\s*/).map((cell) => cell.trim()).filter(Boolean)
    if (cells.length && cells.every((cell) => /^(?:week|date|day|topic|topics|lecture|content|assessment|readings?|due(?: date)?)$/i.test(cell))) return []
    if (/^(?:course\s+)?(?:schedule|syllabus|weekly\s+schedule)$/i.test(line)) return []
    const dates = extractDates(line, year)
    const rowDate = dates[0] ? inheritYear(dates[0], year, previous) : null
    if (rowDate) { year = Number(rowDate.slice(0, 4)); previous = rowDate }
    const rowPrefix = dates[0] ? stripTitlePrefixes(line.slice(0, dates[0].index), year).title.replace(/[|\t\d(]/g, '').trim() : null
    const leadingDate = rowPrefix === '' ? rowDate : null
    const topicPrefixed = stripTitlePrefixes(line).topicPrefixed
    const parts = cells.map((cell) => {
      const cellDates = extractDates(cell, year)
      const withoutDates = cellDates.reduceRight((text, date) => removeMatch(text, date), cell)
      return {
        cell, dates: cellDates,
        title: stripTitlePrefixes(withoutDates, year).title,
        ...classifyTitle(cell, { topicPrefixed }),
      }
    }).filter((part) => part.title && !/^\d+$/.test(part.title))
    const assessments = parts.filter((part) => part.kind !== 'topic')
    const topics = parts.filter((part) => part.kind === 'topic')
    const draft = (kind: SyllabusDraft['kind'], title: string, date: DateOnly | null, uncertain: boolean): SyllabusDraft => ({
      kind, title, date, courseId: options.courseId, raw, confidence: date && !uncertain ? 'high' : 'low',
    })
    if (!assessments.length) {
      const title = cleanTitle(parts.map((part) => part.title).join(' '))
      return title ? [draft('topic', title, rowDate, parts.some((part) => part.ambiguous))] : []
    }
    const result: SyllabusDraft[] = []
    if (topics.length) result.push(draft('topic', topics.map((part) => part.title).join(' '), leadingDate, topics.some((part) => part.ambiguous)))
    for (const part of assessments) {
      const chosen = attachedDate(part.cell, part.dates) ?? part.dates[0] ?? attachedDate(line, dates) ?? dates[0]
      const date = chosen ? inheritYear(chosen, year, rowDate) : null
      result.push(draft(part.kind, part.title, date, topics.length > 0 || part.ambiguous))
    }
    return result
  })
}
