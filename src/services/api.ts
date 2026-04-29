import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const API_BASE_URL = 'https://decon-api.onrender.com'

// Hook for the app to react to session expiry (e.g. dispatch redux logout +
// reset navigation to Login). Set once during app bootstrap.
let onSessionExpired: (() => void) | null = null
export function setOnSessionExpired(handler: (() => void) | null) {
  onSessionExpired = handler
}

let expiredFired = false

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // Tells backend to issue a long-lived (90d) JWT instead of the 24h web token.
    'X-Client': 'mobile',
  },
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

// Unwrap ApiResponse<T> envelope — backend always returns { success, message, data: T }
api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      response.data = response.data.data
    }
    return response
  },
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('auth_token')
      await AsyncStorage.removeItem('auth_user')
      // Fire once per expiry burst — many in-flight requests may all 401 at
      // the same time; we only want one redirect to Login.
      if (!expiredFired) {
        expiredFired = true
        try { onSessionExpired?.() } catch (e) { /* swallow */ }
        // Reset the latch shortly after so a future expiry can fire again.
        setTimeout(() => { expiredFired = false }, 2000)
      }
    }
    // Debug: log full error details to Metro console
    console.warn('[API ERROR]', {
      status: error.response?.status,
      data: JSON.stringify(error.response?.data),
      message: error.message,
      code: error.code,
    })
    const message: string =
      error.response?.data?.message ?? error.message ?? 'An unexpected error occurred'
    return Promise.reject(new Error(message))
  },
)

export default api
