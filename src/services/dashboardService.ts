import api from './api'
import type { DashboardStats, SuperAdminDashboard, TaskTypeDashboard, PipelineTaskItem } from '../types'

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const res = await api.get<DashboardStats>('/api/v1/dashboard/stats')
    return res.data
  },

  async getSuperAdminDashboard(): Promise<SuperAdminDashboard> {
    const res = await api.get<SuperAdminDashboard>('/api/v1/dashboard/super-admin')
    return res.data
  },

  async getTaskTypeDashboard(taskType: string): Promise<TaskTypeDashboard> {
    const res = await api.get<TaskTypeDashboard>(`/api/v1/dashboard/task-type/${taskType}`)
    return res.data
  },

  async getPipelineTasks(taskType: string, subtaskTitle: string): Promise<PipelineTaskItem[]> {
    const res = await api.get<PipelineTaskItem[]>(
      `/api/v1/dashboard/task-type/${taskType}/pipeline-tasks`,
      { params: { subtaskTitle } },
    )
    return res.data
  },
}
