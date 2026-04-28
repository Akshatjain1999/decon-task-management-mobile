import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import api from './api'

/**
 * Requests notification permission and registers the Expo Push Token with the backend.
 * Safe to call multiple times — returns early if no token obtained.
 */
export async function registerPushToken(): Promise<void> {
  if (!Device.isDevice) {
    // Push notifications do not work on simulators/emulators
    return
  }

  // Android requires an explicit notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#006a66',
      sound: 'default',
    })
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    // User denied push notifications — silently skip
    return
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? '79d6d060-070a-4e52-aee6-86ed7e73f3a5'

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })

  const token = tokenData.data

  try {
    await api.put('/api/v1/users/me/push-token', { token })
  } catch {
    // Non-critical — app works fine without push tokens being saved
  }
}
