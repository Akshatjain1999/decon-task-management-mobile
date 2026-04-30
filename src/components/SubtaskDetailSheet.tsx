import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_BASE_URL } from '../services/api'
import { taskService } from '../services/taskService'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import type { Subtask, SubtaskNote, SubtaskStatus, User } from '../types'

// Teal palette to match web SubtaskDetailModal
const C = {
  primary: '#006a66',
  primarySoft: '#e6f7f6',
  text: '#191c1e',
  muted: '#737c7f',
  faint: '#9aa0a6',
  border: '#e0e3e5',
  hover: '#f6f7f8',
  danger: '#ba1a1a',
}

const STATUS_META: Record<SubtaskStatus, { label: string; bg: string; fg: string; dot: string }> = {
  TODO:        { label: 'To Do',       bg: '#eef0f2', fg: '#44474c', dot: '#737c7f' },
  IN_PROGRESS: { label: 'In Progress', bg: '#fff3e0', fg: '#a05a00', dot: '#e65100' },
  DONE:        { label: 'Done',        bg: '#e6f7f6', fg: '#006a66', dot: '#006a66' },
}

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

function renderWithMentions(text: string): React.ReactNode {
  // Split on @Word (one capitalised word fragment) — keep simple: highlight @[A-Za-z0-9_]+
  const parts = text.split(/(@[A-Za-z][\w]*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('@')) {
      return (
        <Text key={i} style={{ color: C.primary, fontWeight: '600' }}>{p}</Text>
      )
    }
    return <Text key={i}>{p}</Text>
  })
}

interface Props {
  visible: boolean
  taskId: number
  subtask: Subtask
  users: User[]
  currentUserId: number | undefined
  isAdmin: boolean
  canDelete?: boolean
  onClose: () => void
  onUpdated: (sub: Subtask) => void
  onDeleted: (id: number) => void
  showToast: (msg: string) => void
}

