import api from './api'
import type { EffectivePermissions } from '../types'

export const permissionTemplateService = {
  async getEffectivePermissions(userId: number): Promise<EffectivePermissions> {
    const res = await api.get(`/api/v1/users/${userId}/effective-permissions`)
    return (res.data as any).data ?? res.data
  },
}
