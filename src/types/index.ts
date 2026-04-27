// ─── Auth ──────────────────────────────────────────────────────────────────
export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  userId: number
  role: string
  name: string
  email: string
}

// ─── User ──────────────────────────────────────────────────────────────────
export interface User {
  id: number
  name: string
  email: string
  role: string
  status: string
  createdAt: string
}

// ─── Tag ───────────────────────────────────────────────────────────────────
export interface Tag {
  id: number
  name: string
  color: string
}

// ─── Subtask ───────────────────────────────────────────────────────────────
export type SubtaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

export interface Subtask {
  id: number
  title: string
  status: SubtaskStatus
  isComplete: boolean
  sortOrder: number
  createdAt: string
  ownerName?: string | null
}

// ─── Task ──────────────────────────────────────────────────────────────────
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'
export type TaskType = 'CCTV_INSTALLATION' | 'LIFT_INSTALLATION' | 'RACKS_INSTALLATION'

export interface Task {
  id: number
  taskType: TaskType | null
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  assignedTo: User | null
  createdBy: User
  dueDate: string
  estimateHours: number | null
  createdAt: string
  updatedAt: string | null
  completedAt?: string | null
  categoryName: string | null
  tags: Tag[]
  subtasks: Subtask[]
  commentsCount: number
  subtasksTotal: number
  subtasksCompleted: number
}

export interface CreateTaskRequest {
  taskType: TaskType
  title: string
  description?: string
  priority: TaskPriority
  assignedToId?: number
  dueDate: string
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  priority?: TaskPriority
  status?: TaskStatus
  assignedToId?: number
  dueDate?: string
}

// ─── Notification ──────────────────────────────────────────────────────────
export type NotificationType = 'TASK_ASSIGNED' | 'TASK_UPDATED' | 'REMINDER' | 'OVERDUE_ALERT'

export interface Notification {
  id: number
  message: string
  type: NotificationType
  isRead: boolean
  createdAt: string
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
export interface DashboardStats {
  totalTasks: number
  openTasks: number
  inProgressTasks: number
  completedTasks: number
  overdueTasks: number
  totalUsers: number
  tasksByPriority: Record<string, number>
}
