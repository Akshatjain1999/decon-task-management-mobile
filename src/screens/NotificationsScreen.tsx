import React, { useEffect, useCallback, useState } from 'react'
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchNotifications, markRead, markAllRead } from '../store/notificationSlice'
import type { Notification, NotificationType } from '../types'

type FilterKey = NotificationType | 'ALL'

const TYPE_META: Record<NotificationType, {
  label: string; icon: string; accent: string; accentLight: string
}> = {
  TASK_ASSIGNED: { label: 'Task Assigned',  icon: '👤', accent: '#0369a1', accentLight: '#e0f2fe' },
  TASK_UPDATED:  { label: 'Task Updated',   icon: '✏️', accent: '#006a66', accentLight: '#e6f4f3' },
  REMINDER:      { label: 'Reminders',      icon: '🔔', accent: '#7c3aed', accentLight: '#ede9fe' },
  OVERDUE_ALERT: { label: 'Overdue Alerts', icon: '⚠️', accent: '#ba1a1a', accentLight: '#ffdad6' },
  MENTION:       { label: 'Mentions',       icon: '💬', accent: '#006a66', accentLight: '#e6f7f6' },
}

const TYPE_ORDER: NotificationType[] = ['MENTION', 'OVERDUE_ALERT', 'REMINDER', 'TASK_ASSIGNED', 'TASK_UPDATED']

const FILTER_TABS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'ALL',           label: 'All',       icon: '🔔' },
  { key: 'MENTION',       label: 'Mentions',  icon: '💬' },
  { key: 'OVERDUE_ALERT', label: 'Overdue',   icon: '⚠️' },
  { key: 'REMINDER',      label: 'Reminders', icon: '⏰' },
  { key: 'TASK_ASSIGNED', label: 'Assigned',  icon: '👤' },
  { key: 'TASK_UPDATED',  label: 'Updated',   icon: '✏️' },
]

type Section = { type: NotificationType; data: Notification[] }

