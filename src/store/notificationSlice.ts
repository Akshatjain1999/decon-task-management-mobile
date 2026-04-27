import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { notificationService } from '../services/notificationService'
import type { Notification } from '../types'

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
}

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      return await notificationService.getMyNotifications()
    } catch (e: any) {
      return rejectWithValue(e.message)
    }
  },
)

export const markRead = createAsyncThunk(
  'notifications/markRead',
  async (id: number, { rejectWithValue }) => {
    try {
      await notificationService.markAsRead(id)
      return id
    } catch (e: any) {
      return rejectWithValue(e.message)
    }
  },
)

export const markAllRead = createAsyncThunk(
  'notifications/markAllRead',
  async (_, { rejectWithValue }) => {
    try {
      await notificationService.markAllAsRead()
    } catch (e: any) {
      return rejectWithValue(e.message)
    }
  },
)

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchNotifications.fulfilled, (state, action: PayloadAction<Notification[]>) => {
        state.loading = false
        state.notifications = action.payload
        state.unreadCount = action.payload.filter((n) => !n.isRead).length
      })
      .addCase(markRead.fulfilled, (state, action: PayloadAction<number>) => {
        const n = state.notifications.find((n) => n.id === action.payload)
        if (n && !n.isRead) {
          n.isRead = true
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
      })
      .addCase(markAllRead.fulfilled, (state) => {
        state.notifications.forEach((n) => (n.isRead = true))
        state.unreadCount = 0
      })
  },
})

export default notificationSlice.reducer
