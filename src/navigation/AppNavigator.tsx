import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAppSelector } from '../store/hooks'
import LoginScreen from '../screens/LoginScreen'
import TaskDetailScreen from '../screens/TaskDetailScreen'
import CreateTaskScreen from '../screens/CreateTaskScreen'
import TaskTypeDashboardScreen from '../screens/TaskTypeDashboardScreen'
import WorkflowDetailScreen from '../screens/WorkflowDetailScreen'
import BottomTabs from './BottomTabs'
import type { RootStackParamList } from './types'

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function AppNavigator() {
  const token = useAppSelector((s) => s.auth.token)

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1a237e' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      {token ? (
        <>
          <Stack.Screen
            name="Main"
            component={BottomTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TaskDetail"
            component={TaskDetailScreen}
            options={{ title: 'Task Details' }}
          />
          <Stack.Screen
            name="CreateTask"
            component={CreateTaskScreen}
            options={{ title: 'New Task' }}
          />
          <Stack.Screen
            name="TaskTypeDashboard"
            component={TaskTypeDashboardScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="WorkflowDetail"
            component={WorkflowDetailScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  )
}
