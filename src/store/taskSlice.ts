import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { taskService } from '../services/taskService'
import type { Task, UpdateTaskRequest } from '../types'

interface TaskState {
  tasks: Task[]
  loading: boolean
  error: string | null
}

const initialState: TaskState = {
  tasks: [],
  loading: false,
  error: null,
}

export const fetchTasks = createAsyncThunk(
  'tasks/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      return await taskService.getAll()
    } catch (e: any) {
      return rejectWithValue(e.message)
    }
  },
)

export const updateTask = createAsyncThunk(
  'tasks/update',
  async ({ id, data }: { id: number; data: UpdateTaskRequest }, { rejectWithValue }) => {
    try {
      return await taskService.update(id, data)
    } catch (e: any) {
      return rejectWithValue(e.message)
    }
  },
)

export const createTask = createAsyncThunk(
  'tasks/create',
  async (data: import('../types').CreateTaskRequest, { rejectWithValue }) => {
    try {
      console.log('[createTask] payload:', JSON.stringify(data))
      const result = await taskService.create(data)
      console.log('[createTask] success:', JSON.stringify(result))
      return result
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Unknown error'
      console.log('[createTask] ERROR:', e?.response?.status, msg, JSON.stringify(e?.response?.data))
      return rejectWithValue(msg)
    }
  },
)

const taskSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTasks.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchTasks.fulfilled, (state, action: PayloadAction<Task[]>) => {
        state.loading = false
        state.tasks = action.payload
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(updateTask.fulfilled, (state, action: PayloadAction<Task>) => {
        const idx = state.tasks.findIndex((t) => t.id === action.payload.id)
        if (idx !== -1) state.tasks[idx] = action.payload
      })
      .addCase(createTask.fulfilled, (state, action: PayloadAction<Task>) => {
        state.tasks.unshift(action.payload)
      })
  },
})

export default taskSlice.reducer
