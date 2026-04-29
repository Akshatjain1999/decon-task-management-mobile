import AsyncStorage from '@react-native-async-storage/async-storage'
import api, { API_BASE_URL } from './api'
import type { Task, CreateTaskRequest, UpdateTaskRequest, Comment, TaskAuditsResponse, Subtask, SubtaskNote } from '../types'
import { compressIfImage } from '../lib/imageCompress'

export const taskService = {
  async getAll(): Promise<Task[]> {
    const res = await api.get<Task[]>('/api/v1/tasks')
    return res.data
  },

  async getById(id: number): Promise<Task> {
    const res = await api.get<Task>(`/api/v1/tasks/${id}`)
    return res.data
  },

  async create(data: CreateTaskRequest): Promise<Task> {
    const res = await api.post<Task>('/api/v1/tasks', data)
    return res.data
  },

  async update(id: number, data: UpdateTaskRequest): Promise<Task> {
    const res = await api.put<Task>(`/api/v1/tasks/${id}`, data)
    return res.data
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/api/v1/tasks/${id}`)
  },

  async getMyTasks(userId: number): Promise<Task[]> {
    const res = await api.get<Task[]>(`/api/v1/tasks/assignee/${userId}`)
    return res.data
  },

  // ── Comments ────────────────────────────────────────────────────────────
  async getComments(taskId: number): Promise<Comment[]> {
    const res = await api.get<Comment[]>(`/api/v1/tasks/${taskId}/comments`)
    return res.data
  },

  async addComment(taskId: number, content: string): Promise<Comment> {
    const res = await api.post<Comment>(`/api/v1/tasks/${taskId}/comments`, { content })
    return res.data
  },

  async deleteComment(taskId: number, commentId: number): Promise<void> {
    await api.delete(`/api/v1/tasks/${taskId}/comments/${commentId}`)
  },

  // ── Subtasks ────────────────────────────────────────────────────────────
  async createSubtask(
    taskId: number,
    title: string,
    ownerId?: number | null,
    dueDate?: string | null,
    estimatedMinutes?: number | null,
  ): Promise<Subtask> {
    const body: Record<string, unknown> = { title }
    if (ownerId) body.ownerId = ownerId
    if (dueDate) body.dueDate = dueDate
    if (estimatedMinutes != null) body.estimatedMinutes = estimatedMinutes
    const res = await api.post<Subtask>(`/api/v1/tasks/${taskId}/subtasks`, body)
    return res.data
  },

  async toggleSubtask(taskId: number, subtaskId: number): Promise<Subtask> {
    const res = await api.put<Subtask>(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}/toggle`)
    return res.data
  },

  async setSubtaskStatus(taskId: number, subtaskId: number, status: string): Promise<Subtask> {
    const res = await api.patch<Subtask>(
      `/api/v1/tasks/${taskId}/subtasks/${subtaskId}/status?status=${status}`,
    )
    return res.data
  },

  async updateSubtask(
    taskId: number,
    subtaskId: number,
    title: string,
    ownerId?: number | null,
    dueDate?: string | null,
    estimatedMinutes?: number | null,
  ): Promise<Subtask> {
    const res = await api.put<Subtask>(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`, {
      title,
      ownerId: ownerId ?? null,
      dueDate: dueDate || null,
      estimatedMinutes: estimatedMinutes ?? null,
    })
    return res.data
  },

  async deleteSubtask(taskId: number, subtaskId: number): Promise<void> {
    await api.delete(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`)
  },

  // ── Subtask Notes ────────────────────────────────────────────────────────
  async getSubtaskNotes(subtaskId: number): Promise<SubtaskNote[]> {
    const res = await api.get<SubtaskNote[]>(`/api/v1/subtasks/${subtaskId}/notes`)
    return res.data
  },

  async addSubtaskNote(
    subtaskId: number,
    note: string,
    attachment?: { uri: string; name: string; type: string } | null,
  ): Promise<SubtaskNote> {
    // Use native fetch instead of Axios — Axios's transformers break FormData in React Native.
    // fetch() lets the native XHR layer set Content-Type: multipart/form-data; boundary=... automatically.
    const token = await AsyncStorage.getItem('auth_token')
    const formData = new FormData()
    formData.append('note', note)
    if (attachment) {
      const compressed = await compressIfImage(attachment)
      formData.append('attachment', { uri: compressed.uri, name: compressed.name, type: compressed.type } as any)
    }
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    // Do NOT set Content-Type — fetch sets multipart/form-data; boundary=... automatically
    const response = await fetch(`${API_BASE_URL}/api/v1/subtasks/${subtaskId}/notes`, {
      method: 'POST',
      headers,
      body: formData,
    })
    const json = await response.json()
    if (!response.ok) {
      throw new Error(json?.message || `Request failed with status ${response.status}`)
    }
    // Unwrap ApiResponse<T> envelope
    return (json?.data ?? json) as SubtaskNote
  },

  async deleteSubtaskNote(noteId: number): Promise<void> {
    await api.delete(`/api/v1/subtasks/notes/${noteId}`)
  },



  // ── Audits ──────────────────────────────────────────────────────────────
  async getAudits(taskId: number): Promise<TaskAuditsResponse> {
    const res = await api.get<TaskAuditsResponse>(`/api/v1/tasks/${taskId}/audits`)
    return res.data
  },
}
