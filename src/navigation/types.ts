export type RootStackParamList = {
  // Auth
  Login: undefined
  // Main tabs
  Main: undefined
  // Stack screens
  TaskDetail: { taskId: number }
  CreateTask: undefined
  TaskTypeDashboard: { typeKey: string }
}

export type BottomTabParamList = {
  Dashboard: undefined
  Tasks: undefined
  Notifications: undefined
  Profile: undefined
}
