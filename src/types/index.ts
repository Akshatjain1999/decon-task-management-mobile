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
  description?: string | null
  status: SubtaskStatus
  isComplete: boolean
  sortOrder: number
  createdAt: string
  ownerId?: number | null
  ownerName?: string | null
  statusChangedAt?: string | null
  completedAt?: string | null
  startDate?: string | null              // ISO yyyy-MM-dd
  endDate?: string | null                // ISO yyyy-MM-dd
  estimatedMinutes?: number | null
  subtaskKind?: 'NORMAL' | 'INSTALLATION' | 'LIVE'
}

export interface SubtaskNote {
  id: number
  note: string
  createdBy: { id: number; name: string }
  createdAt: string
  attachmentName?: string | null
  attachmentType?: string | null
  attachmentSize?: number | null
  hasAttachment: boolean
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
  comments: Comment[]
  attachments: Attachment[]
  commentsCount: number
  subtasksTotal: number
  subtasksCompleted: number
  vendorOwner?: User | null
  latitude?: number | null
  longitude?: number | null
  geofenceRadiusM?: number | null
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
  estimateHours?: number
}

// ─── Comment ───────────────────────────────────────────────────────────────
export interface Comment {
  id: number
  content: string
  user: User
  createdAt: string
}

// ─── Attachment ─────────────────────────────────────────────────────────────
export interface Attachment {
  id: number
  fileName: string
  fileType: string
  fileSize: number
  uploadedAt: string
}

// ─── Audit ──────────────────────────────────────────────────────────────────
export interface TaskAuditEntry {
  id: number
  changeType: string
  fieldChanged: string | null
  oldValue: string | null
  newValue: string | null
  changedByName: string
  changedAt: string
}

export interface SubtaskAuditEntry {
  id: number
  subtaskId: number
  subtaskTitle: string
  changeType: string
  oldStatus: string | null
  newStatus: string | null
  backwardMove: boolean
  changedByName: string
  changedAt: string
}

export interface TaskAuditsResponse {
  taskAudits: TaskAuditEntry[]
  subtaskAudits: SubtaskAuditEntry[]
}

// ─── Notification ──────────────────────────────────────────────────────────
export type NotificationType = 'TASK_ASSIGNED' | 'TASK_UPDATED' | 'REMINDER' | 'OVERDUE_ALERT' | 'MENTION'

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

export interface OwnerSubtaskStat {
  ownerId: number
  ownerName: string
  totalSubtasks: number
  completedSubtasks: number
  pendingSubtasks: number
  completionRate: number
}

export interface SubtaskPipelineStat {
  stepTitle: string
  totalTasks: number
  completedTasks: number
  completionRate: number
}

export interface PipelineTaskItem {
  id: number
  title: string
  status: string
  priority: string
  assignedToName: string | null
  subtaskCompleted: boolean
}

export interface WccBillingStats {
  wccPending: number
  wccCompleted: number
  billingPending: number
  billingCompleted: number
  /** L1: every subtask up to & including the L1 anchor ("WCC" for CCTV; "Live after installation done" for Lift/Racks) is DONE. */
  l1Completed: number
  /** L2: every subtask up to & including "Billing completed" is DONE. */
  l2Completed: number
  /** L3: every subtask up to & including "Delivered pending material" is DONE. Null for Lift/Racks. */
  l3Completed: number | null
}

export interface TaskTypeBreakdown {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  completionRate: number
  totalSubtasks: number
  completedSubtasks: number
  wccBillingStats: WccBillingStats
}

export interface TaskTypeDashboard {
  taskType: string
  taskTypeLabel: string
  totalTasks: number
  openTasks: number
  inProgressTasks: number
  completedTasks: number
  overdueTasks: number
  completionRate: number
  tasksByPriority: Record<string, number>
  totalSubtasks: number
  completedSubtasks: number
  subtaskCompletionRate: number
  ownerSubtaskStats: OwnerSubtaskStat[]
  subtaskPipeline: SubtaskPipelineStat[]
  wccBillingStats: WccBillingStats
}

