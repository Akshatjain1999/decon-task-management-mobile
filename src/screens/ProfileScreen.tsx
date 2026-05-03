import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { logout } from '../store/authSlice'
import * as Updates from 'expo-updates'

export default function ProfileScreen() {
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)
  const [updateChecking, setUpdateChecking] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'up-to-date' | 'downloading' | null>(null)

  const handleCheckUpdate = async () => {
    // expo-updates does not work in Expo Go
    if (!Updates.isEmbeddedLaunch !== undefined && (Updates as any).appOwnership === 'expo') {
      Alert.alert('Updates', 'OTA updates are not available in Expo Go.')
      return
    }
    setUpdateChecking(true)
    setUpdateStatus(null)
    try {
      const check = await Updates.checkForUpdateAsync()
      if (!check.isAvailable) {
        setUpdateStatus('up-to-date')
        return
      }
      setUpdateStatus('downloading')
      await Updates.fetchUpdateAsync()
      Alert.alert(
        'Update Ready',
        'A new version has been downloaded. The app will now restart.',
        [{ text: 'Restart', onPress: () => Updates.reloadAsync() }],
      )
    } catch {
      setUpdateStatus(null)
      Alert.alert('Update Check Failed', 'Could not check for updates. Please try again later.')
    } finally {
      setUpdateChecking(false)
    }
  }

  const updateBtnLabel = () => {
    if (updateChecking && updateStatus === 'downloading') return 'Downloading…'
    if (updateChecking) return 'Checking…'
    if (updateStatus === 'up-to-date') return '✓ App is up to date'
    return '⬆ Check for Updates'
  }

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => dispatch(logout()) },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role?.replace('_', ' ')}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.updateBtn, updateChecking && styles.updateBtnDisabled]}
        onPress={handleCheckUpdate}
        disabled={updateChecking}
      >
        {updateChecking ? <ActivityIndicator color="#006a66" style={{ marginRight: 8 }} /> : null}
        <Text style={[styles.updateText, updateStatus === 'up-to-date' && styles.updateTextDone]}>
          {updateBtnLabel()}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff', padding: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1a237e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 4 },
  email: { fontSize: 14, color: '#666', marginBottom: 12 },
  roleBadge: {
    backgroundColor: '#e8eaf6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleText: { fontSize: 12, fontWeight: '600', color: '#1a237e' },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#006a66',
    backgroundColor: '#e6f7f6',
  },
  updateBtnDisabled: { opacity: 0.6 },
  updateText: { color: '#006a66', fontWeight: '700', fontSize: 15 },
  updateTextDone: { color: '#2e7d32' },
  logoutBtn: {
    backgroundColor: '#ba1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
