import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import taskReducer from './taskSlice'
import notificationReducer from './notificationSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    tasks: taskReducer,
    notifications: notificationReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
