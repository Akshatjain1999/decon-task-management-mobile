import api from './api'
import type { Task, CreateTaskRequest, UpdateTaskRequest, Comment, TaskAuditsResponse, Subtask, SubtaskNote } from '../types'

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
  async createSubtask(taskId: number, title: string): Promise<Subtask> {
    const res = await api.post<Subtask>(`/api/v1/tasks/${taskId}/subtasks`, { title })
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
    // Backend always expects multipart/form-data — never send JSON.
    // Do NOT set Content-Type manually; Axios must auto-detect it so the
    // multipart boundary is included correctly.
    const formData = new FormData()
    formData.append('note', note)
    if (attachment) {
      formData.append('attachment', { uri: attachment.uri, name: attachment.name, type: attachment.type } as any)
    }
    const res = await api.post<SubtaskNote>(`/api/v1/subtasks/${subtaskId}/notes`, formData, {
      // DO NOT set Content-Type — React Native XHR auto-sets multipart/form-data; boundary=...
      // transformRequest deletes the instance-level application/json header and passes FormData raw.
      transformRequest: [(data, headers) => {
        if (headers) delete (headers as Record<string, unknown>)['Content-Type']
        return data
      }],
      timeout: 60000,
    })
    return res.data
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
