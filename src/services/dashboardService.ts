import api from './api'
import type { DashboardStats, SuperAdminDashboard } from '../types'

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const res = await api.get<DashboardStats>('/api/v1/dashboard/stats')
    return res.data
  },

  async getSuperAdminDashboard(): Promise<SuperAdminDashboard> {
    const res = await api.get<SuperAdminDashboard>('/api/v1/dashboard/super-admin')
    return res.data
  },
}
