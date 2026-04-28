import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  Dimensions,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import { API_BASE_URL } from '../services/api'
import { taskService } from '../services/taskService'
import { userService } from '../services/userService'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { updateTask, fetchTasks } from '../store/taskSlice'
import type { Task, TaskStatus, Comment, TaskAuditsResponse, Subtask, SubtaskNote, SubtaskStatus, User } from '../types'

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDetail'>
type Tab = 'details' | 'subtasks' | 'comments' | 'activity'

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<TaskStatus, { bg: string; text: string }> = {
  OPEN:        { bg: '#e8f1fb', text: '#1a56a0' },
  IN_PROGRESS: { bg: '#e6f7f6', text: '#006a66' },
  COMPLETED:   { bg: '#edf7ed', text: '#166534' },
  OVERDUE:     { bg: '#ffdad6', text: '#ba1a1a' },
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: '#ffdad6', text: '#ba1a1a' },
  HIGH:     { bg: '#180092', text: '#fff' },
  MEDIUM:   { bg: '#fff3e0', text: '#e65100' },
  LOW:      { bg: '#e8f5e9', text: '#2e7d32' },
}

const TASK_TYPE_LABELS: Record<string, string> = {
  CCTV_INSTALLATION: 'CCTV Installation',
  LIFT_INSTALLATION: 'Lift Installation',
  RACKS_INSTALLATION: 'Racks Installation',
}

const TASK_TYPE_ICONS: Record<string, string> = {
  CCTV_INSTALLATION:  '📹',
  LIFT_INSTALLATION:  '🛗',
  RACKS_INSTALLATION: '🗄️',
}

const SUBTASK_STATUS_COLORS: Record<string, string> = {
  TODO: '#666',
  IN_PROGRESS: '#e65100',
  DONE: '#2e7d32',
}