export interface SuperAdminDashboard {
  totalTasks: number
  openTasks: number
  inProgressTasks: number
  completedTasks: number
  overdueTasks: number
  totalUsers: number
  taskCompletionRate: number
  tasksByPriority: Record<string, number>
  totalSubtasks: number
  completedSubtasks: number
  subtaskCompletionRate: number
  taskTypeBreakdown: Record<string, TaskTypeBreakdown>
  topOwners: OwnerSubtaskStat[]
}

export interface MyDashboard {
  assignedTotal: number
  assignedOpen: number
  assignedInProgress: number
  assignedCompleted: number
  assignedOverdue: number
  assignedCompletionRate: number
  tasksByType: Record<string, number>
  mySubtasksTotal: number
  mySubtasksCompleted: number
  mySubtasksPending: number
  mySubtaskCompletionRate: number
  mySubtasksToday: number
  mySubtasksOverdue: number
  mySubtasksInProgress: number
  mySubtasksTodo: number
  mySubtasksUpcoming: number
  mySubtasksCompletedThisWeek: number
  mySubtasksNoDates: number
}

export type MySubtaskFilter =
  | 'TODAY'
  | 'OVERDUE'
  | 'IN_PROGRESS'
  | 'TODO'
  | 'UPCOMING'
  | 'COMPLETED_WEEK'
  | 'NO_DATES'

export interface MySubtaskListItem {
  id: number
  title: string
  status: SubtaskStatus
  startDate: string | null
  endDate: string | null
  estimatedMinutes: number | null
  completedAt: string | null
  taskId: number | null
  taskTitle: string | null
  taskType: string | null
  taskPriority: string | null
}

// ─── Inventory ─────────────────────────────────────────────────────────────
export type InventoryCategory = 'CAMERA' | 'NVR_STORAGE' | 'RACK' | 'NETWORK' | 'DISPLAY' | 'CABLE' | 'ACCESSORIES'
export type MovementType = 'STOCK_IN' | 'DISPATCH' | 'DELIVERY' | 'RETURN' | 'ADJUSTMENT'
export type DispatchStatus = 'PENDING' | 'PARTIALLY_DISPATCHED' | 'DISPATCHED' | 'DELIVERED'

export interface InventoryItem {
  id: number
  name: string
  unit: string
  taskType: TaskType
  category: InventoryCategory
  description: string | null
  stockQuantity: number
  minStockAlert: number
  isActive: boolean
  lowStock: boolean
  serialTracked: boolean
  createdAt: string
}

export interface InventoryDashboard {
  totalItems: number
  lowStockItems: number
  outOfStockItems: number
  lowStockList: InventoryItem[]
}

export interface CreateInventoryItemRequest {
  name: string
  unit: string
  taskType: TaskType
  category: InventoryCategory
  description?: string
  minStockAlert?: number
  serialTracked?: boolean
}

export interface UpdateInventoryItemRequest {
  name?: string
  unit?: string
  category?: InventoryCategory
  description?: string
  minStockAlert?: number
  isActive?: boolean
  serialTracked?: boolean
}

export interface TaskInventoryItem {
  id: number
  inventoryItemId: number
  itemName: string
  unit: string
  category: InventoryCategory
  quantityRequired: number
  quantityDispatched: number
  quantityDelivered: number
  notes: string | null
  status: DispatchStatus
  serialTracked: boolean
}

export interface InventoryMovement {
  id: number
  inventoryItemId: number
  itemName: string
  movementType: MovementType
  quantity: number
  stockBefore: number
  stockAfter: number
  movementDate: string
  performedByName: string
  notes: string | null
  referenceSubtaskId: number | null
}

export interface RecordMovementRequest {
  quantity: number
  notes?: string
  movementDate: string
  referenceSubtaskId?: number
}
