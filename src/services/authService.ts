import api from './api'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AuthResponse, LoginRequest } from '../types'

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/api/v1/auth/login', data)
    const user = res.data
    if (user?.token) {
      await AsyncStorage.setItem('auth_token', user.token)
    }
    await AsyncStorage.setItem('auth_user', JSON.stringify(user))
    return user
  },

  async logout(): Promise<void> {
    await AsyncStorage.removeItem('auth_token')
    await AsyncStorage.removeItem('auth_user')
  },

  async getStoredUser(): Promise<AuthResponse | null> {
    const raw = await AsyncStorage.getItem('auth_user')
    return raw ? (JSON.parse(raw) as AuthResponse) : null
  },
}