const AUDIT_CHANGE_LABELS: Record<string, string> = {
  CREATED: '🟢 Task Created',
  STATUS_CHANGED: '🔄 Status Changed',
  TITLE_CHANGED: '✏️ Title Updated',
  ASSIGNEE_CHANGED: '👤 Assignee Changed',
  PRIORITY_CHANGED: '⚡ Priority Changed',
  DUE_DATE_CHANGED: '📅 Due Date Changed',
  DESCRIPTION_CHANGED: '📝 Description Updated',
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function TaskDetailScreen({ route, navigation }: Props) {
  const { taskId } = route.params
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector((s) => s.auth.user)

  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('details')

  // Comments
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // Subtasks
  const [newSubtask, setNewSubtask] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [newSubtaskOwnerId, setNewSubtaskOwnerId] = useState<number | null>(null)
  const [showOwnerPicker, setShowOwnerPicker] = useState(false)
  const [statusPickerSubtask, setStatusPickerSubtask] = useState<{ id: number; status: SubtaskStatus } | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [togglingSubtaskId, setTogglingSubtaskId] = useState<number | null>(null)
  const [settingStatusId, setSettingStatusId] = useState<number | null>(null)
  const [expandedSubtaskId, setExpandedSubtaskId] = useState<number | null>(null)
  const [subtaskNotes, setSubtaskNotes] = useState<Record<number, SubtaskNote[]>>({})
  const [notesLoading, setNotesLoading] = useState<Record<number, boolean>>({})
  const [noteText, setNoteText] = useState<Record<number, string>>({})
  const [submittingNote, setSubmittingNote] = useState<number | null>(null)
  const [noteAttachment, setNoteAttachment] = useState<Record<number, { uri: string; name: string; type: string } | null>>({})

  const handlePickAttachment = async (subtaskId: number) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false })
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0]
        setNoteAttachment((prev) => ({
          ...prev,
          [subtaskId]: { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' },
        }))
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not pick file')
    }
  }

  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const handleOpenAttachment = async (noteId: number, fileName: string, mimeType?: string | null) => {
    try {
      const token = await AsyncStorage.getItem('auth_token')
      const url = `${API_BASE_URL}/api/v1/subtasks/notes/${noteId}/attachment`
      const localUri = (FileSystem.cacheDirectory ?? '') + fileName
      const { uri } = await FileSystem.downloadAsync(url, localUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const isImage = mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(fileName)
      if (isImage) {
        setPreviewImage(uri)
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: mimeType ?? undefined })
      } else {
        Alert.alert('Error', 'Sharing is not available on this device')
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not open attachment')
    }
  }

  // Audits
  const [audits, setAudits] = useState<TaskAuditsResponse | null>(null)
  const [auditsLoading, setAuditsLoading] = useState(false)

  // Status change
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const loadTask = useCallback(async () => {
    try {
      const data = await taskService.getById(taskId)
      setTask(data)
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load task')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => { loadTask() }, [loadTask])

  useEffect(() => {
    userService.getAll().then(setUsers).catch(() => {})
  }, [])

  const loadAudits = useCallback(async () => {
    if (audits || auditsLoading) return
    setAuditsLoading(true)
    try {
      const data = await taskService.getAudits(taskId)
      setAudits(data)
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load activity')
    } finally {
      setAuditsLoading(false)
    }
  }, [taskId, audits, auditsLoading])

  useEffect(() => {
    if (activeTab === 'activity') loadAudits()
  }, [activeTab, loadAudits])

  // ─── Status change ─────────────────────────────────────────────────────
  const changeStatus = async (newStatus: TaskStatus) => {
    if (!task) return
    setUpdatingStatus(true)
    try {
      const updated = await taskService.update(taskId, { status: newStatus })
      setTask(updated)
      dispatch(updateTask({ id: taskId, data: { status: newStatus } }))
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const showStatusPicker = () => {
    const options: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'COMPLETED']
    Alert.alert(
      'Change Status',
      `Current: ${task?.status?.replace(/_/g, ' ')}`,
      [
        ...options.map((s) => ({
          text: s.replace(/_/g, ' '),
          onPress: () => changeStatus(s),
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    )
  }

  // ─── Delete ────────────────────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert(
      'Delete Task',
      `Permanently delete "${task?.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await taskService.delete(taskId)
              dispatch(fetchTasks())
              navigation.goBack()
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete task')
            }
          },
        },
      ],
    )
  }

  // ─── Comments ──────────────────────────────────────────────────────────
  const handleAddComment = async () => {
    if (!task || !commentText.trim()) return
    setSubmittingComment(true)
    try {
      const comment = await taskService.addComment(task.id, commentText.trim())
      setTask((prev) => prev ? { ...prev, comments: [...(prev.comments || []), comment], commentsCount: prev.commentsCount + 1 } : prev)
      setCommentText('')
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to post comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeleteComment = (commentId: number) => {
    if (!task) return
    Alert.alert('Delete Comment', 'Remove this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await taskService.deleteComment(task.id, commentId)
            setTask((prev) => prev ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId), commentsCount: prev.commentsCount - 1 } : prev)
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete comment')
          }
        },
      },
    ])
  }

  // ─── Subtasks ──────────────────────────────────────────────────────────
  const handleSetSubtaskStatus = (subtaskId: number, currentStatus: SubtaskStatus) => {
    setStatusPickerSubtask({ id: subtaskId, status: currentStatus })
  }

  const applySubtaskStatus = async (status: SubtaskStatus) => {
    if (!task || !statusPickerSubtask) return
    const subtaskId = statusPickerSubtask.id
    setStatusPickerSubtask(null)
    setSettingStatusId(subtaskId)
    try {
      const updated = await taskService.setSubtaskStatus(task.id, subtaskId, status)
      setTask((prev) => {
        if (!prev) return prev
        const subtasks = prev.subtasks.map((st) =>
          st.id === subtaskId ? { ...st, status: updated.status, isComplete: updated.isComplete } : st
        )
        return { ...prev, subtasks, subtasksCompleted: subtasks.filter((st) => st.isComplete).length }
      })
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update status')
    } finally {
      setSettingStatusId(null)
    }
  }

  const handleToggleNotes = async (subtaskId: number) => {
    if (expandedSubtaskId === subtaskId) {
      setExpandedSubtaskId(null)
      return
    }
    setExpandedSubtaskId(subtaskId)
    if (subtaskNotes[subtaskId]) return
    setNotesLoading((prev) => ({ ...prev, [subtaskId]: true }))
    try {
      const notes = await taskService.getSubtaskNotes(subtaskId)
      setSubtaskNotes((prev) => ({ ...prev, [subtaskId]: notes }))
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load notes')
    } finally {
      setNotesLoading((prev) => ({ ...prev, [subtaskId]: false }))
    }
  }

  const handleAddSubtaskNote = async (subtaskId: number) => {
    const text = noteText[subtaskId]?.trim()
    if (!text) return
    setSubmittingNote(subtaskId)
    try {
      const attachment = noteAttachment[subtaskId] ?? null
      const note = await taskService.addSubtaskNote(subtaskId, text, attachment)
      setSubtaskNotes((prev) => ({ ...prev, [subtaskId]: [...(prev[subtaskId] || []), note] }))
      setNoteText((prev) => ({ ...prev, [subtaskId]: '' }))
      setNoteAttachment((prev) => ({ ...prev, [subtaskId]: null }))
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add note')
    } finally {
      setSubmittingNote(null)
    }
  }

  const handleDeleteSubtaskNote = (subtaskId: number, noteId: number) => {
    Alert.alert('Delete Note', 'Remove this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await taskService.deleteSubtaskNote(noteId)
            setSubtaskNotes((prev) => ({ ...prev, [subtaskId]: prev[subtaskId].filter((n) => n.id !== noteId) }))
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete note')
          }
        },
      },
    ])
  }

  const handleToggleSubtask = async (subtaskId: number) => {
    if (!task) return
    setTogglingSubtaskId(subtaskId)
    try {
      const updated = await taskService.toggleSubtask(task.id, subtaskId)
      setTask((prev) => {
        if (!prev) return prev
        const subtasks = prev.subtasks.map((s) => s.id === subtaskId ? { ...s, isComplete: updated.isComplete, status: updated.status } : s)
        return { ...prev, subtasks, subtasksCompleted: subtasks.filter((s) => s.isComplete).length }
      })
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to toggle subtask')
    } finally {
      setTogglingSubtaskId(null)
    }
  }

  const handleAddSubtask = async () => {
    if (!task || !newSubtask.trim()) return
    setAddingSubtask(true)
    try {
      const subtask = await taskService.createSubtask(task.id, newSubtask.trim(), newSubtaskOwnerId)
      setTask((prev) => prev ? { ...prev, subtasks: [...prev.subtasks, subtask], subtasksTotal: prev.subtasksTotal + 1 } : prev)
      setNewSubtask('')
      setNewSubtaskOwnerId(null)
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add subtask')
    } finally {
      setAddingSubtask(false)
    }
  }

  const handleDeleteSubtask = (subtaskId: number) => {
    if (!task) return
    Alert.alert('Delete Subtask', 'Remove this subtask?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await taskService.deleteSubtask(task.id, subtaskId)
            setTask((prev) => prev ? { ...prev, subtasks: prev.subtasks.filter((s) => s.id !== subtaskId), subtasksTotal: prev.subtasksTotal - 1 } : prev)
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete subtask')
          }
        },
      },
    ])
  }

  // ─── Render ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a237e" />
      </View>
    )
  }

  if (!task) return null

  const pColor = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.MEDIUM
  const sBadge = STATUS_BADGE[task.status] ?? { bg: '#e0e3e5', text: '#44474c' }
  const completionPct = task.subtasksTotal > 0 ? Math.round((task.subtasksCompleted / task.subtasksTotal) * 100) : 0

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* ── Status picker modal ──────────────────────────────────────── */}
      <Modal visible={!!statusPickerSubtask} transparent animationType="slide" onRequestClose={() => setStatusPickerSubtask(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setStatusPickerSubtask(null)} />
        <View style={styles.ownerModal}>
          <View style={styles.ownerModalHandle} />
          <Text style={styles.ownerModalTitle}>Set Status</Text>
          {(['TODO', 'IN_PROGRESS', 'DONE'] as SubtaskStatus[]).map((s) => {
            const color = SUBTASK_STATUS_COLORS[s] ?? '#666'
            const isSelected = statusPickerSubtask?.status === s
            return (
              <TouchableOpacity
                key={s}
                style={[styles.ownerModalItem, isSelected && styles.ownerModalItemSelected]}
                onPress={() => applySubtaskStatus(s)}
              >
                <View style={[styles.statusDot, { backgroundColor: color }]} />
                <Text style={[styles.ownerModalItemText, isSelected && { color, fontWeight: '700' }]}>
                  {s.replace('_', ' ')}
                </Text>
                {isSelected && <Text style={{ color }}>✓</Text>}
              </TouchableOpacity>
            )
          })}
        </View>
      </Modal>

      {/* ── Owner picker modal ──────────────────────────────────────── */}
      <Modal visible={showOwnerPicker} transparent animationType="slide" onRequestClose={() => setShowOwnerPicker(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setShowOwnerPicker(false)} />
        <View style={styles.ownerModal}>
          <View style={styles.ownerModalHandle} />
          <Text style={styles.ownerModalTitle}>Assign Owner</Text>
          <TouchableOpacity
            style={[styles.ownerModalItem, !newSubtaskOwnerId && styles.ownerModalItemSelected]}
            onPress={() => { setNewSubtaskOwnerId(null); setShowOwnerPicker(false) }}
          >
            <Text style={[styles.ownerModalItemText, !newSubtaskOwnerId && { color: '#1a237e', fontWeight: '700' }]}>No owner</Text>
            {!newSubtaskOwnerId && <Text style={{ color: '#1a237e' }}>✓</Text>}
          </TouchableOpacity>
          <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
            {users.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={[styles.ownerModalItem, newSubtaskOwnerId === u.id && styles.ownerModalItemSelected]}
                onPress={() => { setNewSubtaskOwnerId(u.id); setShowOwnerPicker(false) }}
              >
                <View style={styles.ownerAvatar}>
                  <Text style={styles.ownerAvatarText}>{u.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ownerModalItemText, newSubtaskOwnerId === u.id && { color: '#1a237e', fontWeight: '700' }]}>{u.name}</Text>
                  <Text style={styles.ownerModalItemSub}>{u.role}</Text>
                </View>
                {newSubtaskOwnerId === u.id && <Text style={{ color: '#1a237e' }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Image preview modal ─────────────────────────────────────── */}
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 48, right: 20, zIndex: 10, padding: 8 }}
            onPress={() => setPreviewImage(null)}
          >
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.75 }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* ── Hero Header ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroContent}>
            {/* Pills row */}
            <View style={styles.pillsRow}>
              {task.taskType && (
                <View style={styles.pillGlass}>
                  <Text style={styles.pillGlassText}>
                    {TASK_TYPE_ICONS[task.taskType] ?? '📋'}  {TASK_TYPE_LABELS[task.taskType] ?? task.taskType}
                  </Text>
                </View>
              )}
              <View style={[styles.heroPill, { backgroundColor: pColor.bg }]}>
                <Text style={[styles.heroPillText, { color: pColor.text }]}>{task.priority}</Text>
              </View>
              <View style={[styles.heroPill, { backgroundColor: sBadge.bg }]}>
                <Text style={[styles.heroPillText, { color: sBadge.text }]}>{task.status.replace('_', ' ')}</Text>
              </View>
            </View>

            {/* Title */}
            <Text style={styles.heroTitle}>{task.title}</Text>

            {/* Tags */}
            {task.tags?.length > 0 && (
              <View style={styles.tagRow}>
                {task.tags.map((tag) => (
                  <View key={tag.id} style={[styles.tagChip, { backgroundColor: tag.color + '33', borderColor: tag.color + '55' }]}>
                    <Text style={[styles.tagChipText, { color: tag.color }]}>{tag.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Sub-meta row */}
            <View style={styles.heroMeta}>
              {task.createdBy && (
                <Text style={styles.heroMetaItem}>
                  <Text style={styles.heroMetaMuted}>Reporter  </Text>
                  <Text style={styles.heroMetaBold}>{task.createdBy.name}</Text>
                </Text>
              )}
              {task.assignedTo && (
                <Text style={styles.heroMetaItem}>
                  <Text style={styles.heroMetaMuted}>Assignee  </Text>
                  <Text style={styles.heroMetaBold}>{task.assignedTo.name}</Text>
                </Text>
              )}
              {task.dueDate && (
                <Text style={styles.heroMetaItem}>
                  <Text style={styles.heroMetaMuted}>Due  </Text>
                  <Text style={styles.heroMetaBold}>{formatDate(task.dueDate)}</Text>
                </Text>
              )}
              {task.subtasksTotal > 0 && (
                <Text style={styles.heroMetaItem}>
                  <Text style={styles.heroMetaBold}>{task.subtasksCompleted}/{task.subtasksTotal}</Text>
                  <Text style={styles.heroMetaMuted}> subtasks</Text>
                </Text>
              )}
            </View>
          </View>

          {/* Action bar */}
          <View style={styles.heroActionBar}>
            <TouchableOpacity
              style={styles.heroActionBtn}
              onPress={showStatusPicker}
              disabled={updatingStatus}
            >
              {updatingStatus
                ? <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" />
                : <Text style={styles.heroActionBtnText}>⚡ Change Status</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroDeleteBtn} onPress={handleDelete}>
              <Text style={styles.heroDeleteBtnText}>🗑 Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <View style={styles.tabBar}>
          {(['details', 'subtasks', 'comments', 'activity'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'details' ? 'Details'
                  : tab === 'subtasks' ? `Subtasks${task.subtasksTotal > 0 ? ` (${task.subtasksCompleted}/${task.subtasksTotal})` : ''}`
                  : tab === 'comments' ? `Comments${task.commentsCount > 0 ? ` (${task.commentsCount})` : ''}`
                  : 'Activity'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab Content ─────────────────────────────────────────────── */}
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">

          {/* DETAILS TAB */}
          {activeTab === 'details' && (
            <View>
              {task.description ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Description</Text>
                  <Text style={styles.descText}>{task.description}</Text>
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Details</Text>
                <MetaRow label="Status" value={task.status.replace('_', ' ')} />
                <MetaRow label="Priority" value={task.priority} />
                <MetaRow label="Due Date" value={formatDate(task.dueDate)} />
                <MetaRow label="Assigned To" value={task.assignedTo?.name ?? 'Unassigned'} />
                <MetaRow label="Created By" value={task.createdBy?.name ?? '—'} />
                <MetaRow label="Created" value={formatDate(task.createdAt)} />
                {task.updatedAt && <MetaRow label="Updated" value={formatDate(task.updatedAt)} />}
                {task.completedAt && <MetaRow label="Completed" value={formatDate(task.completedAt)} />}
                {task.categoryName && <MetaRow label="Category" value={task.categoryName} />}
                {task.estimateHours != null && <MetaRow label="Estimate" value={`${task.estimateHours}h`} />}
              </View>
            </View>
          )}

          {/* SUBTASKS TAB */}
          {activeTab === 'subtasks' && (
            <View>
              {/* Progress bar */}
              {task.subtasksTotal > 0 && (
                <View style={styles.section}>
                  <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>{completionPct}% complete</Text>
                    <Text style={styles.progressLabel}>{task.subtasksCompleted}/{task.subtasksTotal}</Text>
                  </View>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${completionPct}%` }]} />
                  </View>
                </View>
              )}

              {/* Subtask list */}
              {task.subtasks.map((sub) => (
                <View key={sub.id}>
                  <SubtaskRow
                    subtask={sub}
                    toggling={togglingSubtaskId === sub.id}
                    settingStatus={settingStatusId === sub.id}
                    notesCount={subtaskNotes[sub.id]?.length ?? 0}
                    expanded={expandedSubtaskId === sub.id}
                    onToggle={() => handleToggleSubtask(sub.id)}
                    onSetStatus={() => handleSetSubtaskStatus(sub.id, sub.status)}
                    onToggleNotes={() => handleToggleNotes(sub.id)}
                    onDelete={() => handleDeleteSubtask(sub.id)}
                  />
                  {expandedSubtaskId === sub.id && (
                    <View style={styles.notesPanel}>
                      {notesLoading[sub.id] && (
                        <ActivityIndicator size="small" color="#1a237e" style={{ marginVertical: 8 }} />
                      )}
                      {(subtaskNotes[sub.id] || []).map((n) => (
                        <View key={n.id} style={styles.noteRow}>
                          <View style={styles.noteAvatar}>
                            <Text style={styles.noteAvatarText}>{n.createdBy?.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.noteAuthor}>{n.createdBy?.name}</Text>
                            <Text style={styles.noteText}>{n.note}</Text>
                            {n.hasAttachment && n.attachmentName && (
                              <TouchableOpacity
                                style={styles.attachmentChip}
                                onPress={() => handleOpenAttachment(n.id, n.attachmentName!, n.attachmentType)}
                              >
                                <Text style={styles.attachmentChipText}>📎 {n.attachmentName}</Text>
                              </TouchableOpacity>
                            )}
                            <Text style={styles.noteMeta}>{timeAgo(n.createdAt)}</Text>
                          </View>
                          {n.createdBy?.id === currentUser?.userId && (
                            <TouchableOpacity onPress={() => handleDeleteSubtaskNote(sub.id, n.id)}>
                              <Text style={{ color: '#ba1a1a', fontSize: 12 }}>Delete</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                      {!notesLoading[sub.id] && (subtaskNotes[sub.id] || []).length === 0 && (
                        <Text style={styles.noteEmpty}>No notes yet.</Text>
                      )}
                      {/* Attachment preview */}
                      {noteAttachment[sub.id] && (
                        <View style={styles.attachmentPreview}>
                          <Text style={styles.attachmentPreviewText} numberOfLines={1}>📎 {noteAttachment[sub.id]!.name}</Text>
                          <TouchableOpacity onPress={() => setNoteAttachment((prev) => ({ ...prev, [sub.id]: null }))}>
                            <Text style={{ color: '#ba1a1a', fontSize: 12 }}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      <View style={styles.addRow}>
                        <TextInput
                          style={styles.addInput}
                          value={noteText[sub.id] ?? ''}
                          onChangeText={(t) => setNoteText((prev) => ({ ...prev, [sub.id]: t }))}
                          placeholder="Add a note…"
                          placeholderTextColor="#aaa"
                          multiline
                        />
                        <TouchableOpacity
                          style={[styles.addBtn, { backgroundColor: '#546e7a', minWidth: 44 }]}
                          onPress={() => handlePickAttachment(sub.id)}
                        >
                          <Text style={styles.addBtnText}>📎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.addBtn}
                          onPress={() => handleAddSubtaskNote(sub.id)}
                          disabled={submittingNote === sub.id || !noteText[sub.id]?.trim()}
                        >
                          {submittingNote === sub.id
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={styles.addBtnText}>Add</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}
              {task.subtasks.length === 0 && (
                <Text style={styles.empty}>No subtasks yet.</Text>
              )}

              {/* Add subtask */}
              <View style={{ gap: 6 }}>
                <View style={styles.addRow}>
                  <TextInput
                    style={styles.addInput}
                    value={newSubtask}
                    onChangeText={setNewSubtask}
                    placeholder="New subtask title"
                    placeholderTextColor="#aaa"
                    returnKeyType="done"
                    onSubmitEditing={handleAddSubtask}
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={handleAddSubtask} disabled={addingSubtask || !newSubtask.trim()}>
                    {addingSubtask
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.addBtnText}>Add</Text>}
                  </TouchableOpacity>
                </View>
                {/* Owner picker button */}
                <TouchableOpacity
                  style={styles.ownerPickerBtn}
                  onPress={() => setShowOwnerPicker(true)}
                >
                  <Text style={styles.ownerPickerText}>
                    👤 {newSubtaskOwnerId ? (users.find((u) => u.id === newSubtaskOwnerId)?.name ?? 'Unknown') : 'Assign owner (optional)'}
                  </Text>
                  {newSubtaskOwnerId && (
                    <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); setNewSubtaskOwnerId(null) }}>
                      <Text style={{ color: '#ba1a1a', fontSize: 13, marginLeft: 6 }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* COMMENTS TAB */}
          {activeTab === 'comments' && (
            <View>
              {(task.comments || []).length === 0 && (
                <Text style={styles.empty}>No comments yet.</Text>
              )}
              {(task.comments || []).map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  isOwn={comment.user?.id === currentUser?.userId}
                  onDelete={() => handleDeleteComment(comment.id)}
                />
              ))}

              {/* Add comment */}
              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Write a comment…"
                  placeholderTextColor="#aaa"
                  multiline
                />
                <TouchableOpacity style={styles.addBtn} onPress={handleAddComment} disabled={submittingComment || !commentText.trim()}>
                  {submittingComment
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.addBtnText}>Post</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ACTIVITY TAB */}
          {activeTab === 'activity' && (
            <View>
              {auditsLoading && <ActivityIndicator color="#1a237e" style={{ marginTop: 24 }} />}
              {!auditsLoading && audits && (
                <>
                  {audits.taskAudits.map((a) => (
                    <View key={a.id} style={styles.auditRow}>
                      <View style={styles.auditDot} />
                      <View style={styles.auditBody}>
                        <Text style={styles.auditType}>{AUDIT_CHANGE_LABELS[a.changeType] ?? a.changeType}</Text>
                        {a.oldValue && a.newValue && (
                          <Text style={styles.auditChange}>
                            <Text style={styles.auditOld}>{a.oldValue}</Text>
                            {'  →  '}
                            <Text style={styles.auditNew}>{a.newValue}</Text>
                          </Text>
                        )}
                        <Text style={styles.auditMeta}>{a.changedByName} · {timeAgo(a.changedAt)}</Text>
                      </View>
                    </View>
                  ))}
                  {audits.subtaskAudits.map((a) => (
                    <View key={`s-${a.id}`} style={styles.auditRow}>
                      <View style={[styles.auditDot, { backgroundColor: '#6a1b9a' }]} />
                      <View style={styles.auditBody}>
                        <Text style={styles.auditType}>⬜ Subtask: {a.subtaskTitle}</Text>
                        {a.oldStatus && a.newStatus && (
                          <Text style={styles.auditChange}>
                            <Text style={styles.auditOld}>{a.oldStatus}</Text>
                            {'  →  '}
                            <Text style={styles.auditNew}>{a.newStatus}</Text>
                            {a.backwardMove && <Text style={{ color: '#c62828' }}>  ⚠️ backward</Text>}
                          </Text>
                        )}
                        <Text style={styles.auditMeta}>{a.changedByName} · {timeAgo(a.changedAt)}</Text>
                      </View>
                    </View>
                  ))}
                  {audits.taskAudits.length === 0 && audits.subtaskAudits.length === 0 && (
                    <Text style={styles.empty}>No activity yet.</Text>
                  )}
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  )
}

function SubtaskRow({ subtask, toggling, settingStatus, notesCount, expanded, onToggle, onSetStatus, onToggleNotes, onDelete }: {
  subtask: Subtask
  toggling: boolean
  settingStatus: boolean
  notesCount: number
  expanded: boolean
  onToggle: () => void
  onSetStatus: () => void
  onToggleNotes: () => void
  onDelete: () => void
}) {
  return (
    <View style={[styles.subtaskRow, expanded && styles.subtaskRowExpanded]}>
      {/* Checkbox */}
      <TouchableOpacity onPress={onToggle} disabled={toggling} style={styles.subtaskCheck}>
        {toggling
          ? <ActivityIndicator size="small" color="#1a237e" />
          : <Text style={{ fontSize: 18 }}>{subtask.isComplete ? '✅' : '⬜'}</Text>}
      </TouchableOpacity>

      {/* Title + status chip row */}
      <View style={styles.subtaskBody}>
        <Text style={[styles.subtaskTitle, subtask.isComplete && styles.strikethrough]}>{subtask.title}</Text>
        {subtask.ownerName
          ? <Text style={styles.subtaskOwner}>👤 {subtask.ownerName}</Text>
          : <Text style={[styles.subtaskOwner, { color: '#ba1a1a' }]}>⚠️ No owner</Text>}
        <View style={styles.subtaskActions}>
          {/* Status chip — tap to change */}
          <TouchableOpacity
            onPress={onSetStatus}
            disabled={settingStatus}
            style={[styles.statusChip, { backgroundColor: (SUBTASK_STATUS_COLORS[subtask.status] ?? '#666') + '22' }]}
          >
            {settingStatus
              ? <ActivityIndicator size="small" color={SUBTASK_STATUS_COLORS[subtask.status] ?? '#666'} />
              : <Text style={[styles.statusChipText, { color: SUBTASK_STATUS_COLORS[subtask.status] ?? '#666' }]}>
                  {subtask.status.replace('_', ' ')}
                </Text>}
          </TouchableOpacity>
          {/* Notes toggle */}
          <TouchableOpacity onPress={onToggleNotes} style={styles.notesBtn}>
            <Text style={styles.notesBtnText}>{expanded ? '▲' : '🗒️'} Notes{notesCount > 0 ? ` (${notesCount})` : ''}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Delete */}
      <TouchableOpacity onPress={onDelete} style={styles.subtaskDel}>
        <Text style={{ color: '#ba1a1a', fontSize: 16 }}>✕</Text>
      </TouchableOpacity>
    </View>
  )
}

function CommentCard({ comment, isOwn, onDelete }: { comment: Comment; isOwn: boolean; onDelete: () => void }) {
  return (
    <View style={styles.commentBubbleRow}>
      <View style={styles.commentBubbleAvatar}>
        <Text style={styles.commentBubbleAvatarText}>{comment.user?.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.commentBubble}>
          <View style={styles.commentBubbleHeader}>
            <Text style={styles.commentBubbleAuthor}>{comment.user?.name ?? 'Unknown'}</Text>
            <Text style={styles.commentBubbleTime}>{timeAgo(comment.createdAt)}</Text>
          </View>
          <Text style={styles.commentBubbleContent}>{comment.content}</Text>
        </View>
        {isOwn && (
          <TouchableOpacity onPress={onDelete} style={{ alignSelf: 'flex-end', marginTop: 3, paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 11, color: '#ba1a1a', fontWeight: '600' }}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Hero Header ──
  heroCard: { backgroundColor: '#041627' },
  heroContent: { padding: 16, paddingTop: 14, paddingBottom: 12 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  pillGlass: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  pillGlassText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.80)' },
  heroPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  heroPillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  heroTitle: {
    fontSize: 22, fontWeight: '800', color: '#fff', lineHeight: 30,
    marginBottom: 10, letterSpacing: -0.3,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tagChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  tagChipText: { fontSize: 11, fontWeight: '600' },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  heroMetaItem: { fontSize: 11 },
  heroMetaMuted: { color: 'rgba(255,255,255,0.45)' },
  heroMetaBold: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  heroActionBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  heroActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroActionBtnText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  heroDeleteBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, backgroundColor: 'rgba(186,26,26,0.10)',
    borderColor: 'rgba(186,26,26,0.22)',
  },
  heroDeleteBtnText: { fontSize: 12, fontWeight: '700', color: '#ff8a80' },

  // ── Tabs ──
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e0e3e5',
  },
  tab: {
    flex: 1, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#006a66' },
  tabText: { fontSize: 11, fontWeight: '600', color: '#9aa0a6' },
  tabTextActive: { color: '#006a66' },

  // ── Body ──
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },

  // ── Section cards ──
  section: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 12, elevation: 1,
    shadowColor: '#041627', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1, borderColor: '#e8eaed',
  },
  sectionTitle: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.4,
    color: '#9aa0a6', textTransform: 'uppercase', marginBottom: 12,
  },
  descText: { fontSize: 14, color: '#44474c', lineHeight: 22 },

  // ── Meta ──
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f6f8',
  },
  metaLabel: { fontSize: 13, color: '#9aa0a6', fontWeight: '500' },
  metaValue: { fontSize: 13, color: '#191c1e', fontWeight: '600', maxWidth: '55%', textAlign: 'right' },

  // ── Progress ──
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 12, color: '#44474c', fontWeight: '600' },
  progressBg: { height: 5, backgroundColor: '#e8eaed', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: 5, backgroundColor: '#006a66', borderRadius: 3 },

  // ── Subtasks ──
  subtaskRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#e8eaed',
    shadowColor: '#041627', shadowOpacity: 0.03, shadowRadius: 4, elevation: 0,
  },
  subtaskCheck: { marginRight: 10 },
  subtaskBody: { flex: 1 },
  subtaskTitle: { fontSize: 14, color: '#191c1e', fontWeight: '500', marginBottom: 2 },
  subtaskOwner: { fontSize: 11, color: '#737c7f', marginBottom: 4 },
  ownerPickerBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f0fdfb', borderRadius: 10, borderWidth: 1, borderColor: '#006a66' + '30',
    paddingHorizontal: 10, paddingVertical: 7,
  },
  ownerPickerText: { fontSize: 13, color: '#006a66', flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  ownerModal: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 32, paddingHorizontal: 16, paddingTop: 12,
  },
  ownerModalHandle: {
    width: 40, height: 4, backgroundColor: '#e0e3e5',
    borderRadius: 2, alignSelf: 'center', marginBottom: 14,
  },
  ownerModalTitle: { fontSize: 16, fontWeight: '700', color: '#006a66', marginBottom: 10 },
  ownerModalItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10, marginBottom: 2,
  },
  ownerModalItemSelected: { backgroundColor: '#e6f7f6' },
  ownerModalItemText: { fontSize: 14, color: '#191c1e' },
  ownerModalItemSub: { fontSize: 11, color: '#9aa0a6', marginTop: 1 },
  ownerAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#006a66', justifyContent: 'center', alignItems: 'center',
  },
  ownerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  subtaskRowExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 },
  subtaskActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, minWidth: 40 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  notesBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#e6f7f6' },
  notesBtnText: { fontSize: 11, color: '#006a66', fontWeight: '600' },
  strikethrough: { textDecorationLine: 'line-through', color: '#9aa0a6' },
  subtaskStatus: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  subtaskDel: { padding: 4 },

  // ── Notes panel ──
  notesPanel: {
    backgroundColor: '#fafcfd', borderWidth: 1, borderTopWidth: 0,
    borderColor: '#e8eaed', borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    padding: 12, marginBottom: 8,
  },
  noteRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-start' },
  noteAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#006a66', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  noteAvatarText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  noteAuthor: { fontSize: 12, fontWeight: '700', color: '#191c1e' },
  noteText: { fontSize: 13, color: '#44474c', marginTop: 1 },
  noteMeta: { fontSize: 10, color: '#9aa0a6', marginTop: 2 },
  noteEmpty: { fontSize: 12, color: '#9aa0a6', textAlign: 'center', marginVertical: 8 },
  attachmentChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#e6f7f6',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start', marginTop: 4,
  },
  attachmentChipText: { fontSize: 11, color: '#006a66' },
  attachmentPreview: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#e6f7f6', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6,
  },
  attachmentPreviewText: { fontSize: 12, color: '#006a66', flex: 1, marginRight: 8 },

  // ── Add row ──
  addRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  addInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#191c1e',
    borderWidth: 1, borderColor: '#e0e3e5',
  },
  addBtn: {
    backgroundColor: '#006a66', borderRadius: 12,
    paddingHorizontal: 16, justifyContent: 'center',
    minWidth: 60, alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // ── Comments (bubble style) ──
  commentBubbleRow: { flexDirection: 'row', gap: 10, marginBottom: 14, alignItems: 'flex-start' },
  commentBubbleAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#006a66', justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  commentBubbleAvatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  commentBubble: {
    backgroundColor: '#f8f9fa', borderRadius: 16, borderTopLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#eceef0',
  },
  commentBubbleHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 5, gap: 8,
  },
  commentBubbleAuthor: { fontSize: 12, fontWeight: '700', color: '#191c1e' },
  commentBubbleTime: { fontSize: 10, color: '#9aa0a6' },
  commentBubbleContent: { fontSize: 14, color: '#44474c', lineHeight: 20 },
  commentInputRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-end' },
  commentInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#191c1e',
    borderWidth: 1, borderColor: '#e0e3e5',
    maxHeight: 100,
  },

  // ── Audit ──
  auditRow: { flexDirection: 'row', marginBottom: 14, gap: 12 },
  auditDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#006a66', marginTop: 4, flexShrink: 0,
  },
  auditBody: { flex: 1 },
  auditType: { fontSize: 13, fontWeight: '700', color: '#191c1e', marginBottom: 2 },
  auditChange: { fontSize: 12, color: '#44474c', marginBottom: 2 },
  auditOld: { color: '#ba1a1a', textDecorationLine: 'line-through' },
  auditNew: { color: '#006a66', fontWeight: '600' },
  auditMeta: { fontSize: 11, color: '#9aa0a6' },

  empty: { textAlign: 'center', color: '#9aa0a6', marginTop: 32, fontSize: 14 },
})

