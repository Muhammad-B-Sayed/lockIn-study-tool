import type {
  Assessment, AssessmentInput, AssessmentPatch, CalendarEvent, Course, CourseInput,
  Credentials, EventInput, RateInput, ReviewEvent, SessionInput, StudySession,
  Topic, TopicInput, TopicPatch, User, Workspace,
} from './types'

export type AuthSession = { accessToken: string; tokenType: string; expiresAt: string | null; user: User }
export type SignupCredentials = Credentials & { repeatPassword?: string }
export type RatingResult = { topic: Topic; review: ReviewEvent }

export class DataError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'DataError'
    this.status = status
  }
}

export function asDataError(error: unknown): DataError {
  return error instanceof DataError ? error : new DataError(0, error instanceof Error ? error.message : 'Something went wrong. Please try again.')
}

export interface DataSource {
  health(): Promise<void>
  signIn(input: Credentials): Promise<AuthSession>
  signUp(input: SignupCredentials): Promise<AuthSession>
  getProfile(): Promise<User>
  changePassword(currentPassword: string, newPassword: string): Promise<void>
  deleteAccount(): Promise<void>
  getWorkspace(): Promise<Workspace>
  createCourse(input: CourseInput): Promise<Course>
  updateCourse(id: string, patch: Partial<CourseInput>): Promise<Course>
  removeCourse(id: string): Promise<void>
  createTopic(input: TopicInput): Promise<Topic>
  createTopics(input: TopicInput[]): Promise<Topic[]>
  updateTopic(id: string, patch: TopicPatch): Promise<Topic>
  removeTopic(id: string): Promise<void>
  rateTopic(input: RateInput): Promise<RatingResult>
  undoReview(id: string): Promise<{ topic: Topic }>
  createAssessment(input: AssessmentInput): Promise<Assessment>
  createAssessments(input: AssessmentInput[]): Promise<Assessment[]>
  updateAssessment(id: string, patch: AssessmentPatch): Promise<Assessment>
  removeAssessment(id: string): Promise<void>
  createEvent(input: EventInput): Promise<CalendarEvent>
  updateEvent(id: string, patch: Partial<EventInput>): Promise<CalendarEvent>
  removeEvent(id: string): Promise<void>
  createSession(input: SessionInput): Promise<StudySession>
  removeSession(id: string): Promise<void>
}
