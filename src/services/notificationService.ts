import api from './api'
import type { Notification } from '../types'

export const notificationService = {
  async getMyNotifications(): Promise<Notification[]> {
    const res = await api.get<Notification[]>('/api/v1/notifications')
    return res.data
  },

  async markAsRead(id: number): Promise<void> {
    await api.patch(`/api/v1/notifications/${id}/read`)
  },

  async markAllAsRead(): Promise<void> {
    await api.patch('/api/v1/notifications/read-all')
  },
}
