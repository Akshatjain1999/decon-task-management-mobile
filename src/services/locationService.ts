import * as Location from 'expo-location'
import api from './api'

/**
 * Gets the device's current GPS position and sends it to the backend.
 * Silently no-ops if permission is not granted or the request fails.
 */
export async function pushCurrentLocation(): Promise<void> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync()
    if (status !== 'granted') return

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })

    await api.put('/api/v1/users/me/location', {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    })
  } catch {
    // Non-fatal — location is best-effort
  }
}
