import api from './api'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AuthResponse, LoginRequest } from '../types'

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/api/v1/auth/login', data)
    await AsyncStorage.setItem('auth_token', res.data.token)
    await AsyncStorage.setItem('auth_user', JSON.stringify(res.data))
    return res.data
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
