import api from './api'
import type {
  TaskInventoryItem,
  InventoryMovement,
  RecordMovementRequest,
  InventoryItem,
  InventoryDashboard,
  CreateInventoryItemRequest,
  UpdateInventoryItemRequest,
  TaskType,
} from '@/types'

// ── Catalog ───────────────────────────────────────────────────────────────────

export async function getCatalog(taskType?: TaskType): Promise<InventoryItem[]> {
  const params = taskType ? { taskType } : {}
  const res = await api.get<InventoryItem[]>('/api/v1/inventory/catalog', { params })
  return res.data
}

export async function getInventoryDashboard(): Promise<InventoryDashboard> {
  const res = await api.get<InventoryDashboard>('/api/v1/inventory/dashboard')
  return res.data
}

export async function createInventoryItem(req: CreateInventoryItemRequest): Promise<InventoryItem> {
  const res = await api.post<InventoryItem>('/api/v1/inventory/catalog', req)
  return res.data
}

export async function updateInventoryItem(itemId: number, req: UpdateInventoryItemRequest): Promise<InventoryItem> {
  const res = await api.put<InventoryItem>(`/api/v1/inventory/catalog/${itemId}`, req)
  return res.data
}

// ── Task-level inventory ──────────────────────────────────────────────────────

export async function getTaskInventory(taskId: number): Promise<TaskInventoryItem[]> {
  const res = await api.get<TaskInventoryItem[]>(`/api/v1/tasks/${taskId}/inventory`)
  return res.data
}

export async function getTaskMovements(taskId: number): Promise<InventoryMovement[]> {
  const res = await api.get<InventoryMovement[]>(`/api/v1/tasks/${taskId}/inventory/movements`)
  return res.data
}

export async function recordDispatch(taskId: number, itemId: number, req: RecordMovementRequest): Promise<void> {
  await api.post(`/api/v1/tasks/${taskId}/inventory/${itemId}/dispatch`, req)
}

export async function recordDelivery(taskId: number, itemId: number, req: RecordMovementRequest): Promise<void> {
  await api.post(`/api/v1/tasks/${taskId}/inventory/${itemId}/delivery`, req)
}

export async function recordReturn(taskId: number, itemId: number, req: RecordMovementRequest): Promise<void> {
  await api.post(`/api/v1/tasks/${taskId}/inventory/${itemId}/return`, req)
}

export async function updateTaskInventoryItem(
  taskId: number,
  itemId: number,
  req: { quantityRequired?: number; notes?: string },
): Promise<void> {
  await api.put(`/api/v1/tasks/${taskId}/inventory/${itemId}`, req)
}

export async function stockIn(
  itemId: number,
  req: { quantity: number; notes?: string; movementDate: string },
): Promise<void> {
  await api.post(`/api/v1/inventory/catalog/${itemId}/stock-in`, req)
}

export async function stockInWithSerials(
  itemId: number,
  req: { serialNumbers: string[]; notes?: string; movementDate: string },
): Promise<void> {
  await api.post(`/api/v1/inventory/catalog/${itemId}/stock-in/serials`, req)
}
