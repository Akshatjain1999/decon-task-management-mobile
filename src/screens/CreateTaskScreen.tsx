import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import { useAppDispatch } from '../store/hooks'
import { createTask } from '../store/taskSlice'
import type { TaskPriority, TaskType, CreateTaskRequest } from '../types'

type Nav = NativeStackNavigationProp<RootStackParamList>

const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const TASK_TYPES: TaskType[] = ['CCTV_INSTALLATION', 'LIFT_INSTALLATION', 'RACKS_INSTALLATION']
const TYPE_LABELS: Record<TaskType, string> = {
  CCTV_INSTALLATION: 'CCTV Installation',
  LIFT_INSTALLATION: 'Lift Installation',
  RACKS_INSTALLATION: 'Racks Installation',
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: '#2e7d32',
  MEDIUM: '#e65100',
  HIGH: '#b71c1c',
  CRITICAL: '#4a148c',
}

export default function CreateTaskScreen() {
  const dispatch = useAppDispatch()
  const navigation = useNavigation<Nav>()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM')
  const [taskType, setTaskType] = useState<TaskType>('CCTV_INSTALLATION')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)

  const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Title is required.')
      return
    }
    if (!dueDate || !isValidDate(dueDate)) {
      Alert.alert('Validation', 'Enter a valid due date (YYYY-MM-DD).')
      return
    }

    const req: CreateTaskRequest = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      taskType,
      dueDate: `${dueDate}T00:00:00`,  // backend expects LocalDateTime
    }

    setLoading(true)
    try {
      const result = await dispatch(createTask(req))
      if (createTask.fulfilled.match(result)) {
        navigation.goBack()
      } else {
        Alert.alert('Error', 'Failed to create task. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Title */}
      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Task title"
        placeholderTextColor="#aaa"
        maxLength={200}
      />

      {/* Description */}
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Optional description"
        placeholderTextColor="#aaa"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* Task Type */}
      <Text style={styles.label}>Task Type *</Text>
      <View style={styles.chipRow}>
        {TASK_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, taskType === t && styles.chipActive]}
            onPress={() => setTaskType(t)}
          >
            <Text style={[styles.chipText, taskType === t && styles.chipTextActive]}>
              {TYPE_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Priority */}
      <Text style={styles.label}>Priority *</Text>
      <View style={styles.chipRow}>
        {PRIORITIES.map((p) => (
          <TouchableOpacity
            key={p}
            style={[
              styles.chip,
              priority === p && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] },
            ]}
            onPress={() => setPriority(p)}
          >
            <Text style={[styles.chipText, priority === p && { color: '#fff' }]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Due Date */}
      <Text style={styles.label}>Due Date * (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={dueDate}
        onChangeText={setDueDate}
        placeholder="2025-12-31"
        placeholderTextColor="#aaa"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />

      {/* Submit */}
      <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={submit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Create Task</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#222',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textarea: { minHeight: 80 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#1a237e',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#1a237e' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#1a237e' },
  chipTextActive: { color: '#fff' },
  btn: {
    marginTop: 28,
    backgroundColor: '#1a237e',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
