import api from './api'
import type { DashboardStats } from '../types'

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const res = await api.get<DashboardStats>('/api/v1/dashboard/stats')
    return res.data
  },
}
