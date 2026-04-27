import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { notificationService } from '../services/notificationService'
import type { Notification, NotificationType } from '../types'

const TYPE_ICON: Record<NotificationType, string> = {
  TASK_ASSIGNED: '📋',
  TASK_UPDATED: '✏️',
  REMINDER: '🔔',
  OVERDUE_ALERT: '⚠️',
}

const TYPE_COLOR: Record<NotificationType, string> = {
  TASK_ASSIGNED: '#1565C0',
  TASK_UPDATED: '#6a1b9a',
  REMINDER: '#E65100',
  OVERDUE_ALERT: '#ba1a1a',
}

function NotificationItem({
  item,
  onRead,
}: {
  item: Notification
  onRead: (id: number) => void
}) {
  const timeAgo = formatTimeAgo(item.createdAt)

  return (
    <TouchableOpacity
      style={[styles.item, item.isRead && styles.itemRead]}
      onPress={() => !item.isRead && onRead(item.id)}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{TYPE_ICON[item.type] ?? '🔔'}</Text>
      <View style={styles.itemBody}>
        <View style={[styles.typeBadge, { backgroundColor: TYPE_COLOR[item.type] + '20' }]}>
          <Text style={[styles.typeText, { color: TYPE_COLOR[item.type] }]}>
            {item.type.replace('_', ' ')}
          </Text>
        </View>
        <Text style={[styles.message, item.isRead && styles.messageRead]}>{item.message}</Text>
        <Text style={styles.time}>{timeAgo}</Text>
      </View>
      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  )
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await notificationService.getMyNotifications()
      setNotifications(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const markRead = async (id: number) => {
    await notificationService.markAsRead(id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    )
  }

  const markAllRead = async () => {
    await notificationService.markAllAsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
          <Text style={styles.markAllText}>Mark all as read ({unreadCount})</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={notifications}
        keyExtractor={(n) => String(n.id)}
        renderItem={({ item }) => <NotificationItem item={item} onRead={markRead} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 60 }} color="#1a237e" />
          ) : (
            <Text style={styles.empty}>No notifications yet.</Text>
          )
        }
        contentContainerStyle={styles.list}
      />
    </View>
  )
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  list: { padding: 16, gap: 10 },
  markAllBtn: {
    backgroundColor: '#e8eaf6',
    padding: 12,
    alignItems: 'center',
  },
  markAllText: { color: '#1a237e', fontWeight: '600', fontSize: 13 },
  item: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  itemRead: { opacity: 0.65 },
  icon: { fontSize: 24, marginTop: 2 },
  itemBody: { flex: 1, gap: 4 },
  typeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeText: { fontSize: 10, fontWeight: '700' },
  message: { fontSize: 13, color: '#222', lineHeight: 18 },
  messageRead: { color: '#888' },
  time: { fontSize: 11, color: '#bbb' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ba1a1a',
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  empty: { textAlign: 'center', color: '#999', marginTop: 60 },
})