function SectionHeader({ section }: { section: Section }) {
  const meta = TYPE_META[section.type]
  const unread = section.data.filter(n => !n.isRead).length
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIconBox, { backgroundColor: meta.accentLight }]}>
        <Text style={styles.sectionIconText}>{meta.icon}</Text>
      </View>
      <Text style={styles.sectionLabel}>{meta.label.toUpperCase()}</Text>
      <View style={styles.sectionCountRow}>
        <Text style={styles.sectionTotal}>{section.data.length}</Text>
        {unread > 0 && (
          <View style={[styles.sectionBadge, { backgroundColor: meta.accent }]}>
            <Text style={styles.sectionBadgeText}>{unread}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

function NotificationRow({ item, onRead }: { item: Notification; onRead: (id: number) => void }) {
  const meta = TYPE_META[item.type]
  return (
    <View style={[styles.row, item.isRead && styles.rowRead]}>
      <View style={styles.dotCol}>
        {!item.isRead && <View style={[styles.dot, { backgroundColor: meta.accent }]} />}
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowMsg, item.isRead && styles.rowMsgRead]}>{item.message}</Text>
        <Text style={styles.rowTime}>{formatTimeAgo(item.createdAt)}</Text>
      </View>
      {!item.isRead && (
        <TouchableOpacity
          style={[styles.checkBtn, { backgroundColor: meta.accentLight }]}
          onPress={() => onRead(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.checkBtnText, { color: meta.accent }]}>✓</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function NotificationsScreen() {
  const dispatch = useAppDispatch()
  const { notifications, unreadCount, loading } = useAppSelector(s => s.notifications)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL')

  const load = useCallback(() => { dispatch(fetchNotifications()) }, [dispatch])
  useEffect(() => { load() }, [load])

  const grouped = TYPE_ORDER.reduce<Record<NotificationType, Notification[]>>((acc, t) => {
    acc[t] = notifications.filter(n => n.type === t)
    return acc
  }, {} as Record<NotificationType, Notification[]>)

  const sections: Section[] = TYPE_ORDER
    .filter(t => (activeFilter === 'ALL' || activeFilter === t) && grouped[t].length > 0)
    .map(type => ({ type, data: grouped[type] }))

  const tabUnread = (key: FilterKey) =>
    key === 'ALL'
      ? unreadCount
      : notifications.filter(n => n.type === key && !n.isRead).length

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            {loading ? 'Loading…' : unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={() => dispatch(markAllRead())}>
            <Text style={styles.markAllText}>✓✓  Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContent}
      >
        {FILTER_TABS.map(tab => {
          const isActive = activeFilter === tab.key
          const count = tabUnread(tab.key)
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveFilter(tab.key)}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              {count > 0 && (
                <View style={[styles.tabBadge, isActive ? styles.tabBadgeActive : styles.tabBadgeInactive]}>
                  <Text style={styles.tabBadgeText}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Content card */}
      <View style={styles.card}>
        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} color="#006a66" size="large" />
        ) : sections.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconBox}>
              <Text style={styles.emptyIcon}>🔕</Text>
            </View>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'ALL'
                ? "You're all caught up!"
                : `No ${TYPE_META[activeFilter as NotificationType]?.label.toLowerCase()} yet`}
            </Text>
          </View>
        ) : (
          <SectionList<Notification, Section>
            sections={sections}
            keyExtractor={item => String(item.id)}
            renderSectionHeader={({ section }) => <SectionHeader section={section} />}
            renderItem={({ item }) => <NotificationRow item={item} onRead={id => dispatch(markRead(id))} />}
            renderSectionFooter={({ section }) =>
              sections.indexOf(section) < sections.length - 1
                ? <View style={styles.sectionSep} />
                : null
            }
            ItemSeparatorComponent={() => <View style={styles.itemSep} />}
            stickySectionHeadersEnabled
            refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
            contentContainerStyle={{ paddingBottom: 16 }}
          />
        )}
      </View>
    </SafeAreaView>
  )
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fb' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#041627', letterSpacing: -0.4 },
  subtitle: { fontSize: 12, color: '#9aa0a6', marginTop: 2 },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#e6f4f3',
    borderWidth: 1,
    borderColor: 'rgba(0,106,102,0.2)',
  },
  markAllText: { fontSize: 12, fontWeight: '700', color: '#006a66' },

  tabsScroll: { maxHeight: 42, marginBottom: 10 },
  tabsContent: { paddingHorizontal: 16, gap: 6, flexDirection: 'row', alignItems: 'center' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eceef0',
  },
  tabActive: { backgroundColor: '#041627', borderColor: '#041627' },
  tabIcon: { fontSize: 12 },
  tabLabel: { fontSize: 12, fontWeight: '600', color: '#44474c' },
  tabLabelActive: { color: '#fff' },
  tabBadge: { borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tabBadgeInactive: { backgroundColor: '#ba1a1a' },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  card: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eceef0',
    overflow: 'hidden',
    shadowColor: '#041627',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f7f9fb',
    borderBottomWidth: 1,
    borderBottomColor: '#eceef0',
  },
  sectionIconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionIconText: { fontSize: 14 },
  sectionLabel: { flex: 1, fontSize: 10, fontWeight: '700', color: '#44474c', letterSpacing: 1 },
  sectionCountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTotal: { fontSize: 12, color: '#9aa0a6' },
  sectionBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  sectionBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  rowRead: { backgroundColor: '#fafbfc', opacity: 0.75 },
  dotCol: { width: 12, paddingTop: 5, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowContent: { flex: 1, marginLeft: 10 },
  rowMsg: { fontSize: 13, color: '#041627', fontWeight: '600', lineHeight: 18 },
  rowMsgRead: { fontWeight: '400', color: '#44474c' },
  rowTime: { fontSize: 11, color: '#9aa0a6', marginTop: 4 },
  checkBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 8, marginTop: 2 },
  checkBtnText: { fontSize: 15, fontWeight: '700' },

  sectionSep: { height: 4, backgroundColor: '#f0f2f4' },
  itemSep: { height: 1, backgroundColor: '#f0f2f4', marginLeft: 38 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIconBox: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#f7f9fb', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#041627' },
  emptySubtitle: { fontSize: 12, color: '#9aa0a6', marginTop: 4, textAlign: 'center' },
})
