import type { AssessmentKind, Course, DateOnly } from '../data/types'
import { classifyKind, cleanTitle, extractDate, extractTime, removeMatch } from './parsing'

export type QuickAddDraft = {
  kind: 'topic' | AssessmentKind
  title: string
  courseId: string | null
  date: DateOnly | null
  time: string | null
}

export function parseQuickAdd(text: string, courses: readonly Course[], now: Date): QuickAddDraft {
  let title = text.trim()
  // An explicit code wins over a course name mentioned as part of the title.
  const candidates = ['code', 'name'].flatMap((field) => courses
    .map((course) => ({ course, label: field === 'code' ? course.code : course.name }))
    .filter(({ label }) => label.trim())
    .sort((a, b) => b.label.length - a.label.length))
  let courseId: string | null = null
  for (const { course, label } of candidates) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'iu')
    if (!pattern.test(title)) continue
    title = title.replace(pattern, '$1 ')
    courseId = course.id
    break
  }
  const date = extractDate(title, now.getFullYear(), now)
  if (date) title = removeMatch(title, date)
  const time = extractTime(title)
  if (time) title = removeMatch(title, time)
  title = cleanTitle(title)
  return { kind: classifyKind(title), title, courseId, date: date?.date ?? null, time: time?.time ?? null }
}
