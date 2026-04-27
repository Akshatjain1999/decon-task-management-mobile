import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAppSelector } from '../store/hooks'
import LoginScreen from '../screens/LoginScreen'
import TaskDetailScreen from '../screens/TaskDetailScreen'
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
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  )
}
