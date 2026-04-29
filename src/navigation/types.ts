export type RootStackParamList = {
  // Auth
  Login: undefined
  // Main tabs
  Main: undefined
  // Stack screens
  TaskDetail: { taskId: number; openSubtaskId?: number }
  CreateTask: undefined
  TaskTypeDashboard: { typeKey: string }
  WorkflowDetail: { typeKey: string; filter: string }
}

export type BottomTabParamList = {
  Dashboard: undefined
  Tasks: undefined
  Notifications: undefined
  Profile: undefined
}
