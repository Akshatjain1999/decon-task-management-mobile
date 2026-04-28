import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import api from './api'

/** Returns true when running inside Expo Go (push is unsupported there since SDK 53). */
function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo'
}

/**
 * Sets up foreground notification display behaviour.
 * No-op when running in Expo Go.
 */
export function setupNotificationHandler(): void {
  if (isExpoGo()) return
  // Dynamic require so the module is never loaded in Expo Go
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Notifications = require('expo-notifications')
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

/**
 * Listens for notification taps and calls onTap(taskId) when the payload has a taskId.
 * Returns undefined in Expo Go.
 */
export function addNotificationTapListener(
  onTap: (taskId: string) => void,
): { remove: () => void } | undefined {
  if (isExpoGo()) return undefined
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Notifications = require('expo-notifications')
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response: any) => {
      const data = response?.notification?.request?.content?.data as Record<string, any>
      if (data?.taskId) onTap(String(data.taskId))
    },
  )
  return subscription
}

/**
 * Requests notification permission, gets the Expo push token, and saves it to the backend.
 * No-op when running in Expo Go or on a simulator.
 */
export async function registerPushToken(): Promise<void> {
  if (isExpoGo()) return
  if (!Device.isDevice) return

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Notifications = require('expo-notifications')

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
  if (finalStatus !== 'granted') return

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? '79d6d060-070a-4e52-aee6-86ed7e73f3a5'

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
  const token = tokenData.data

  try {
    await api.put('/api/v1/users/me/push-token', { token })
  } catch {
    // Non-critical
  }
}

