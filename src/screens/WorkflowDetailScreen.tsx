import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { dashboardService } from '../services/dashboardService'
import type { PipelineTaskItem } from '../types'
import type { RootStackParamList } from '../navigation/types'

type Route = RouteProp<RootStackParamList, 'WorkflowDetail'>

const TASK_TYPE_META: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  CCTV_INSTALLATION:  { label: 'CCTV Installation',  color: '#006a66', bg: '#e8faf9', emoji: '📹' },
  LIFT_INSTALLATION:  { label: 'Lift Installation',  color: '#180092', bg: '#f0eeff', emoji: '🛗' },
  RACKS_INSTALLATION: { label: 'Racks Installation', color: '#7d3600', bg: '#fff4ec', emoji: '🗄️' },
}

const FILTER_META: Record<string, { label: string; bg: string; text: string; accent: string; description: string }> = {
  WCC_PENDING:       { label: 'WCC Pending',       bg: '#fff8e1', text: '#b45309', accent: '#fde68a', description: 'Installation complete — waiting for WCC to be done.' },
  WCC_COMPLETED:     { label: 'WCC Completed',     bg: '#dcfce7', text: '#166534', accent: '#86efac', description: 'WCC has been completed on these tasks.' },
  BILLING_PENDING:   { label: 'Billing Pending',   bg: '#fef2f2', text: '#ba1a1a', accent: '#fca5a5', description: 'WCC done — waiting for billing to be completed.' },
  BILLING_COMPLETED: { label: 'Billing Completed', bg: '#f0fdf4', text: '#15803d', accent: '#4ade80', description: 'Billing has been completed on these tasks.' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  COMPLETED:   { bg: '#dcfce7', text: '#166534' },
  IN_PROGRESS: { bg: '#e2dfff', text: '#180092' },
  OPEN:        { bg: '#e0e3e5', text: '#44474c' },
  OVERDUE:     { bg: '#ffdad6', text: '#ba1a1a' },
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: '#ffdad6', text: '#ba1a1a' },
  HIGH:     { bg: '#fde68a', text: '#92400e' },
  MEDIUM:   { bg: '#e2dfff', text: '#180092' },
  LOW:      { bg: '#e0e3e5', text: '#44474c' },
}

