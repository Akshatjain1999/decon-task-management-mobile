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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import { taskService } from '../services/taskService'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { updateTask, fetchTasks } from '../store/taskSlice'
import type { Task, TaskStatus, Comment, TaskAuditsResponse, Subtask } from '../types'

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDetail'>
type Tab = 'details' | 'subtasks' | 'comments' | 'activity'

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<TaskStatus, string> = {
  OPEN: '#1565C0',
  IN_PROGRESS: '#E65100',
  COMPLETED: '#2E7D32',
  OVERDUE: '#ba1a1a',
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
  const [togglingSubtaskId, setTogglingSubtaskId] = useState<number | null>(null)

  // Audits
  const [audits, setAudits] = useState<TaskAuditsResponse | null>(null)
  const [auditsLoading, setAuditsLoading] = useState(false)

  // Status change
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const loadTask = useCallback(async () => {
    try {
      const data = await taskService.getById(taskId)
      setTask(data)
    } catch {
      Alert.alert('Error', 'Failed to load task')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => { loadTask() }, [loadTask])

  const loadAudits = useCallback(async () => {
    if (audits || auditsLoading) return
    setAuditsLoading(true)
    try {
      const data = await taskService.getAudits(taskId)
      setAudits(data)
    } catch {
      Alert.alert('Error', 'Failed to load activity')
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
    } catch {
      Alert.alert('Error', 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const showStatusPicker = () => {
    const options: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'COMPLETED']
    Alert.alert(
      'Change Status',
      `Current: ${task?.status?.replace('_', ' ')}`,
      [
        ...options.map((s) => ({
          text: s.replace('_', ' '),
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
            } catch {
              Alert.alert('Error', 'Failed to delete task')
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
    } catch {
      Alert.alert('Error', 'Failed to post comment')
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
          } catch {
            Alert.alert('Error', 'Failed to delete comment')
          }
        },
      },
    ])
  }

  // ─── Subtasks ──────────────────────────────────────────────────────────
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
    } catch {
      Alert.alert('Error', 'Failed to toggle subtask')
    } finally {
      setTogglingSubtaskId(null)
    }
  }

  const handleAddSubtask = async () => {
    if (!task || !newSubtask.trim()) return
    setAddingSubtask(true)
    try {
      const subtask = await taskService.createSubtask(task.id, newSubtask.trim())
      setTask((prev) => prev ? { ...prev, subtasks: [...prev.subtasks, subtask], subtasksTotal: prev.subtasksTotal + 1 } : prev)
      setNewSubtask('')
    } catch {
      Alert.alert('Error', 'Failed to add subtask')
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
          } catch {
            Alert.alert('Error', 'Failed to delete subtask')
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
  const completionPct = task.subtasksTotal > 0 ? Math.round((task.subtasksCompleted / task.subtasksTotal) * 100) : 0

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* ── Header card ─────────────────────────────────────────────── */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerBadges}>
              <View style={[styles.badge, { backgroundColor: STATUS_COLORS[task.status] }]}>
                <Text style={styles.badgeWhite}>{task.status.replace('_', ' ')}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: pColor.bg }]}>
                <Text style={[styles.badgeText, { color: pColor.text }]}>{task.priority}</Text>
              </View>
              {task.taskType && (
                <View style={[styles.badge, { backgroundColor: '#e8eaf6' }]}>
                  <Text style={[styles.badgeText, { color: '#1a237e' }]}>{TASK_TYPE_LABELS[task.taskType] ?? task.taskType}</Text>
                </View>
              )}
            </View>
            {/* Actions */}
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.actionIcon} onPress={showStatusPicker} disabled={updatingStatus}>
                {updatingStatus
                  ? <ActivityIndicator size="small" color="#1a237e" />
                  : <Text style={styles.actionIconText}>⚡</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionIcon, { backgroundColor: '#ffebee' }]} onPress={handleDelete}>
                <Text style={styles.actionIconText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.title}>{task.title}</Text>
          {task.tags?.length > 0 && (
            <View style={styles.tagRow}>
              {task.tags.map((tag) => (
                <View key={tag.id} style={[styles.tag, { backgroundColor: tag.color + '33' }]}>
                  <Text style={[styles.tagText, { color: tag.color }]}>{tag.name}</Text>
                </View>
              ))}
            </View>
          )}
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
                <SubtaskRow
                  key={sub.id}
                  subtask={sub}
                  toggling={togglingSubtaskId === sub.id}
                  onToggle={() => handleToggleSubtask(sub.id)}
                  onDelete={() => handleDeleteSubtask(sub.id)}
                />
              ))}
              {task.subtasks.length === 0 && (
                <Text style={styles.empty}>No subtasks yet.</Text>
              )}

              {/* Add subtask */}
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

