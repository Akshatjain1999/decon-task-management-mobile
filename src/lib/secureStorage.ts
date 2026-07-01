/**
 * Secure key-value storage backed by Android Keystore / iOS Keychain via
 * expo-secure-store.  Falls back to plain AsyncStorage on platforms that
 * don't support SecureStore (e.g. web).
 */
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

const isAvailable = SecureStore.isAvailableAsync

async function setItem(key: string, value: string): Promise<void> {
  if (await isAvailable()) {
    await SecureStore.setItemAsync(key, value)
  } else {
    await AsyncStorage.setItem(key, value)
  }
}

async function getItem(key: string): Promise<string | null> {
  if (await isAvailable()) {
    return SecureStore.getItemAsync(key)
  }
  return AsyncStorage.getItem(key)
}

async function removeItem(key: string): Promise<void> {
  if (await isAvailable()) {
    await SecureStore.deleteItemAsync(key)
  } else {
    await AsyncStorage.removeItem(key)
  }
}

export const secureStorage = { setItem, getItem, removeItem }
