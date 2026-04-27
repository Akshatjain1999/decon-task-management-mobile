import api from './api'
import type { User } from '../types'

export const userService = {
  async getAll(): Promise<User[]> {
    const res = await api.get<User[]>('/api/v1/users')
    return res.data
  },
}