function SubtaskRow({ subtask, toggling, onToggle, onDelete }: {
  subtask: Subtask
  toggling: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <View style={styles.subtaskRow}>
      <TouchableOpacity onPress={onToggle} disabled={toggling} style={styles.subtaskCheck}>
        {toggling
          ? <ActivityIndicator size="small" color="#1a237e" />
          : <Text style={{ fontSize: 18 }}>{subtask.isComplete ? '✅' : '⬜'}</Text>}
      </TouchableOpacity>
      <View style={styles.subtaskBody}>
        <Text style={[styles.subtaskTitle, subtask.isComplete && styles.strikethrough]}>{subtask.title}</Text>
        <Text style={[styles.subtaskStatus, { color: SUBTASK_STATUS_COLORS[subtask.status] ?? '#666' }]}>
          {subtask.status.replace('_', ' ')}
        </Text>
      </View>
      <TouchableOpacity onPress={onDelete} style={styles.subtaskDel}>
        <Text style={{ color: '#ba1a1a', fontSize: 16 }}>✕</Text>
      </TouchableOpacity>
    </View>
  )
}

function CommentCard({ comment, isOwn, onDelete }: { comment: Comment; isOwn: boolean; onDelete: () => void }) {
  return (
    <View style={styles.commentCard}>
      <View style={styles.commentHeader}>
        <View style={styles.commentAvatar}>
          <Text style={styles.commentAvatarText}>{comment.user?.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.commentAuthor}>{comment.user?.name ?? 'Unknown'}</Text>
          <Text style={styles.commentTime}>{timeAgo(comment.createdAt)}</Text>
        </View>
        {isOwn && (
          <TouchableOpacity onPress={onDelete}>
            <Text style={{ color: '#ba1a1a', fontSize: 13 }}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.commentContent}>{comment.content}</Text>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  headerCard: {
    backgroundColor: '#1a237e',
    padding: 16,
    paddingTop: 12,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  headerBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  headerActions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  actionIcon: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  actionIconText: { fontSize: 16 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeWhite: { color: '#fff', fontSize: 11, fontWeight: '700' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 18, fontWeight: '700', color: '#fff', lineHeight: 24, marginBottom: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 11, fontWeight: '600' },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#1a237e' },
  tabText: { fontSize: 11, fontWeight: '600', color: '#888' },
  tabTextActive: { color: '#1a237e' },

  // Body
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },

  // Section
  section: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, elevation: 1,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1a237e', marginBottom: 10 },
  descText: { fontSize: 14, color: '#444', lineHeight: 22 },

  // Meta
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  metaLabel: { fontSize: 13, color: '#888', fontWeight: '500' },
  metaValue: { fontSize: 13, color: '#222', fontWeight: '600', maxWidth: '55%', textAlign: 'right' },

  // Progress
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 12, color: '#666', fontWeight: '600' },
  progressBg: { height: 6, backgroundColor: '#eee', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: 6, backgroundColor: '#2e7d32', borderRadius: 3 },

  // Subtasks
  subtaskRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    marginBottom: 8, elevation: 1,
  },
  subtaskCheck: { marginRight: 10 },
  subtaskBody: { flex: 1 },
  subtaskTitle: { fontSize: 14, color: '#222', fontWeight: '500' },
  strikethrough: { textDecorationLine: 'line-through', color: '#aaa' },
  subtaskStatus: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  subtaskDel: { padding: 4 },

  // Add row
  addRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  addInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#222',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  addBtn: {
    backgroundColor: '#1a237e', borderRadius: 10,
    paddingHorizontal: 16, justifyContent: 'center',
    minWidth: 60, alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Comments
  commentCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 10, elevation: 1,
  },
  commentHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
  commentAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1a237e', justifyContent: 'center', alignItems: 'center',
  },
  commentAvatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: '#222' },
  commentTime: { fontSize: 11, color: '#888', marginTop: 1 },
  commentContent: { fontSize: 14, color: '#333', lineHeight: 20 },
  commentInputRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-end' },
  commentInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#222',
    borderWidth: 1, borderColor: '#e0e0e0',
    maxHeight: 100,
  },

  // Audit
  auditRow: { flexDirection: 'row', marginBottom: 14, gap: 12 },
  auditDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#1a237e', marginTop: 4, flexShrink: 0,
  },
  auditBody: { flex: 1 },
  auditType: { fontSize: 13, fontWeight: '700', color: '#222', marginBottom: 2 },
  auditChange: { fontSize: 12, color: '#555', marginBottom: 2 },
  auditOld: { color: '#ba1a1a', textDecorationLine: 'line-through' },
  auditNew: { color: '#2e7d32', fontWeight: '600' },
  auditMeta: { fontSize: 11, color: '#999' },

  empty: { textAlign: 'center', color: '#aaa', marginTop: 32, fontSize: 14 },
})


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
