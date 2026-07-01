import api from './api'
import { secureStorage } from '../lib/secureStorage'
import type { AuthResponse, LoginRequest } from '../types'

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/api/v1/auth/login', data)
    const user = res.data
    if (user?.token) {
      await secureStorage.setItem('auth_token', user.token)
    }
    await secureStorage.setItem('auth_user', JSON.stringify(user))
    return user
  },

  async logout(): Promise<void> {
    await secureStorage.removeItem('auth_token')
    await secureStorage.removeItem('auth_user')
    await secureStorage.removeItem('auth_permissions')
  },

  async getStoredUser(): Promise<AuthResponse | null> {
    const raw = await secureStorage.getItem('auth_user')
    return raw ? (JSON.parse(raw) as AuthResponse) : null
  },
}
