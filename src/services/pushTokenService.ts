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
 * We listen for FCM onMessage (foreground event), then schedule a local notification
 * via expo-notifications so a local alert banner is displayed to the user.
 */
export function setupNotificationHandler(): void {
  if (isExpoGo()) return
  
  // Dynamic requires so these native modules are never loaded in Expo Go
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const messaging = require('@react-native-firebase/messaging').default
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Notifications = require('expo-notifications')

  // Configure how local alerts behave when displayed in the foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })

  // Listen to incoming foreground messages from Firebase
  messaging().onMessage(async (remoteMessage: any) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: remoteMessage.notification?.title || 'Decon Notification',
          body: remoteMessage.notification?.body || '',
          data: remoteMessage.data || {},
        },
        trigger: null, // deliver immediately
      })
    } catch (err) {
      console.warn('Failed to schedule local foreground notification:', err)
    }
  })
}

/**
 * Listens for notification taps (both background taps and app launched from notification).
 * Calls onTap(taskId, subtaskId?) when the payload contains a taskId.
 */
export function addNotificationTapListener(
  onTap: (taskId: string, subtaskId?: string) => void,
): { remove: () => void } | undefined {
  if (isExpoGo()) return undefined

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const messaging = require('@react-native-firebase/messaging').default
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Notifications = require('expo-notifications')

  const subscriptions: Array<() => void> = []

  // 1. Listen for background notification taps while the app is running/paused
  const unsubscribeFcmTap = messaging().onNotificationOpenedApp((remoteMessage: any) => {
    const data = remoteMessage?.data
    if (data?.taskId) {
      onTap(String(data.taskId), data.subtaskId ? String(data.subtaskId) : undefined)
    }
  })
  subscriptions.push(unsubscribeFcmTap)

  // 2. Check if the app was opened from a terminated state via a Firebase notification
  messaging()
    .getInitialNotification()
    .then((remoteMessage: any) => {
      if (remoteMessage) {
        const data = remoteMessage?.data
        if (data?.taskId) {
          onTap(String(data.taskId), data.subtaskId ? String(data.subtaskId) : undefined)
        }
      }
    })
    .catch((err: any) => console.warn('Error reading initial FCM notification:', err))

  // 3. Keep expo-notifications tap listener as a fallback (e.g. for foreground-triggered local alerts)
  const expoSubscription = Notifications.addNotificationResponseReceivedListener(
    (response: any) => {
      const data = response?.notification?.request?.content?.data as Record<string, any>
      if (data?.taskId) {
        onTap(String(data.taskId), data.subtaskId ? String(data.subtaskId) : undefined)
      }
    },
  )
  subscriptions.push(() => expoSubscription.remove())

  return {
    remove: () => {
      subscriptions.forEach((unsub) => {
        try {
          unsub()
        } catch {
          // ignore
        }
      })
    },
  }
}

/**
 * Requests notification permissions from FCM, retrieves the device's native token,
 * and saves it to the backend database.
 */
export async function registerPushToken(): Promise<void> {
  if (isExpoGo()) return
  if (!Device.isDevice) return

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const messaging = require('@react-native-firebase/messaging').default
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Notifications = require('expo-notifications')

  // Set up the default notification channel for Android foreground notifications
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#006a66',
      sound: 'default',
    })
  }

  try {
    // Request permission from native system via Firebase
    const authStatus = await messaging().requestPermission()
    const enabled =
      authStatus === 1 || // AuthorizationStatus.AUTHORIZED
      authStatus === 2;   // AuthorizationStatus.PROVISIONAL

    if (enabled) {
      // Get the native FCM push token
      const token = await messaging().getToken()
      if (token) {
        await api.put('/api/v1/users/me/push-token', { token })
        console.log('FCM Push Token successfully registered to backend:', token)
      }
    }
  } catch (error) {
    console.warn('Failed to fetch and register Firebase push token:', error)
  }
}
