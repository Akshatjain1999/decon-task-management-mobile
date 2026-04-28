import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import { useAppDispatch } from '../store/hooks'
import { createTask } from '../store/taskSlice'
import { userService } from '../services/userService'
import type { TaskPriority, TaskType, CreateTaskRequest, User } from '../types'

type Nav = NativeStackNavigationProp<RootStackParamList>

const PRIORITIES: { value: TaskPriority; label: string; bg: string; text: string }[] = [
  { value: 'LOW',      label: 'Low',      bg: '#e0e3e5', text: '#44474c' },
  { value: 'MEDIUM',   label: 'Medium',   bg: '#e2dfff', text: '#180092' },
  { value: 'HIGH',     label: 'High',     bg: '#fde68a', text: '#92400e' },
  { value: 'CRITICAL', label: 'Critical', bg: '#ffdad6', text: '#ba1a1a' },
]

const TASK_TYPES: { value: TaskType; label: string; emoji: string; color: string; bg: string }[] = [
  { value: 'CCTV_INSTALLATION',  label: 'CCTV Installation',  emoji: '\u{1F4F9}', color: '#006a66', bg: '#e8faf9' },
  { value: 'LIFT_INSTALLATION',  label: 'Lift Installation',  emoji: '\u{1F6D7}', color: '#180092', bg: '#f0eeff' },
  { value: 'RACKS_INSTALLATION', label: 'Racks Installation', emoji: '\u{1F5C4}', color: '#7d3600', bg: '#fff4ec' },
]

