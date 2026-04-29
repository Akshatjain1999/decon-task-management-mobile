import React, { useEffect, useRef } from 'react'
import { ToastAndroid, Platform, Alert } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { Provider } from 'react-redux'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Constants from 'expo-constants'
import { store } from './src/store'
import AppNavigator from './src/navigation/AppNavigator'
import { useAppDispatch, useAppSelector } from './src/store/hooks'
import { restoreSession, logout } from './src/store/authSlice'
import { setOnSessionExpired } from './src/services/api'
import { registerPushToken, setupNotificationHandler, addNotificationTapListener } from './src/services/pushTokenService'

function Root() {
  const dispatch = useAppDispatch()
  const token = useAppSelector((s) => s.auth.token)
  const navigationRef = useRef<any>(null)

  // Restore session on mount
  useEffect(() => {
    dispatch(restoreSession())
  }, [dispatch])

  // Wire global session-expired handler — when api.ts sees a 401 it will
  // call this, we dispatch logout (which clears token in redux) and the
  // navigator automatically swaps to the Login stack.
  useEffect(() => {
    setOnSessionExpired(() => {
      dispatch(logout())
      if (Platform.OS === 'android') {
        ToastAndroid.show('Session expired. Please log in again.', ToastAndroid.LONG)
      } else {
        Alert.alert('Session expired', 'Please log in again.')
      }
    })
    return () => setOnSessionExpired(null)
  }, [dispatch])

  // Register push token whenever user is authenticated
  useEffect(() => {
    if (token) {
      registerPushToken()
    }
  }, [token])

  // Handle notification taps (when user taps the OS notification banner)
  useEffect(() => {
    // Returns undefined in Expo Go — safe to call regardless
    const subscription = addNotificationTapListener((taskId: string) => {
      if (navigationRef.current) {
        navigationRef.current.navigate('TaskDetail', { taskId })
      }
    })
    return () => subscription?.remove()
  }, [])

  return (
    <NavigationContainer ref={navigationRef}>
      <AppNavigator />
    </NavigationContainer>
  )
}

export default function App() {
  // Set up foreground notification display — no-op in Expo Go
  setupNotificationHandler()

  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <Root />
      </Provider>
    </SafeAreaProvider>
  )
}


