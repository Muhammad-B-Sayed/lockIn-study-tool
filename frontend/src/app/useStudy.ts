import { useEffect, useMemo, useState } from 'react'
import { useWorkspace } from '../lib/data'
import type { Assessment, Course, Topic, Workspace } from '../lib/data/types'

/** A Date that advances every minute, so relative labels stay honest. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const h = window.setInterval(() => setNow(new Date()), intervalMs)
    const onVis = () => document.visibilityState === 'visible' && setNow(new Date())
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(h)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [intervalMs])
  return now
}

export type StudyIndex = {
  ws: Workspace
  courseById: Map<string, Course>
  topicById: Map<string, Topic>
  topicsByCourse: Map<string, Topic[]>
  assessmentsByCourse: Map<string, Assessment[]>
  activeCourses: Course[]
  archivedCourses: Course[]
}

export function indexWorkspace(ws: Workspace): StudyIndex {
  const courseById = new Map(ws.courses.map((c) => [c.id, c]))
  const topicById = new Map(ws.topics.map((t) => [t.id, t]))
  const topicsByCourse = new Map<string, Topic[]>()
  for (const c of ws.courses) topicsByCourse.set(c.id, [])
  for (const t of ws.topics) topicsByCourse.get(t.courseId)?.push(t)
  for (const list of topicsByCourse.values()) list.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
  const assessmentsByCourse = new Map<string, Assessment[]>()
  for (const a of ws.assessments) {
    const k = a.courseId ?? ''
    if (!assessmentsByCourse.has(k)) assessmentsByCourse.set(k, [])
    assessmentsByCourse.get(k)!.push(a)
  }
  for (const list of assessmentsByCourse.values()) list.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const byCode = (a: Course, b: Course) => a.code.localeCompare(b.code)
  return {
    ws,
    courseById,
    topicById,
    topicsByCourse,
    assessmentsByCourse,
    activeCourses: ws.courses.filter((c) => c.status === 'active').sort(byCode),
    archivedCourses: ws.courses.filter((c) => c.status === 'archived').sort(byCode),
  }
}

/** The workspace plus lookup maps. `data` is undefined while loading. */
export function useStudy() {
  const q = useWorkspace()
  const data = useMemo(() => (q.data ? indexWorkspace(q.data) : undefined), [q.data])
  return { ...q, data }
}