export default function CreateTaskScreen() {
  const dispatch = useAppDispatch()
  const navigation = useNavigation<Nav>()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM')
  const [taskType, setTaskType] = useState<TaskType>('CCTV_INSTALLATION')
  const [dateObj, setDateObj] = useState<Date | null>(null)
  const [pendingDate, setPendingDate] = useState<Date>(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [assignedToId, setAssignedToId] = useState<number | null>(null)
  const [assignedToName, setAssignedToName] = useState('')

  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userModalVisible, setUserModalVisible] = useState(false)

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setUsersLoading(true)
    userService.getAll()
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false))
  }, [])

  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const formatDisplay = (d: Date) =>
    d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })

  const openDatePicker = () => {
    setPendingDate(dateObj ?? new Date())
    setShowDatePicker(true)
  }

  // iOS: only update pendingDate while browsing; commit on Done
  const onDateChangeiOS = (_: DateTimePickerEvent, selected?: Date) => {
    if (selected) setPendingDate(selected)
  }

  const confirmDateiOS = () => {
    setDateObj(pendingDate)
    setErrors((e) => ({ ...e, dueDate: '' }))
    setShowDatePicker(false)
  }

  const cancelDateiOS = () => {
    setShowDatePicker(false)
    // pendingDate is discarded — dateObj unchanged
  }

  // Android: fires once on confirm or dismiss
  const onDateChangeAndroid = (event: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false)
    if (event.type === 'set' && selected) {
      setDateObj(selected)
      setErrors((e) => ({ ...e, dueDate: '' }))
    }
    // type === 'dismissed' → user cancelled, dateObj unchanged
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = 'Title is required.'
    if (!dateObj) e.dueDate = 'Please select a due date.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    const req: CreateTaskRequest = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      taskType,
      assignedToId: assignedToId ?? undefined,
      dueDate: `${formatDate(dateObj!)}T00:00:00`,
    }
    setLoading(true)
    try {
      const result = await dispatch(createTask(req))
      if (createTask.fulfilled.match(result)) {
        navigation.goBack()
      } else {
        setErrors({ submit: (result.payload as string) || result.error?.message || 'Failed to create task.' })
      }
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()),
  )

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Task Type */}
          <View style={styles.section}>
            <Text style={styles.label}>Task Type<Text style={styles.requiredMark}> *</Text></Text>
            <View style={styles.typeGrid}>
              {TASK_TYPES.map((t) => {
                const active = taskType === t.value
                return (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => setTaskType(t.value)}
                    activeOpacity={0.75}
                    style={[
                      styles.typeCard,
                      active && { borderColor: t.color, borderWidth: 2, backgroundColor: t.bg },
                    ]}
                  >
                    <Text style={{ fontSize: 20, marginBottom: 4 }}>{t.emoji}</Text>
                    <Text style={[styles.typeLabel, active && { color: t.color, fontWeight: '700' }]}>
                      {t.label}
                    </Text>
                    {active && (
                      <View style={[styles.typeCheck, { backgroundColor: t.color }]}>
                        <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>&#x2713;</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.label}>Title<Text style={styles.requiredMark}> *</Text></Text>
            <TextInput
              style={[styles.input, errors.title ? styles.inputError : undefined]}
              value={title}
              onChangeText={(v) => { setTitle(v); setErrors((e) => ({ ...e, title: '' })) }}
              placeholder="e.g. CCTV install — Block B, Floor 3"
              placeholderTextColor="#9aa5b1"
              maxLength={200}
            />
            {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add context, requirements or notes..."
              placeholderTextColor="#9aa5b1"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Priority */}
          <View style={styles.section}>
            <Text style={styles.label}>Priority<Text style={styles.requiredMark}> *</Text></Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => {
                const active = priority === p.value
                return (
                  <TouchableOpacity
                    key={p.value}
                    onPress={() => setPriority(p.value)}
                    activeOpacity={0.75}
                    style={[
                      styles.priorityChip,
                      active
                        ? { backgroundColor: p.bg, borderColor: p.text }
                        : { backgroundColor: '#f2f4f6', borderColor: '#e0e3e5' },
                    ]}
                  >
                    <Text style={[styles.priorityChipText, { color: active ? p.text : '#44474c' }]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          {/* Assign To */}
          <View style={styles.section}>
            <Text style={styles.label}>Assign To</Text>
            <TouchableOpacity
              onPress={() => { setUserModalVisible(true); setUserSearch('') }}
              activeOpacity={0.75}
              style={styles.pickerBtn}
            >
              {usersLoading ? (
                <ActivityIndicator size="small" color="#9aa5b1" style={{ flex: 1 }} />
              ) : assignedToId ? (
                <View style={styles.pickerSelected}>
                  <View style={styles.pickerAvatar}>
                    <Text style={styles.pickerAvatarText}>{assignedToName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.pickerSelectedText}>{assignedToName}</Text>
                </View>
              ) : (
                <Text style={styles.pickerPlaceholder}>Select user to assign...</Text>
              )}
              <Text style={styles.pickerChevron}>&#x25BC;</Text>
            </TouchableOpacity>
            {assignedToId ? (
              <TouchableOpacity
                onPress={() => { setAssignedToId(null); setAssignedToName('') }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.clearBtn}
              >
                <Text style={styles.clearBtnText}>&#x2715;  Remove assignment</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Due Date */}
          <View style={styles.section}>
            <Text style={styles.label}>Due Date<Text style={styles.requiredMark}> *</Text></Text>
            <TouchableOpacity
              onPress={openDatePicker}
              activeOpacity={0.75}
              style={[styles.pickerBtn, errors.dueDate ? styles.pickerBtnError : undefined]}
            >
              <Text style={styles.dateIcon}>&#x1F4C5;</Text>
              <Text style={[styles.datePickerText, !dateObj && { color: '#9aa5b1' }]}>
                {dateObj ? formatDisplay(dateObj) : 'Select a due date...'}
              </Text>
              {dateObj ? (
                <TouchableOpacity
                  onPress={() => setDateObj(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.dateClear}>&#x2715;</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.pickerChevron}>&#x25BC;</Text>
              )}
            </TouchableOpacity>
            {errors.dueDate ? <Text style={styles.errorText}>{errors.dueDate}</Text> : null}

            {/* Android: shows system calendar dialog once */}
            {Platform.OS === 'android' && showDatePicker && (
              <DateTimePicker
                value={pendingDate}
                mode="date"
                display="calendar"
                minimumDate={new Date()}
                onChange={onDateChangeAndroid}
              />
            )}
          </View>

          {/* iOS date picker bottom sheet */}
          {Platform.OS === 'ios' && (
            <Modal
              visible={showDatePicker}
              animationType="slide"
              transparent
              onRequestClose={() => setShowDatePicker(false)}
            >
              <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={cancelDateiOS}
              />
              <View style={styles.modalSheet}>
                <View style={styles.sheetHandle} />
                <View style={styles.dateSheetHeader}>
                  <TouchableOpacity onPress={cancelDateiOS} style={styles.dateSheetCancel}>
                    <Text style={styles.dateSheetCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.sheetTitle}>Select Due Date</Text>
                  <TouchableOpacity onPress={confirmDateiOS} style={styles.dateSheetDone}>
                    <Text style={styles.dateSheetDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={pendingDate}
                  mode="date"
                  display="inline"
                  minimumDate={new Date()}
                  onChange={onDateChangeiOS}
                  style={{ alignSelf: 'center' }}
                />
              </View>
            </Modal>
          )}

          {/* Submit error */}
          {errors.submit ? (
            <View style={styles.submitError}>
              <Text style={styles.submitErrorText}>{errors.submit}</Text>
            </View>
          ) : null}

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.submitBtn, loading ? styles.submitBtnDisabled : undefined]}
            onPress={submit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Create Task</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* User Picker Modal */}
      <Modal
        visible={userModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setUserModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setUserModalVisible(false)}
        />
        <View style={styles.modalSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Select Assignee</Text>
          <View style={styles.sheetSearch}>
            <Text style={{ fontSize: 13, marginRight: 6 }}>&#x1F50D;</Text>
            <TextInput
              style={styles.sheetSearchInput}
              value={userSearch}
              onChangeText={setUserSearch}
              placeholder="Search by name or email..."
              placeholderTextColor="#9aa5b1"
              autoFocus
              clearButtonMode="while-editing"
            />
          </View>
          {usersLoading ? (
            <View style={styles.sheetLoading}>
              <ActivityIndicator color="#041627" />
              <Text style={styles.sheetLoadingText}>Loading users...</Text>
            </View>
          ) : filteredUsers.length === 0 ? (
            <Text style={styles.sheetEmpty}>No users found.</Text>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(u) => String(u.id)}
              style={styles.sheetList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = assignedToId === item.id
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setAssignedToId(item.id)
                      setAssignedToName(item.name)
                      setUserModalVisible(false)
                    }}
                    activeOpacity={0.75}
                    style={[styles.userRow, active ? styles.userRowActive : undefined]}
                  >
                    <View style={[styles.userAvatar, active ? { backgroundColor: '#041627' } : undefined]}>
                      <Text style={[styles.userAvatarText, active ? { color: '#fff' } : undefined]}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.userName, active ? { color: '#041627', fontWeight: '700' } : undefined]}>
                        {item.name}
                      </Text>
                      <Text style={styles.userEmail}>{item.email}</Text>
                    </View>
                    {active ? <Text style={styles.userCheck}>&#x2713;</Text> : null}
                  </TouchableOpacity>
                )
              }}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f9fb' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 16 },

  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eceef0',
    shadowColor: '#041627',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#44474c',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  requiredMark: { color: '#ba1a1a' },
  errorText: { fontSize: 11, color: '#ba1a1a', marginTop: 5 },

  input: {
    backgroundColor: '#f7f9fb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#041627',
    borderWidth: 1.5,
    borderColor: '#e0e3e5',
  },
  inputError: { borderColor: '#ba1a1a', backgroundColor: '#fff8f8' },
  textarea: { minHeight: 90, paddingTop: 11 },

  typeGrid: { flexDirection: 'row', gap: 8 },
  typeCard: {
    flex: 1,
    backgroundColor: '#f7f9fb',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e3e5',
    position: 'relative',
  },
  typeLabel: { fontSize: 10, fontWeight: '600', color: '#44474c', textAlign: 'center', lineHeight: 13 },
  typeCheck: {
    position: 'absolute',
    top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  priorityRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  priorityChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  priorityChipText: { fontSize: 12, fontWeight: '600' },

  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f9fb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#e0e3e5',
    gap: 8,
  },
  pickerBtnError: { borderColor: '#ba1a1a', backgroundColor: '#fff8f8' },
  pickerPlaceholder: { flex: 1, fontSize: 14, color: '#9aa5b1' },
  pickerChevron: { fontSize: 9, color: '#9aa5b1', fontWeight: '700' },
  pickerSelected: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickerAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#e0e3e5', alignItems: 'center', justifyContent: 'center',
  },
  pickerAvatarText: { fontSize: 12, fontWeight: '700', color: '#041627' },
  pickerSelectedText: { fontSize: 14, fontWeight: '600', color: '#041627' },
  clearBtn: { marginTop: 8, alignSelf: 'flex-start' },
  clearBtnText: { fontSize: 11, color: '#ba1a1a', fontWeight: '600' },

  dateIcon: { fontSize: 16, flexShrink: 0 },
  datePickerText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#041627' },
  dateClear: { fontSize: 13, color: '#9aa5b1', fontWeight: '700', paddingHorizontal: 2 },
  dateSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  dateSheetCancel: { paddingVertical: 4, paddingHorizontal: 12 },
  dateSheetCancelText: { color: '#44474c', fontSize: 13, fontWeight: '600' },
  dateSheetDone: { paddingVertical: 4, paddingHorizontal: 12, backgroundColor: '#041627', borderRadius: 8 },
  dateSheetDoneText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  submitError: {
    backgroundColor: '#fef2f2', borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#fca5a5',
  },
  submitErrorText: { fontSize: 13, color: '#ba1a1a', fontWeight: '500' },

  submitBtn: {
    backgroundColor: '#041627',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#041627',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 40,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e3e5',
    alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#041627', marginBottom: 12 },
  sheetSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f9fb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#eceef0',
    marginBottom: 10,
  },
  sheetSearchInput: { flex: 1, fontSize: 13, color: '#041627' },
  sheetLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20 },
  sheetLoadingText: { fontSize: 13, color: '#44474c' },
  sheetEmpty: { fontSize: 13, color: '#44474c', padding: 20, textAlign: 'center' },
  sheetList: { flex: 1 },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#eceef0',
  },
  userRowActive: { backgroundColor: '#f0f4ff' },
  userAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#e0e3e5', alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: { fontSize: 14, fontWeight: '700', color: '#041627' },
  userName: { fontSize: 13, fontWeight: '600', color: '#041627' },
  userEmail: { fontSize: 11, color: '#44474c', marginTop: 1 },
  userCheck: { color: '#041627', fontWeight: '700', fontSize: 13 },
})
