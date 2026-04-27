import api from './api'
import type { Task, CreateTaskRequest, UpdateTaskRequest } from '../types'

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
}
