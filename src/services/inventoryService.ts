import api from './api'
import type { TaskInventoryItem, InventoryMovement, RecordMovementRequest } from '@/types'

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
