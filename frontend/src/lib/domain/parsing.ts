import type { AssessmentKind, DateOnly } from '../data/types'
import { addDays, parseDateOnly, startOfWeek, today } from './dates'

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const monthPattern = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?'
const weekdayPattern = '(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\\.?'
export type ParsedDate = { date: DateOnly; matched: string; index: number; explicitYear: boolean }

function validDate(year: number, month: number, day: number): DateOnly | null {
  const value = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  try {
    parseDateOnly(value)
    return value
  } catch {
    return null
  }
}

/** Numeric slash dates use month/day, matching the course's North American locale. */
export function extractDates(text: string, year: number): ParsedDate[] {
  const patterns = [
    /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    new RegExp(`\\b(${monthPattern})[ \\u00a0]+(\\d{1,2})(?:st|nd|rd|th)?(?:,?[ \\u00a0]+(\\d{4}))?\\b`, 'gi'),
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[ \\u00a0]+(${monthPattern})(?:,?[ \\u00a0]+(\\d{4}))?\\b`, 'gi'),
    /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b/g,
  ]
  const matches: ParsedDate[] = []
  for (const [kind, pattern] of patterns.entries()) {
    for (const match of text.matchAll(pattern)) {
      let y = year
      let m: number
      let d: number
      if (kind === 0) {
        y = Number(match[1]); m = Number(match[2]); d = Number(match[3])
      } else if (kind === 1 || kind === 2) {
        m = months.indexOf(match[kind === 1 ? 1 : 2].slice(0, 3).toLowerCase()) + 1
        d = Number(match[kind === 1 ? 2 : 1])
        if (match[3]) y = Number(match[3])
      } else {
        m = Number(match[1]); d = Number(match[2])
        if (match[3]) y = Number(match[3]) + (match[3].length === 2 ? 2000 : 0)
      }
      const date = validDate(y, m, d)
      if (date) {
        // Treat a weekday immediately before an explicit date as one phrase.
        const weekday = new RegExp(`\\b(?:(?:next|this)[ \\u00a0]+)?${weekdayPattern}[ \\u00a0]*,?[ \\u00a0]+$`, 'i')
          .exec(text.slice(0, match.index))
        const index = weekday?.index ?? match.index
        matches.push({ date, matched: text.slice(index, match.index + match[0].length), index, explicitYear: kind === 0 || !!match[3] })
      }
    }
  }
  return matches.sort((a, b) => a.index - b.index)
}

export function extractDate(text: string, year: number, now?: Date): ParsedDate | null {
  const explicit = extractDates(text, year)
  if (explicit.length) return explicit[0]
  const matches: ParsedDate[] = []
  if (now) {
    const relative = /\b(today|tonight|tomorrow|tmrw|next\s+week|(?:(?:next|this)\s+)?(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?))\b/gi
    for (const match of text.matchAll(relative)) {
      const value = match[0].toLowerCase()
      let date: DateOnly
      if (value === 'today' || value === 'tonight') date = today(now)
      else if (value === 'tomorrow' || value === 'tmrw') date = addDays(now, 1)
      else if (value === 'next week') date = addDays(now, 7)
      else {
        const weekday = value.replace(/^(next|this)\s+/, '').slice(0, 3)
        const index = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(weekday)
        const thisWeek = addDays(startOfWeek(now), index)
        date = value.startsWith('next ') ? addDays(thisWeek, 7)
          : value.startsWith('this ') ? thisWeek
          : thisWeek < today(now) ? addDays(thisWeek, 7) : thisWeek
      }
      matches.push({ date, matched: match[0], index: match.index, explicitYear: false })
    }
  }
  return matches.sort((a, b) => a.index - b.index)[0] ?? null
}

/** Strip schedule labels for classification without discarding lecture intent. */
export function stripTitlePrefixes(text: string, year = 2000): { title: string; topicPrefixed: boolean } {
  let title = cleanTitle(text.replace(/^(?:[-*•●▪◦]\s*|\(?\d+[.)]\s+)/, ''))
  let topicPrefixed = false
  for (let pass = 0; pass < 4; pass += 1) {
    title = title.replace(/^[a-z]{2,6}\d{2,}[a-z]?\b\s*[:|\-–—]?\s*/i, '')
    const prefix = /^(?:week|lecture|lec\.?|tutorial)\s+\d+\s*(?:\([^)]*\))?\s*[:.\-–—|]?\s*/i.exec(title)
    if (prefix) { topicPrefixed = true; title = title.slice(prefix[0].length) }
    const date = extractDate(title, year)
    if (date?.index === 0) title = removeMatch(title, date)
    title = cleanTitle(title)
  }
  return { title, topicPrefixed }
}

export function classifyTitle(text: string, options: { topicPrefixed?: boolean } = {}): { kind: 'topic' | AssessmentKind; ambiguous: boolean } {
  const { title, topicPrefixed } = stripTitlePrefixes(text)
  const deadlineVerb = /\b(?:due|by|submit)\b/i.test(text)
  const nouns: [AssessmentKind, RegExp][] = [
    ['quiz', /\b(?:quiz|quizzes)\b/gi],
    ['assignment', /\b(?:assignment|assign|homework|problem\s+set|pset)\b/gi],
    ['project', /\b(?:final\s+)?project\b/gi],
    ['exam', /\b(?:midterm|final\s+exam|exam(?:ination)?|test|final)\b/gi],
    ['task', /\b(?:task|todo|to-do)\b/gi],
  ]
  let ambiguous = false
  for (const [kind, pattern] of nouns) {
    for (const match of title.matchAll(pattern)) {
      ambiguous = true
      const before = title.slice(0, match.index).trim()
      const after = title.slice(match.index + match[0].length)
      const numbered = /^\s*#?\s*(?:\d+(?:st|nd|rd|th)?|first|second|third|fourth|fifth)\b/i.test(after)
      const atStart = !before || /^(?:the|an?|final|first|second|third|fourth|fifth)$/i.test(before)
      const bareFinal = /^final$/i.test(match[0])
      // "Final value theorem" is content, unlike "Final exam" or a bare "Final".
      if (bareFinal && !numbered && !/^\s*(?:(?:due|by|on|submit)\b|$)/i.test(after)) continue
      if (topicPrefixed || options.topicPrefixed ? atStart : atStart || numbered || deadlineVerb) {
        return { kind, ambiguous: !atStart }
      }
    }
  }
  return { kind: 'topic', ambiguous }
}

export function classifyKind(text: string): 'topic' | AssessmentKind {
  return classifyTitle(text).kind
}

export function cleanTitle(text: string): string {
  return text
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/\b(?:(?:due|on|at|by)\s*)+$/i, '')
    .replace(/^[\s:|,;\-–—]+|[\s:|,;\-–—]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function removeMatch(text: string, match: { index: number; matched: string }): string {
  return `${text.slice(0, match.index)} ${text.slice(match.index + match.matched.length)}`
}

export function extractTime(text: string): { time: string; matched: string; index: number } | null {
  const pattern = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?(?!\w)|\b(\d{1,2}):(\d{2})\b/gi
  for (const match of text.matchAll(pattern)) {
    let hour = Number(match[1] ?? match[4])
    const minute = Number(match[2] ?? match[5] ?? 0)
    if (minute > 59) continue
    if (match[3]) {
      if (hour < 1 || hour > 12) continue
      hour = hour % 12 + (match[3].toLowerCase() === 'p' ? 12 : 0)
    } else if (hour > 23) continue
    return { time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, matched: match[0], index: match.index }
  }
  return null
}
