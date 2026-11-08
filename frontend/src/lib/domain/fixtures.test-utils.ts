import type { Assessment, Course, StudySession, Topic, Workspace } from '../data/types'

export const now = new Date(2026, 10, 7, 14, 30)
const createdAt = new Date(2026, 8, 1, 12).toISOString()

export function course(patch: Partial<Course> = {}): Course {
  return { id: 'csc369', code: 'CSC369', name: 'Operating Systems', color: 'ember', term: 'Fall 2026', instructor: null, email: null, website: null, status: 'active', createdAt, ...patch }
}

export function topic(patch: Partial<Topic> = {}): Topic {
  return { id: 'paging', courseId: 'csc369', title: 'Paging', details: null, notes: '', plannedDate: null, plannedStart: null, plannedMinutes: null, confidence: 'unrated', lastReviewedAt: null, position: 0, resources: [], createdAt, ...patch }
}

export function assessment(patch: Partial<Assessment> = {}): Assessment {
  return { id: 'midterm', courseId: 'csc369', title: 'Midterm', kind: 'exam', dueDate: '2026-11-17', dueTime: null, weight: null, done: false, doneAt: null, notes: '', topicIds: [], createdAt, ...patch }
}

export function session(date: string, minutes = 25): StudySession {
  return { id: date, topicId: null, courseId: null, startedAt: new Date(`${date}T10:00:00`).toISOString(), minutes, note: null }
}

export function workspace(patch: Partial<Workspace> = {}): Workspace {
  return { user: { id: 'u', username: 'Learner', createdAt }, courses: [course()], topics: [], assessments: [], events: [], sessions: [], reviews: [], generatedAt: now.toISOString(), ...patch }
}
