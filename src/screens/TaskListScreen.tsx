import React, { useEffect, useCallback, useState, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchTasks } from '../store/taskSlice'
import type { Task, TaskStatus } from '../types'
import type { RootStackParamList } from '../navigation/types'

const STATUS_COLORS: Record<TaskStatus, string> = {
  OPEN: '#1565C0',
  IN_PROGRESS: '#E65100',
  COMPLETED: '#2E7D32',
  OVERDUE: '#ba1a1a',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#4caf50',
  MEDIUM: '#ff9800',
  HIGH: '#f44336',
  CRITICAL: '#9c27b0',
}

const FILTER_TABS: Array<TaskStatus | 'ALL'> = ['ALL', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE']

type Nav = NativeStackNavigationProp<RootStackParamList>

function TaskCard({ task }: { task: Task }) {
  const navigation = useNavigation<Nav>()
  const due = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}>
      <View style={styles.cardHeader}>
        <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_COLORS[task.status] + '22' }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLORS[task.status] }]}>
            {task.status.replace('_', ' ')}
          </Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[task.priority] ?? '#999' }]} />
        <Text style={styles.metaText}>{task.priority}</Text>
        {due && <Text style={[styles.metaText, { marginLeft: 12 }]}>Due {due}</Text>}
      </View>
      {task.assignedTo && (
        <Text style={styles.assignee}>👤 {task.assignedTo.name}</Text>
      )}
    </TouchableOpacity>
  )
}

export default function TaskListScreen() {
  const dispatch = useAppDispatch()
  const navigation = useNavigation<Nav>()
  const { tasks, loading } = useAppSelector((s) => s.tasks)
  const [filter, setFilter] = useState<TaskStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')

  const load = useCallback(() => { dispatch(fetchTasks()) }, [dispatch])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const byStatus = filter === 'ALL' ? tasks : tasks.filter((t) => t.status === filter)
    const q = search.trim().toLowerCase()
    if (!q) return byStatus
    return byStatus.filter((t) => {
      if (t.title.toLowerCase().includes(q)) return true
      if (t.description?.toLowerCase().includes(q)) return true
      if (t.assignedTo?.name.toLowerCase().includes(q)) return true
      if (t.tags?.some((tag) => tag.name.toLowerCase().includes(q))) return true
      return false
    })
  }, [tasks, filter, search])

  if (loading && tasks.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#006a66" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search tasks, people, tags…"
          placeholderTextColor="#9aa0a6"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <FlatList
        horizontal
        data={FILTER_TABS}
        keyExtractor={(s) => s}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterList}
        renderItem={({ item: tab }) => (
          <TouchableOpacity
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
              {tab === 'ALL' ? 'All' : tab.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Task list */}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.content}
        data={filtered}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => <TaskCard task={item} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#006a66" colors={['#006a66']} />}
        ListEmptyComponent={<Text style={styles.empty}>No tasks found.</Text>}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateTask')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7f8' },
  list: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 80 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12,
    backgroundColor: '#fff', borderRadius: 12, height: 42,
    borderWidth: 1, borderColor: '#e0e3e5',
  },
  searchIcon: { fontSize: 14, color: '#9aa0a6' },
  searchInput: { flex: 1, fontSize: 14, color: '#191c1e', paddingVertical: 0 },
  searchClear: { fontSize: 14, color: '#9aa0a6', paddingHorizontal: 4 },

  filterList: { flexGrow: 0 },
  filterRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: 'center' },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0e3e5',
    height: 34,
    justifyContent: 'center',
  },
  filterTabActive: { backgroundColor: '#006a66', borderColor: '#006a66' },
  filterTabText: { fontSize: 12, fontWeight: '600', color: '#737c7f' },
  filterTabTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#191c1e' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  metaText: { fontSize: 12, color: '#737c7f' },
  assignee: { fontSize: 12, color: '#44474c', marginTop: 6 },
  empty: { textAlign: 'center', color: '#9aa0a6', marginTop: 60 },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#006a66',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '300' },
})
