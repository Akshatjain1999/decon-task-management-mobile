import React, { useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
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

type Nav = NativeStackNavigationProp<RootStackParamList, 'TaskList'>

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
  const { tasks, loading } = useAppSelector((s) => s.tasks)

  const load = useCallback(() => { dispatch(fetchTasks()) }, [dispatch])

  useEffect(() => { load() }, [load])

  if (loading && tasks.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a237e" />
      </View>
    )
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={tasks}
      keyExtractor={(t) => String(t.id)}
      renderItem={({ item }) => <TaskCard task={item} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      ListEmptyComponent={<Text style={styles.empty}>No tasks found.</Text>}
    />
  )
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f0f4ff' },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  taskTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaText: { fontSize: 12, color: '#666' },
  assignee: { fontSize: 12, color: '#555', marginTop: 6 },
  empty: { textAlign: 'center', color: '#999', marginTop: 60 },
})