export default function WorkflowDetailScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<Route>()
  const { typeKey, filter } = route.params

  const typeMeta = TASK_TYPE_META[typeKey] ?? { label: typeKey, color: '#041627', bg: '#f2f4f6', emoji: '📋' }
  const filterMeta = FILTER_META[filter] ?? { label: filter, bg: '#e0e3e5', text: '#44474c', accent: '#c0c4c8', description: '' }

  const [tasks, setTasks] = useState<PipelineTaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  const load = async () => {
    try {
      const data = await dashboardService.getWorkflowTasks(typeKey, filter)
      setTasks(data)
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [typeKey, filter])

  const onRefresh = () => { setRefreshing(true); load() }

  const filtered = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.assignedToName ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {/* breadcrumb badges */}
          <View style={styles.breadcrumb}>
            <View style={[styles.badge, { backgroundColor: typeMeta.bg }]}>
              <Text style={styles.badgeEmoji}>{typeMeta.emoji}</Text>
              <Text style={[styles.badgeLabel, { color: typeMeta.color }]}>{typeMeta.label}</Text>
            </View>
            <Text style={styles.breadcrumbSep}>›</Text>
            <View style={[styles.badge, { backgroundColor: filterMeta.bg }]}>
              <Text style={[styles.badgeLabel, { color: filterMeta.text }]}>{filterMeta.label}</Text>
            </View>
          </View>
          <Text style={styles.title}>{filterMeta.label}</Text>
          <Text style={styles.desc}>{filterMeta.description}</Text>
        </View>
        {!loading && (
          <View style={[styles.countPill, { backgroundColor: filterMeta.bg }]}>
            <Text style={[styles.countPillText, { color: filterMeta.text }]}>
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={typeMeta.color} />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: filterMeta.bg }]}>
            <Text style={{ fontSize: 28 }}>📋</Text>
          </View>
          <Text style={styles.emptyTitle}>No tasks found</Text>
          <Text style={styles.emptyDesc}>
            There are no tasks matching "{filterMeta.label}" for {typeMeta.label}.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={typeMeta.color} />}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by title or assignee…"
              placeholderTextColor="#9aa5b1"
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
          </View>

          {search.length > 0 && (
            <Text style={styles.resultCount}>
              Showing {filtered.length} of {tasks.length} tasks
            </Text>
          )}

          {/* Task cards */}
          <View style={[styles.card, { padding: 0 }]}>
            {filtered.length === 0 ? (
              <Text style={styles.emptyText}>No tasks match your search.</Text>
            ) : (
              filtered.map((task, i) => {
                const sc = STATUS_COLORS[task.status] ?? { bg: '#e0e3e5', text: '#44474c' }
                const pc = PRIORITY_COLORS[task.priority] ?? { bg: '#e0e3e5', text: '#44474c' }
                const isLast = i === filtered.length - 1
                return (
                  <TouchableOpacity
                    key={task.id}
                    onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
                    activeOpacity={0.75}
                    style={[styles.taskRow, isLast && { borderBottomWidth: 0 }]}
                  >
                    {/* assignee avatar */}
                    <View style={[styles.avatar, { backgroundColor: typeMeta.bg }]}>
                      <Text style={[styles.avatarText, { color: typeMeta.color }]}>
                        {(task.assignedToName ?? '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    {/* title + assignee */}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
                      {task.assignedToName ? (
                        <Text style={styles.taskAssignee}>{task.assignedToName}</Text>
                      ) : (
                        <Text style={styles.taskUnassigned}>Unassigned</Text>
                      )}
                    </View>

                    {/* badges */}
                    <View style={styles.badges}>
                      <View style={[styles.pill, { backgroundColor: pc.bg }]}>
                        <Text style={[styles.pillText, { color: pc.text }]}>{task.priority}</Text>
                      </View>
                      <View style={[styles.pill, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.pillText, { color: sc.text }]}>{task.status.replace('_', ' ')}</Text>
                      </View>
                    </View>

                    <Text style={[styles.arrow, { color: typeMeta.color }]}>›</Text>
                  </TouchableOpacity>
                )
              })
            )}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f9fb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32 },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eceef0',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#e0e3e5',
    alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0,
  },
  backArrow: { fontSize: 22, color: '#041627', fontWeight: '300', marginTop: -2 },

  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6, flexWrap: 'wrap' },
  breadcrumbSep: { fontSize: 12, color: '#9aa5b1' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeEmoji: { fontSize: 11 },
  badgeLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },

  title: { fontSize: 20, fontWeight: '800', color: '#041627', letterSpacing: -0.3 },
  desc: { fontSize: 11, color: '#44474c', marginTop: 2, lineHeight: 16 },

  countPill: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, flexShrink: 0, marginTop: 2,
  },
  countPillText: { fontSize: 11, fontWeight: '700' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#eceef0', marginBottom: 12,
    shadowColor: '#041627', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 13, color: '#041627' },

  resultCount: { fontSize: 10, color: '#44474c', marginBottom: 8 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 12,
    shadowColor: '#041627', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 2, borderWidth: 1, borderColor: '#eceef0', overflow: 'hidden',
  },

  taskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#eceef0',
  },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 13, fontWeight: '700' },
  taskTitle: { fontSize: 13, fontWeight: '600', color: '#041627', lineHeight: 18 },
  taskAssignee: { fontSize: 10, color: '#44474c', marginTop: 1 },
  taskUnassigned: { fontSize: 10, color: '#9aa5b1', fontStyle: 'italic', marginTop: 1 },

  badges: { flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 },
  pill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20 },
  pillText: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },

  arrow: { fontSize: 22, fontWeight: '300', flexShrink: 0 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#041627', marginBottom: 6 },
  emptyDesc: { fontSize: 12, color: '#44474c', textAlign: 'center', lineHeight: 18 },
  emptyText: { fontSize: 12, color: '#44474c', padding: 20, textAlign: 'center' },
})
