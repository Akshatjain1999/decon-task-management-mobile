import api from './api'

export interface VendorBucketItem {
  id: number
  inventoryItemId: number
  itemName: string
  unit: string
  quantityRequired: number
  quantityDispatched: number
  quantityDelivered: number
  quantityConsumed: number
  quantityPending: number
}

export interface SubmitConsumptionDisposition {
  dispositionType: 'TO_WAREHOUSE' | 'TO_ANOTHER_SITE' | 'KEPT_BY_VENDOR'
  quantity: number
  targetTaskId?: number | null
  keptLocationText?: string | null
}

export interface SubmitConsumptionItem {
  taskInventoryId: number
  quantityConsumed: number
  notes?: string | null
  dispositions: SubmitConsumptionDisposition[]
}

export interface ConsumptionResponse {
  id: number
  taskId: number
  submittedByUserId: number | null
  submittedByUserName: string | null
  submittedAt: string
  latitude: number | null
  longitude: number | null
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  decisionNote: string | null
  items: any[]
}

export const vendorBucketService = {
  async getBucket(taskId: number): Promise<VendorBucketItem[]> {
    const res = await api.get(`/api/v1/tasks/${taskId}/vendor-bucket`)
    return (res.data as any).data ?? res.data
  },
  async submit(taskId: number, payload: { latitude: number; longitude: number; items: SubmitConsumptionItem[] }): Promise<ConsumptionResponse> {
    const res = await api.post(`/api/v1/tasks/${taskId}/consumption`, payload)
    return (res.data as any).data ?? res.data
  },
  async list(taskId: number): Promise<ConsumptionResponse[]> {
    const res = await api.get(`/api/v1/tasks/${taskId}/consumption`)
    return (res.data as any).data ?? res.data
  },
}

export interface SubtaskStatusRequestResponse {
  id: number
  subtaskId: number
  requestedByUserId: number | null
  requestedByUserName: string | null
  requestedStatus: 'TODO' | 'IN_PROGRESS' | 'DONE'
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  note: string | null
  requestedAt: string
}

export const subtaskApprovalService = {
  async request(subtaskId: number, requestedStatus: 'TODO' | 'IN_PROGRESS' | 'DONE', note?: string): Promise<SubtaskStatusRequestResponse> {
    const res = await api.post(`/api/v1/subtasks/${subtaskId}/status-request`, { requestedStatus, note })
    return (res.data as any).data ?? res.data
  },
  async list(subtaskId: number): Promise<SubtaskStatusRequestResponse[]> {
    const res = await api.get(`/api/v1/subtasks/${subtaskId}/status-requests`)
    return (res.data as any).data ?? res.data
  },
  async approve(id: number, note?: string): Promise<SubtaskStatusRequestResponse> {
    const res = await api.post(`/api/v1/subtask-status-requests/${id}/approve`, { note })
    return (res.data as any).data ?? res.data
  },
  async reject(id: number, note?: string): Promise<SubtaskStatusRequestResponse> {
    const res = await api.post(`/api/v1/subtask-status-requests/${id}/reject`, { note })
    return (res.data as any).data ?? res.data
  },
}