export default function SubtaskDetailSheet({
  visible,
  taskId,
  subtask,
  users,
  currentUserId,
  isAdmin,
  canDelete = false,
  onClose,
  onUpdated,
  onDeleted,
  showToast,
}: Props) {
  const [tab, setTab] = useState<'details' | 'notes'>('details')

  // Editable fields
  const [title, setTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [savingTitle, setSavingTitle] = useState(false)

  const [description, setDescription] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [savingDesc, setSavingDesc] = useState(false)

  const [savingStatus, setSavingStatus] = useState(false)
  const [savingOwner, setSavingOwner] = useState(false)
  const [savingStart, setSavingStart] = useState(false)
  const [savingEnd, setSavingEnd] = useState(false)
  const [savingEstimate, setSavingEstimate] = useState(false)

  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [showOwnerPicker, setShowOwnerPicker] = useState(false)
  const [startInput, setStartInput] = useState('')
  const [editingStart, setEditingStart] = useState(false)
  const [endInput, setEndInput] = useState('')
  const [editingEnd, setEditingEnd] = useState(false)
  const [estimateInput, setEstimateInput] = useState('')
  const [editingEstimate, setEditingEstimate] = useState(false)

  // Notes
  const [notes, setNotes] = useState<SubtaskNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteAttachment, setNoteAttachment] = useState<{ uri: string; name: string; type: string } | null>(null)
  const [submittingNote, setSubmittingNote] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<number | null>(null)
  const [confirmDeleteSubtask, setConfirmDeleteSubtask] = useState(false)

  // Mentions
  const [mentionTrigger, setMentionTrigger] = useState<{ start: number; query: string } | null>(null)
  const [pendingMentionIds, setPendingMentionIds] = useState<number[]>([])
  const noteInputRef = useRef<TextInput>(null)

  // Reset state when subtask changes / sheet opens
  useEffect(() => {
    if (!visible) return
    setTab('details')
    setTitle(subtask.title)
    setDescription(subtask.description ?? '')
    setEditingTitle(false)
    setEditingDesc(false)
    setEditingStart(false)
    setEditingEnd(false)
    setEditingEstimate(false)
    setStartInput(subtask.startDate ?? '')
    setEndInput(subtask.endDate ?? '')
    setEstimateInput(subtask.estimatedMinutes != null ? String(subtask.estimatedMinutes / 60) : '')
    setNoteText('')
    setNoteAttachment(null)
    setPendingMentionIds([])
    setMentionTrigger(null)
    setNotes([])
  }, [visible, subtask.id])

  // Load notes when notes tab opens
  useEffect(() => {
    if (!visible || tab !== 'notes' || notes.length > 0 || notesLoading) return
    let cancel = false
    setNotesLoading(true)
    taskService.getSubtaskNotes(subtask.id)
      .then((n) => { if (!cancel) setNotes(n) })
      .catch((e: any) => { if (!cancel) showToast(e?.message || 'Failed to load notes') })
      .finally(() => { if (!cancel) setNotesLoading(false) })
    return () => { cancel = true }
  }, [visible, subtask.id, tab])

  // ── Save helpers ──────────────────────────────────────────────────────
  const persist = async (
    patch: { title?: string; ownerId?: number | null; startDate?: string | null; endDate?: string | null; estimatedMinutes?: number | null; description?: string | null | undefined },
    setLoading: (v: boolean) => void,
  ) => {
    setLoading(true)
    try {
      const updated = await taskService.updateSubtask(
        taskId,
        subtask.id,
        patch.title ?? subtask.title,
        patch.ownerId !== undefined ? patch.ownerId : subtask.ownerId ?? null,
        patch.startDate !== undefined ? patch.startDate : subtask.startDate ?? null,
        patch.endDate !== undefined ? patch.endDate : subtask.endDate ?? null,
        patch.estimatedMinutes !== undefined ? patch.estimatedMinutes : subtask.estimatedMinutes ?? null,
        patch.description,
      )
      onUpdated(updated)
    } catch (e: any) {
      showToast(e?.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const saveTitle = async () => {
    const t = title.trim()
    if (!t || t === subtask.title) { setEditingTitle(false); return }
    await persist({ title: t }, setSavingTitle)
    setEditingTitle(false)
  }

  const saveDescription = async () => {
    const d = description.trim()
    await persist({ description: d || null }, setSavingDesc)
    setEditingDesc(false)
  }

  const setStatus = async (status: SubtaskStatus) => {
    setShowStatusPicker(false)
    if (status === subtask.status) return
    setSavingStatus(true)
    try {
      const updated = await taskService.setSubtaskStatus(taskId, subtask.id, status)
      onUpdated({ ...subtask, status: updated.status, isComplete: updated.isComplete })
    } catch (e: any) {
      showToast(e?.message || 'Failed to update status')
    } finally {
      setSavingStatus(false)
    }
  }

  const setOwner = async (userId: number | null) => {
    setShowOwnerPicker(false)
    await persist({ ownerId: userId }, setSavingOwner)
  }

  const saveStart = async () => {
    const v = startInput.trim()
    await persist({ startDate: v || null }, setSavingStart)
    setEditingStart(false)
  }

  const saveEnd = async () => {
    const v = endInput.trim()
    await persist({ endDate: v || null }, setSavingEnd)
    setEditingEnd(false)
  }

  const saveEstimate = async () => {
    const v = estimateInput.trim()
    if (!v) {
      await persist({ estimatedMinutes: null }, setSavingEstimate)
    } else {
      const num = parseFloat(v)
      if (isNaN(num) || num < 0) {
        showToast('Estimate must be a positive number of hours')
        return
      }
      await persist({ estimatedMinutes: Math.round(num * 60) }, setSavingEstimate)
    }
    setEditingEstimate(false)
  }

  const handleDelete = async () => {
    setConfirmDeleteSubtask(false)
    try {
      await taskService.deleteSubtask(taskId, subtask.id)
      onDeleted(subtask.id)
      onClose()
    } catch (e: any) {
      showToast(e?.message || 'Failed to delete subtask')
    }
  }

  // ── Notes ─────────────────────────────────────────────────────────────
  const handleNoteChange = (text: string) => {
    setNoteText(text)
    // Trigger detection: caret = end of text typically; look back for last unbroken @
    const upto = text
    const at = upto.lastIndexOf('@')
    if (at >= 0) {
      const after = upto.slice(at + 1)
      // Trigger active only if no whitespace yet and looks like a partial mention
      if (!/\s/.test(after) && after.length <= 40) {
        setMentionTrigger({ start: at, query: after.toLowerCase() })
        return
      }
    }
    setMentionTrigger(null)
  }

  const mentionMatches = useMemo(() => {
    if (!mentionTrigger) return []
    const list = users ?? []
    const q = mentionTrigger.query
    if (!q) return list.slice(0, 6)
    return list.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 6)
  }, [mentionTrigger, users])

  const pickMention = (user: User) => {
    if (!mentionTrigger) return
    const before = noteText.slice(0, mentionTrigger.start)
    const after = noteText.slice(mentionTrigger.start + 1 + mentionTrigger.query.length)
    const label = user.name.replace(/\s+/g, '')
    const next = `${before}@${label} ${after}`
    setNoteText(next)
    setMentionTrigger(null)
    setPendingMentionIds((prev) => prev.includes(user.id) ? prev : [...prev, user.id])
    setTimeout(() => noteInputRef.current?.focus(), 0)
  }

  const handlePickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false })
      if (!result.canceled && result.assets?.length) {
        const a = result.assets[0]
        setNoteAttachment({ uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream' })
      }
    } catch (e: any) {
      showToast(e?.message || 'Could not pick file')
    }
  }

  const handleAddNote = async () => {
    const text = noteText.trim()
    if (!text) return
    setSubmittingNote(true)
    try {
      // Filter mention IDs to those still appearing in the final text (best-effort)
      const stillMentioned = pendingMentionIds.filter((id) => {
        const u = (users ?? []).find((x) => x.id === id)
        if (!u) return false
        const tag = '@' + u.name.replace(/\s+/g, '')
        return text.includes(tag)
      })
      const note = await taskService.addSubtaskNote(subtask.id, text, noteAttachment, stillMentioned)
      setNotes((prev) => [...prev, note])
      setNoteText('')
      setNoteAttachment(null)
      setPendingMentionIds([])
      setMentionTrigger(null)
    } catch (e: any) {
      showToast(e?.message || 'Failed to add note')
    } finally {
      setSubmittingNote(false)
    }
  }

  const handleDeleteNote = async (noteId: number) => {
    setConfirmDeleteNoteId(null)
    try {
      await taskService.deleteSubtaskNote(noteId)
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch (e: any) {
      showToast(e?.message || 'Failed to delete note')
    }
  }

  const handleOpenAttachment = useCallback(async (noteId: number, fileName: string, mimeType?: string | null) => {
    try {
      const token = await AsyncStorage.getItem('auth_token')
      const url = `${API_BASE_URL}/api/v1/subtasks/notes/${noteId}/attachment`
      const localUri = (FileSystem.cacheDirectory ?? '') + fileName
      const { uri } = await FileSystem.downloadAsync(url, localUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const isImage = mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(fileName)
      if (isImage) setPreviewImage(uri)
      else if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mimeType ?? undefined })
      else showToast('Sharing not available')
    } catch (e: any) {
      showToast(e?.message || 'Could not open attachment')
    }
  }, [showToast])

  const statusMeta = STATUS_META[subtask.status] ?? STATUS_META.TODO
  const ownerLabel = subtask.ownerName || 'Unassigned'
  const userList = users ?? []

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              {editingTitle && isAdmin ? (
                <TextInput
                  style={styles.titleInput}
                  value={title}
                  onChangeText={setTitle}
                  autoFocus
                  onBlur={saveTitle}
                  returnKeyType="done"
                  onSubmitEditing={saveTitle}
                />
              ) : (
                <TouchableOpacity onPress={() => isAdmin && setEditingTitle(true)} disabled={!isAdmin}>
                  <Text style={styles.title} numberOfLines={3}>{subtask.title}</Text>
                  {isAdmin && <Text style={styles.editHint}>Tap to edit</Text>}
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {(['details', 'notes'] as const).map((t) => (
              <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'details' ? 'Details' : `Notes${notes.length ? ` (${notes.length})` : ''}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Body */}
          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            {tab === 'details' && (
              <View style={{ gap: 14 }}>
                {/* Status */}
                <View>
                  <Text style={styles.label}>Status</Text>
                  <TouchableOpacity
                    style={styles.fieldRow}
                    onPress={() => isAdmin && setShowStatusPicker(true)}
                    disabled={!isAdmin || savingStatus}
                  >
                    <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusMeta.dot }]} />
                      <Text style={[styles.statusPillText, { color: statusMeta.fg }]}>{statusMeta.label}</Text>
                    </View>
                    {savingStatus
                      ? <ActivityIndicator size="small" color={C.primary} />
                      : isAdmin && <Text style={styles.chevron}>›</Text>}
                  </TouchableOpacity>
                </View>

                {/* Owner */}
                <View>
                  <Text style={styles.label}>Owner</Text>
                  <TouchableOpacity
                    style={styles.fieldRow}
                    onPress={() => isAdmin && setShowOwnerPicker(true)}
                    disabled={!isAdmin || savingOwner}
                  >
                    <View style={styles.ownerInline}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{(subtask.ownerName ?? '?').charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.fieldValue, !subtask.ownerName && { color: C.faint }]}>{ownerLabel}</Text>
                    </View>
                    {savingOwner
                      ? <ActivityIndicator size="small" color={C.primary} />
                      : isAdmin && <Text style={styles.chevron}>›</Text>}
                  </TouchableOpacity>
                </View>

                {/* Start date */}
                <View>
                  <Text style={styles.label}>Start date</Text>
                  <TouchableOpacity
                    style={styles.fieldRow}
                    onPress={() => isAdmin && setEditingStart(true)}
                    disabled={!isAdmin || savingStart}
                  >
                    <Text style={[styles.fieldValue, !subtask.startDate && { color: C.faint }]}>
                      {subtask.startDate ? formatDate(subtask.startDate) : 'Not set'}
                    </Text>
                    {savingStart
                      ? <ActivityIndicator size="small" color={C.primary} />
                      : isAdmin && <Text style={styles.chevron}>›</Text>}
                  </TouchableOpacity>
                  {editingStart && isAdmin && Platform.OS === 'android' && (
                    <DateTimePicker
                      value={startInput ? new Date(startInput) : new Date()}
                      mode="date"
                      display="calendar"
                      onChange={(event: DateTimePickerEvent, selected?: Date) => {
                        setEditingStart(false)
                        if (event.type === 'set' && selected) {
                          const ymd = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`
                          setStartInput(ymd)
                          persist({ startDate: ymd }, setSavingStart)
                        }
                      }}
                    />
                  )}
                  {editingStart && isAdmin && Platform.OS === 'ios' && (
                    <Modal visible transparent animationType="slide" onRequestClose={() => setEditingStart(false)}>
                      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={() => setEditingStart(false)} />
                      <View style={{ backgroundColor: '#fff', paddingBottom: 30, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: C.border }}>
                          <TouchableOpacity onPress={() => setEditingStart(false)}>
                            <Text style={{ color: C.muted, fontSize: 16 }}>Cancel</Text>
                          </TouchableOpacity>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: C.text }}>Start Date</Text>
                          <TouchableOpacity onPress={() => { setEditingStart(false); persist({ startDate: startInput || null }, setSavingStart) }}>
                            <Text style={{ color: C.primary, fontSize: 16, fontWeight: '600' }}>Done</Text>
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={startInput ? new Date(startInput) : new Date()}
                          mode="date"
                          display="inline"
                          onChange={(_e: DateTimePickerEvent, selected?: Date) => {
                            if (selected) {
                              const ymd = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`
                              setStartInput(ymd)
                            }
                          }}
                          style={{ alignSelf: 'center' }}
                        />
                        {startInput ? (
                          <TouchableOpacity
                            style={{ alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20 }}
                            onPress={() => { setStartInput(''); setEditingStart(false); persist({ startDate: null }, setSavingStart) }}
                          >
                            <Text style={{ color: C.danger, fontSize: 14, fontWeight: '600' }}>Clear start date</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </Modal>
                  )}
                </View>

                {/* End date */}
                <View>
                  <Text style={styles.label}>End date</Text>
                  <TouchableOpacity
                    style={styles.fieldRow}
                    onPress={() => isAdmin && setEditingEnd(true)}
                    disabled={!isAdmin || savingEnd}
                  >
                    <Text style={[styles.fieldValue, !subtask.endDate && { color: C.faint }]}>
                      {subtask.endDate ? formatDate(subtask.endDate) : 'Not set'}
                    </Text>
                    {savingEnd
                      ? <ActivityIndicator size="small" color={C.primary} />
                      : isAdmin && <Text style={styles.chevron}>›</Text>}
                  </TouchableOpacity>
                  {editingEnd && isAdmin && Platform.OS === 'android' && (
                    <DateTimePicker
                      value={endInput ? new Date(endInput) : new Date()}
                      mode="date"
                      display="calendar"
                      onChange={(event: DateTimePickerEvent, selected?: Date) => {
                        setEditingEnd(false)
                        if (event.type === 'set' && selected) {
                          const ymd = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`
                          setEndInput(ymd)
                          persist({ endDate: ymd }, setSavingEnd)
                        }
                      }}
                    />
                  )}
                  {editingEnd && isAdmin && Platform.OS === 'ios' && (
                    <Modal visible transparent animationType="slide" onRequestClose={() => setEditingEnd(false)}>
                      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={() => setEditingEnd(false)} />
                      <View style={{ backgroundColor: '#fff', paddingBottom: 30, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: C.border }}>
                          <TouchableOpacity onPress={() => setEditingEnd(false)}>
                            <Text style={{ color: C.muted, fontSize: 16 }}>Cancel</Text>
                          </TouchableOpacity>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: C.text }}>End Date</Text>
                          <TouchableOpacity onPress={() => { setEditingEnd(false); persist({ endDate: endInput || null }, setSavingEnd) }}>
                            <Text style={{ color: C.primary, fontSize: 16, fontWeight: '600' }}>Done</Text>
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={endInput ? new Date(endInput) : new Date()}
                          mode="date"
                          display="inline"
                          onChange={(_e: DateTimePickerEvent, selected?: Date) => {
                            if (selected) {
                              const ymd = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`
                              setEndInput(ymd)
                            }
                          }}
                          style={{ alignSelf: 'center' }}
                        />
                        {endInput ? (
                          <TouchableOpacity
                            style={{ alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20 }}
                            onPress={() => { setEndInput(''); setEditingEnd(false); persist({ endDate: null }, setSavingEnd) }}
                          >
                            <Text style={{ color: C.danger, fontSize: 14, fontWeight: '600' }}>Clear end date</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </Modal>
                  )}
                </View>

                {/* Estimate */}
                <View>
                  <Text style={styles.label}>Estimate (hours)</Text>
                  {editingEstimate && isAdmin ? (
                    <View style={styles.fieldRow}>
                      <TextInput
                        style={styles.inlineInput}
                        value={estimateInput}
                        onChangeText={setEstimateInput}
                        placeholder="e.g. 2.5"
                        placeholderTextColor={C.faint}
                        keyboardType="decimal-pad"
                        autoFocus
                      />
                      <TouchableOpacity style={styles.inlineSaveBtn} onPress={saveEstimate} disabled={savingEstimate}>
                        {savingEstimate ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.inlineSaveText}>Save</Text>}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.fieldRow}
                      onPress={() => isAdmin && setEditingEstimate(true)}
                      disabled={!isAdmin}
                    >
                      <Text style={[styles.fieldValue, subtask.estimatedMinutes == null && { color: C.faint }]}>
                        {subtask.estimatedMinutes != null ? `${(subtask.estimatedMinutes / 60).toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}h` : 'Not set'}
                      </Text>
                      {isAdmin && <Text style={styles.chevron}>›</Text>}
                    </TouchableOpacity>
                  )}
                </View>

                {/* Description */}
                <View>
                  <View style={styles.descHeader}>
                    <Text style={styles.label}>Description</Text>
                    {isAdmin && !editingDesc && (
                      <TouchableOpacity onPress={() => setEditingDesc(true)}>
                        <Text style={styles.editLink}>{subtask.description ? 'Edit' : 'Add'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {editingDesc ? (
                    <View style={{ gap: 8 }}>
                      <TextInput
                        style={styles.descInput}
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Add details, links, references..."
                        placeholderTextColor={C.faint}
                        multiline
                        autoFocus
                      />
                      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                        <TouchableOpacity
                          style={styles.cancelBtn}
                          onPress={() => { setDescription(subtask.description ?? ''); setEditingDesc(false) }}
                        >
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.primaryBtn} onPress={saveDescription} disabled={savingDesc}>
                          {savingDesc ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Save</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : subtask.description ? (
                    <Text style={styles.descBody}>{subtask.description}</Text>
                  ) : (
                    <Text style={styles.descPlaceholder}>No description yet.</Text>
                  )}
                </View>

                {/* Delete */}
                {canDelete && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => setConfirmDeleteSubtask(true)}>
                    <Text style={styles.deleteBtnText}>Delete subtask</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {tab === 'notes' && (
              <View style={{ gap: 12 }}>
                {notesLoading && (
                  <ActivityIndicator size="small" color={C.primary} style={{ marginVertical: 8 }} />
                )}

                {!notesLoading && notes.length === 0 && (
                  <Text style={styles.emptyNotes}>No notes yet. Be the first.</Text>
                )}

                {notes.map((n) => (
                  <View key={n.id} style={styles.noteRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(n.createdBy?.name ?? '?').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.noteHeader}>
                        <Text style={styles.noteAuthor}>{n.createdBy?.name}</Text>
                        <Text style={styles.noteTime}>{timeAgo(n.createdAt)}</Text>
                      </View>
                      <Text style={styles.noteBody}>{renderWithMentions(n.note)}</Text>
                      {n.hasAttachment && n.attachmentName && (
                        <TouchableOpacity
                          style={styles.attachmentChip}
                          onPress={() => handleOpenAttachment(n.id, n.attachmentName!, n.attachmentType)}
                        >
                          <Text style={styles.attachmentChipText}>📎 {n.attachmentName}</Text>
                        </TouchableOpacity>
                      )}
                      {n.createdBy?.id === currentUserId && (
                        <TouchableOpacity onPress={() => setConfirmDeleteNoteId(n.id)}>
                          <Text style={styles.noteDeleteLink}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Notes composer (sticky bottom when on notes tab) */}
          {tab === 'notes' && (
            <View style={styles.composer}>
              {/* Mention picker */}
              {mentionTrigger && mentionMatches.length > 0 && (
                <View style={styles.mentionList}>
                  {mentionMatches.map((u) => (
                    <TouchableOpacity key={u.id} style={styles.mentionItem} onPress={() => pickMention(u)}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{u.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mentionName}>{u.name}</Text>
                        <Text style={styles.mentionRole}>{u.role}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {noteAttachment && (
                <View style={styles.attachmentPreview}>
                  <Text style={styles.attachmentPreviewText} numberOfLines={1}>📎 {noteAttachment.name}</Text>
                  <TouchableOpacity onPress={() => setNoteAttachment(null)}>
                    <Text style={{ color: C.danger, fontSize: 13, fontWeight: '600' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.composerRow}>
                <TextInput
                  ref={noteInputRef}
                  style={styles.composerInput}
                  value={noteText}
                  onChangeText={handleNoteChange}
                  placeholder="Add a note… use @ to mention"
                  placeholderTextColor={C.faint}
                  multiline
                />
                <TouchableOpacity style={styles.attachBtn} onPress={handlePickAttachment}>
                  <Text style={{ fontSize: 18 }}>📎</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sendBtn, (!noteText.trim() || submittingNote) && { opacity: 0.5 }]}
                  onPress={handleAddNote}
                  disabled={!noteText.trim() || submittingNote}
                >
                  {submittingNote
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.sendBtnText}>Send</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Status picker */}
        <Modal visible={showStatusPicker} transparent animationType="fade" onRequestClose={() => setShowStatusPicker(false)}>
          <TouchableOpacity style={styles.popBackdrop} activeOpacity={1} onPress={() => setShowStatusPicker(false)} />
          <View style={styles.popSheet}>
            <View style={styles.handle} />
            <Text style={styles.popTitle}>Set Status</Text>
            {(['TODO', 'IN_PROGRESS', 'DONE'] as SubtaskStatus[]).map((s) => {
              const m = STATUS_META[s]
              const active = subtask.status === s
              return (
                <TouchableOpacity key={s} style={[styles.popItem, active && { backgroundColor: m.bg }]} onPress={() => setStatus(s)}>
                  <View style={[styles.statusDot, { backgroundColor: m.dot }]} />
                  <Text style={[styles.popItemText, active && { color: m.fg, fontWeight: '700' }]}>{m.label}</Text>
                  {active && <Text style={[styles.popCheck, { color: m.fg }]}>✓</Text>}
                </TouchableOpacity>
              )
            })}
          </View>
        </Modal>

        {/* Owner picker */}
        <Modal visible={showOwnerPicker} transparent animationType="fade" onRequestClose={() => setShowOwnerPicker(false)}>
          <TouchableOpacity style={styles.popBackdrop} activeOpacity={1} onPress={() => setShowOwnerPicker(false)} />
          <View style={styles.popSheet}>
            <View style={styles.handle} />
            <Text style={styles.popTitle}>Assign Owner</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              <TouchableOpacity style={[styles.popItem, !subtask.ownerId && styles.popItemActive]} onPress={() => setOwner(null)}>
                <Text style={[styles.popItemText, !subtask.ownerId && { color: C.primary, fontWeight: '700' }]}>Unassigned</Text>
                {!subtask.ownerId && <Text style={[styles.popCheck, { color: C.primary }]}>✓</Text>}
              </TouchableOpacity>
              {userList.map((u) => {
                const active = subtask.ownerId === u.id
                return (
                  <TouchableOpacity key={u.id} style={[styles.popItem, active && styles.popItemActive]} onPress={() => setOwner(u.id)}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{u.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.popItemText, active && { color: C.primary, fontWeight: '700' }]}>{u.name}</Text>
                      <Text style={styles.popItemSub}>{u.role}</Text>
                    </View>
                    {active && <Text style={[styles.popCheck, { color: C.primary }]}>✓</Text>}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </Modal>

        {/* Image preview */}
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

        {/* Confirm delete note */}
        <Modal visible={confirmDeleteNoteId !== null} transparent animationType="fade" onRequestClose={() => setConfirmDeleteNoteId(null)}>
          <View style={styles.confirmBackdrop}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Delete note?</Text>
              <Text style={styles.confirmBody}>This cannot be undone.</Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmDeleteNoteId(null)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: C.danger }]} onPress={() => handleDeleteNote(confirmDeleteNoteId!)}>
                  <Text style={styles.primaryBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Confirm delete subtask */}
        <Modal visible={confirmDeleteSubtask} transparent animationType="fade" onRequestClose={() => setConfirmDeleteSubtask(false)}>
          <View style={styles.confirmBackdrop}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Delete subtask?</Text>
              <Text style={styles.confirmBody}>"{subtask.title}" will be permanently removed.</Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmDeleteSubtask(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: C.danger }]} onPress={handleDelete}>
                  <Text style={styles.primaryBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    minHeight: '60%',
    paddingTop: 8,
  },
  handle: { width: 40, height: 4, borderRadius: 4, backgroundColor: C.border, alignSelf: 'center', marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', color: C.text, lineHeight: 24 },
  titleInput: {
    fontSize: 18, fontWeight: '700', color: C.text,
    borderBottomWidth: 2, borderBottomColor: C.primary, paddingVertical: 4,
  },
  editHint: { fontSize: 11, color: C.faint, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.hover, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 16, color: C.text },

  tabsRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 18 },
  tab: { paddingVertical: 10, marginRight: 24 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.primary, marginBottom: -1 },
  tabText: { fontSize: 14, color: C.muted, fontWeight: '500' },
  tabTextActive: { color: C.primary, fontWeight: '700' },

  body: { paddingHorizontal: 18, paddingTop: 14 },

  label: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.hover, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, gap: 8,
  },
  fieldValue: { fontSize: 14, color: C.text, fontWeight: '500' },
  chevron: { fontSize: 20, color: C.faint, marginTop: -2 },
  ownerInline: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  inlineInput: { flex: 1, fontSize: 14, color: C.text, paddingVertical: 0 },
  inlineSaveBtn: { backgroundColor: C.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  inlineSaveText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, gap: 6 },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.primarySoft, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: C.primary, fontWeight: '700', fontSize: 12 },

  descHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  editLink: { fontSize: 12, color: C.primary, fontWeight: '700' },
  descInput: {
    backgroundColor: C.hover, borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, minHeight: 100, textAlignVertical: 'top',
  },
  descBody: { fontSize: 14, color: C.text, lineHeight: 20 },
  descPlaceholder: { fontSize: 13, color: C.faint, fontStyle: 'italic' },

  primaryBtn: { backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  cancelBtnText: { color: C.muted, fontSize: 13, fontWeight: '600' },

  deleteBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#f7d4d2', alignItems: 'center' },
  deleteBtnText: { color: C.danger, fontSize: 13, fontWeight: '700' },

  emptyNotes: { textAlign: 'center', color: C.faint, fontSize: 13, paddingVertical: 24 },
  noteRow: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  noteAuthor: { fontSize: 13, fontWeight: '700', color: C.text },
  noteTime: { fontSize: 11, color: C.faint },
  noteBody: { fontSize: 14, color: C.text, lineHeight: 20 },
  noteDeleteLink: { color: C.danger, fontSize: 11, fontWeight: '600', marginTop: 4 },
  attachmentChip: {
    flexDirection: 'row', alignSelf: 'flex-start', marginTop: 6,
    backgroundColor: C.hover, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
  },
  attachmentChipText: { fontSize: 12, color: C.text },

  composer: { borderTopWidth: 1, borderTopColor: C.border, padding: 10, paddingBottom: Platform.OS === 'ios' ? 22 : 10, backgroundColor: '#fff' },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  composerInput: {
    flex: 1, backgroundColor: C.hover, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: C.text, maxHeight: 120,
  },
  attachBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.hover, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  sendBtn: { backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, justifyContent: 'center', alignItems: 'center', minWidth: 60 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  attachmentPreview: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.hover, borderWidth: 1, borderColor: C.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6, gap: 8,
  },
  attachmentPreviewText: { flex: 1, fontSize: 12, color: C.text },

  mentionList: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 10,
    marginBottom: 6, maxHeight: 220, overflow: 'hidden',
  },
  mentionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8 },
  mentionName: { fontSize: 13, fontWeight: '600', color: C.text },
  mentionRole: { fontSize: 11, color: C.muted },

  popBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  popSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28,
  },
  popTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginVertical: 8 },
  popItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  popItemActive: { backgroundColor: C.primarySoft },
  popItemText: { fontSize: 14, color: C.text, fontWeight: '500', flex: 1 },
  popItemSub: { fontSize: 11, color: C.muted },
  popCheck: { fontSize: 14, fontWeight: '700' },

  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  confirmCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20 },
  confirmTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4 },
  confirmBody: { fontSize: 13, color: C.muted, marginBottom: 18 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
})
