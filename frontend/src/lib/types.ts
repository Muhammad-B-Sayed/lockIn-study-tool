export type User = {
  id: string
  username: string
  createdAt: string | null
}

export type AuthSession = {
  accessToken: string
  tokenType: string
  expiresAt: string | null
  user: User
}

export type Task = {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  course: string | null
  completed: boolean
  type: string
}

export type DashboardSummary = {
  tasks: Task[]
}

export type CalendarItem = {
  id: string
  kind: 'TASK' | 'EVENT'
  name: string
  date: string
  colorHex: string
  completed: boolean
  taskId: string | null
  course: string | null
}

export type Quote = {
  content: string
  author: string
}

export type SignupRequest = {
  username: string
  password: string
  repeatPassword: string
}

export type LoginRequest = {
  username: string
  password: string
}

export type TaskRequest = {
  title: string
  description: string
  dueDate: string | null
  course: string
  completed: boolean
  type: string
}

export type CalendarEventRequest = {
  name: string
  date: string
  colorHex: string
}

export type ApiErrorResponse = {
  timestamp: string
  status: number
  error: string
  message: string
  path: string
}
