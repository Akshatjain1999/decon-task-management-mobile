import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppSelector } from '../store/hooks'
import { dashboardService } from '../services/dashboardService'
import type { DashboardStats } from '../types'

const STAT_CARDS = [
  { key: 'totalTasks', label: 'Total Tasks', color: '#1a237e', bg: '#e8eaf6' },
  { key: 'openTasks', label: 'Open', color: '#0277bd', bg: '#e1f5fe' },
  { key: 'inProgressTasks', label: 'In Progress', color: '#e65100', bg: '#fff3e0' },
  { key: 'completedTasks', label: 'Completed', color: '#2e7d32', bg: '#e8f5e9' },
  { key: 'overdueTasks', label: 'Overdue', color: '#c62828', bg: '#ffebee' },
  { key: 'totalUsers', label: 'Users', color: '#6a1b9a', bg: '#f3e5f5' },
] as const

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#2e7d32',
  MEDIUM: '#e65100',
  HIGH: '#b71c1c',
  CRITICAL: '#4a148c',
}

export default function DashboardScreen() {
  const user = useAppSelector((s) => s.auth.user)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await dashboardService.getStats()
      setStats(data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    load()
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a237e" />
      </View>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f6fa' }} edges={['top']}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
        <Text style={styles.subtitle}>Here's your overview</Text>
      </View>

      {/* Stats grid */}
      <View style={styles.grid}>
        {STAT_CARDS.map(({ key, label, color, bg }) => (
          <View key={key} style={[styles.card, { backgroundColor: bg }]}>
            <Text style={[styles.cardValue, { color }]}>
              {stats ? stats[key as keyof DashboardStats] as number : '—'}
            </Text>
            <Text style={[styles.cardLabel, { color }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* By priority */}
      {stats?.tasksByPriority && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tasks by Priority</Text>
          {Object.entries(stats.tasksByPriority).map(([priority, count]) => {
            const total = stats.totalTasks || 1
            const pct = Math.round((count / total) * 100)
            return (
              <View key={priority} style={styles.priorityRow}>
                <Text style={[styles.priorityLabel, { color: PRIORITY_COLORS[priority] ?? '#333' }]}>
                  {priority}
                </Text>
                <View style={styles.barBg}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${pct}%`, backgroundColor: PRIORITY_COLORS[priority] ?? '#333' },
                    ]}
                  />
                </View>
                <Text style={styles.priorityCount}>{count}</Text>
              </View>
            )
          })}
        </View>
      )}
    </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 20 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#1a237e' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  card: {
    width: '47%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cardValue: { fontSize: 28, fontWeight: '800' },
  cardLabel: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a237e', marginBottom: 12 },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  priorityLabel: { width: 70, fontSize: 12, fontWeight: '700' },
  barBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4 },
  priorityCount: { fontSize: 12, color: '#333', width: 24, textAlign: 'right' },
})
