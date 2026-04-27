import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import { taskService } from '../services/taskService'
import { useAppDispatch } from '../store/hooks'
import { updateTask } from '../store/taskSlice'
import type { Task, TaskStatus } from '../types'

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDetail'>

const STATUS_FLOW: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'COMPLETED']

const STATUS_COLORS: Record<TaskStatus, string> = {
  OPEN: '#1565C0',
  IN_PROGRESS: '#E65100',
  COMPLETED: '#2E7D32',
  OVERDUE: '#ba1a1a',
}

export default function TaskDetailScreen({ route, navigation }: Props) {
  const { taskId } = route.params
  const dispatch = useAppDispatch()
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    taskService
      .getById(taskId)
      .then(setTask)
      .catch(() => Alert.alert('Error', 'Failed to load task'))
      .finally(() => setLoading(false))
  }, [taskId])

  const advanceStatus = async () => {
    if (!task) return
    const idx = STATUS_FLOW.indexOf(task.status)
    if (idx === -1 || idx === STATUS_FLOW.length - 1) return
    const nextStatus = STATUS_FLOW[idx + 1]
    setUpdating(true)
    try {
      const updated = await taskService.update(taskId, { status: nextStatus })
      setTask(updated)
      dispatch(updateTask({ id: taskId, data: { status: nextStatus } }))
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a237e" />
      </View>
    )
  }

  if (!task) return null

  const due = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not set'

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(task.status) + 1]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[task.status] }]}>
        <Text style={styles.statusText}>{task.status.replace('_', ' ')}</Text>
      </View>

      <Text style={styles.title}>{task.title}</Text>

      {task.description ? (
        <Text style={styles.description}>{task.description}</Text>
      ) : null}

      {/* Meta row */}
      <View style={styles.metaGrid}>
        <MetaItem label="Priority" value={task.priority} />
        <MetaItem label="Due Date" value={due} />
        <MetaItem label="Assigned To" value={task.assignedTo?.name ?? 'Unassigned'} />
        <MetaItem label="Created By" value={task.createdBy?.name ?? '—'} />
        {task.categoryName && <MetaItem label="Category" value={task.categoryName} />}
        {task.estimateHours != null && (
          <MetaItem label="Estimate" value={`${task.estimateHours}h`} />
        )}
      </View>

      {/* Subtasks */}
      {task.subtasks?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Subtasks ({task.subtasksCompleted}/{task.subtasksTotal})
          </Text>
          {task.subtasks.map((sub) => (
            <View key={sub.id} style={styles.subtaskRow}>
              <Text style={styles.subtaskDot}>{sub.isComplete ? '✅' : '⬜'}</Text>
              <Text style={[styles.subtaskTitle, sub.isComplete && styles.strikethrough]}>
                {sub.title}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Advance status button */}
      {nextStatus && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: STATUS_COLORS[nextStatus] }]}
          onPress={advanceStatus}
          disabled={updating}
        >
          {updating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionBtnText}>
              Mark as {nextStatus.replace('_', ' ')}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 10 },
  description: { fontSize: 15, color: '#555', marginBottom: 16, lineHeight: 22 },
  metaGrid: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  metaItem: {},
  metaLabel: { fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 2 },
  metaValue: { fontSize: 14, color: '#222', fontWeight: '500' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  subtaskDot: { fontSize: 14 },
  subtaskTitle: { fontSize: 14, color: '#333', flex: 1 },
  strikethrough: { textDecorationLine: 'line-through', color: '#aaa' },
  actionBtn: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
