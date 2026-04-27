export type RootStackParamList = {
  // Auth
  Login: undefined
  // Main tabs
  Main: undefined
  // Stack screens
  TaskDetail: { taskId: number }
}

export type BottomTabParamList = {
  Tasks: undefined
  Notifications: undefined
  Profile: undefined
}
