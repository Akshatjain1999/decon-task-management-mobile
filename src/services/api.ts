import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const API_BASE_URL = 'https://decon-api.onrender.com'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Attach JWT from AsyncStorage on every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 globally — clear token; the NavigationService handles redirect
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('auth_token')
      await AsyncStorage.removeItem('auth_user')
    }
    const message: string =
      error.response?.data?.message ?? error.message ?? 'An unexpected error occurred'
    return Promise.reject(new Error(message))
  },
)

export default api
