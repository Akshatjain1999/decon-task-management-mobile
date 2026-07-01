import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { authService } from '../services/authService'
import { permissionTemplateService } from '../services/permissionTemplateService'
import type { AuthResponse, LoginRequest, EffectivePermissions } from '../types'
import { secureStorage } from '../lib/secureStorage'

interface AuthState {
  token: string | null
  user: AuthResponse | null
  permissions: EffectivePermissions | null
  loading: boolean
  error: string | null
}

const initialState: AuthState = {
  token: null,
  user: null,
  permissions: null,
  loading: false,
  error: null,
}

export const login = createAsyncThunk(
  'auth/login',
  async (data: LoginRequest, { rejectWithValue }) => {
    try {
      const user = await authService.login(data)
      let permissions: EffectivePermissions | null = null
      try {
        permissions = await permissionTemplateService.getEffectivePermissions(user.userId)
        await secureStorage.setItem('auth_permissions', JSON.stringify(permissions))
      } catch (err) {
        console.warn('Failed to fetch permissions during login', err)
      }
      return { user, permissions }
    } catch (e: any) {
      return rejectWithValue(e.message)
    }
  },
)

export const restoreSession = createAsyncThunk('auth/restoreSession', async () => {
  const user = await authService.getStoredUser()
  if (user) {
    let permissions: EffectivePermissions | null = null
    try {
      permissions = await permissionTemplateService.getEffectivePermissions(user.userId)
      await secureStorage.setItem('auth_permissions', JSON.stringify(permissions))
    } catch (err) {
      // Offline fallback
      try {
        const cached = await secureStorage.getItem('auth_permissions')
        if (cached) permissions = JSON.parse(cached)
      } catch (cacheErr) {
        console.warn('Failed to parse cached permissions', cacheErr)
      }
    }
    return { user, permissions }
  }
  return null
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.token = null
      state.user = null
      state.permissions = null
      authService.logout()
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<{ user: AuthResponse; permissions: EffectivePermissions | null }>) => {
        state.loading = false
        state.token = action.payload.user.token
        state.user = action.payload.user
        state.permissions = action.payload.permissions
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        if (action.payload) {
          state.token = action.payload.user.token
          state.user = action.payload.user
          state.permissions = action.payload.permissions
        }
      })
  },
})

export const { logout } = authSlice.actions
export default authSlice.reducer
