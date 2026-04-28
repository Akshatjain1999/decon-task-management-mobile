import React, { useEffect, useRef } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { Provider } from 'react-redux'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { store } from './src/store'
import AppNavigator from './src/navigation/AppNavigator'
import { useAppDispatch, useAppSelector } from './src/store/hooks'
import { restoreSession } from './src/store/authSlice'
import { registerPushToken } from './src/services/pushTokenService'

// Only configure notification handler outside Expo Go (SDK 53+ requirement)
if (Constants.appOwnership !== 'expo') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
}

function Root() {
  const dispatch = useAppDispatch()
  const token = useAppSelector((s) => s.auth.token)
  const navigationRef = useRef<any>(null)
  const notificationResponseRef = useRef<Notifications.Subscription | null>(null)

  // Restore session on mount
  useEffect(() => {
    dispatch(restoreSession())
  }, [dispatch])

  // Register push token whenever user is authenticated
  useEffect(() => {
    if (token) {
      registerPushToken()
    }
  }, [token])

  // Handle notification taps (when user taps the OS notification banner)
  useEffect(() => {
    notificationResponseRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, any>
        if (data?.taskId && navigationRef.current) {
          navigationRef.current.navigate('TaskDetail', { taskId: data.taskId })
        }
      },
    )
    return () => {
      notificationResponseRef.current?.remove()
    }
  }, [])

  return (
    <NavigationContainer ref={navigationRef}>
      <AppNavigator />
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <Root />
      </Provider>
    </SafeAreaProvider>
  )
}


