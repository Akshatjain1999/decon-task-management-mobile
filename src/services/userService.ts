import api from './api'
import type { User } from '../types'

export const userService = {
  async getAll(): Promise<User[]> {
    // /assignable is open to all roles; /users requires ADMIN
    const res = await api.get<User[]>('/api/v1/users/assignable')
    return res.data
  },
}
