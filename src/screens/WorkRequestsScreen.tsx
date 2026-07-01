import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppSelector } from '../store/hooks'
import { workRequestService, type WorkRequest } from '../services/vendorService'

const C = {
  primary: '#006a66',
  bg: '#f8fafc',
  card: '#fff',
  text: '#191c1e',
  muted: '#9aa0a6',
  border: '#e8eaed',
  danger: '#ba1a1a',
  dangerBg: '#ffdad6',
  successBg: '#edf7ed',
  success: '#166534',
  warnBg: '#fff3e0',
  warn: '#e65100',
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PENDING:   { bg: C.warnBg,   text: C.warn },
  IN_REVIEW: { bg: '#e8f1fb',  text: '#1a56a0' },
  APPROVED:  { bg: C.successBg, text: C.success },
  REJECTED:  { bg: C.dangerBg, text: C.danger },
}

const REQUEST_TYPES = ['MAINTENANCE', 'INSTALLATION', 'INSPECTION', 'MATERIAL_REQUEST', 'OTHER']
const URGENCIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const ADMIN_STATUSES: Array<'IN_REVIEW' | 'APPROVED' | 'REJECTED'> = ['IN_REVIEW', 'APPROVED', 'REJECTED']

export default function WorkRequestsScreen() {
  const role = useAppSelector((s) => s.auth.user?.role ?? '')
  const isVendor = role.toUpperCase() === 'VENDOR'
  const isAdmin = role.toUpperCase().includes('ADMIN') || role.toUpperCase() === 'EMPLOYEE'

  const [requests, setRequests] = useState<WorkRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createType, setCreateType] = useState('OTHER')
  const [createUrgency, setCreateUrgency] = useState('MEDIUM')
  const [creating, setCreating] = useState(false)

  // Decide modal
  const [decideTarget, setDecideTarget] = useState<WorkRequest | null>(null)
  const [decideStatus, setDecideStatus] = useState<'IN_REVIEW' | 'APPROVED' | 'REJECTED'>('IN_REVIEW')
  const [decideNote, setDecideNote] = useState('')
  const [deciding, setDeciding] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const data = isVendor
        ? await workRequestService.listMy()
        : await workRequestService.listAll()
      setRequests(data)
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load work requests')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [isVendor])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!createTitle.trim()) { Alert.alert('Required', 'Title is required'); return }
    setCreating(true)
    try {
      const created = await workRequestService.createMy({
        title: createTitle.trim(),
        description: createDesc.trim() || undefined,
        requestType: createType,
        urgency: createUrgency,
      })
      setRequests((prev) => [created, ...prev])
      setShowCreate(false)
      setCreateTitle(''); setCreateDesc(''); setCreateType('OTHER'); setCreateUrgency('MEDIUM')
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit request')
    } finally { setCreating(false) }
  }

  const handleDecide = async () => {
    if (!decideTarget) return
    setDeciding(true)
    try {
      const updated = await workRequestService.updateStatus(
        decideTarget.id, decideStatus, decideNote.trim() || undefined,
      )
      setRequests((prev) => prev.map((r) => r.id === updated.id ? updated : r))
      setDecideTarget(null); setDecideNote('')
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update status')
    } finally { setDeciding(false) }
  }

  const renderItem = ({ item }: { item: WorkRequest }) => {
    const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.PENDING
    const pending = item.status === 'PENDING' || item.status === 'IN_REVIEW'
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <View style={styles.chipRow}>
              <View style={[styles.chip, { backgroundColor: '#e8f1fb' }]}>
                <Text style={[styles.chipText, { color: '#1a56a0' }]}>{item.requestType.replace('_', ' ')}</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: item.urgency === 'CRITICAL' ? C.dangerBg : item.urgency === 'HIGH' ? '#fff3e0' : '#f1f4f6' }]}>
                <Text style={[styles.chipText, { color: item.urgency === 'CRITICAL' ? C.danger : item.urgency === 'HIGH' ? C.warn : C.muted }]}>{item.urgency}</Text>
              </View>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.text }]}>{item.status.replace('_', ' ')}</Text>
          </View>
        </View>

        {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}

        <View style={styles.cardFooter}>
          <Text style={styles.meta}>
            {isAdmin && item.vendorName ? `${item.vendorName} · ` : ''}
            {new Date(item.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          {item.adminNote ? <Text style={styles.adminNote}>"{item.adminNote}"</Text> : null}
        </View>

        {isAdmin && pending && (
          <TouchableOpacity
            style={styles.decideBtn}
            onPress={() => { setDecideTarget(item); setDecideStatus('IN_REVIEW'); setDecideNote('') }}
          >
            <Text style={styles.decideBtnText}>Update Status</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Work Requests</Text>
        {isVendor && (
          <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.newBtnText}>+ New</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          onRefresh={() => load(true)}
          refreshing={refreshing}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isVendor ? 'No work requests yet. Tap "+ New" to submit one.' : 'No work requests.'}
            </Text>
          }
        />
      )}

      {/* ── Create Modal ── */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={{ color: C.danger, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Work Request</Text>
            <TouchableOpacity onPress={handleCreate} disabled={creating}>
              {creating ? <ActivityIndicator color={C.primary} /> : <Text style={{ color: C.primary, fontSize: 15, fontWeight: '700' }}>Submit</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Title *</Text>
            <TextInput style={styles.input} value={createTitle} onChangeText={setCreateTitle} placeholder="Brief description of the issue…" />

            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top' }]} value={createDesc} onChangeText={setCreateDesc} placeholder="Details (optional)…" multiline />

            <Text style={styles.label}>Request Type</Text>
            <View style={styles.chipPicker}>
              {REQUEST_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.pickerChip, createType === t && styles.pickerChipActive]} onPress={() => setCreateType(t)}>
                  <Text style={[styles.pickerChipText, createType === t && { color: '#fff' }]}>{t.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Urgency</Text>
            <View style={styles.chipPicker}>
              {URGENCIES.map((u) => (
                <TouchableOpacity key={u} style={[styles.pickerChip, createUrgency === u && styles.pickerChipActive]} onPress={() => setCreateUrgency(u)}>
                  <Text style={[styles.pickerChipText, createUrgency === u && { color: '#fff' }]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Admin Decide Modal ── */}
      <Modal visible={!!decideTarget} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDecideTarget(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setDecideTarget(null)}>
              <Text style={{ color: C.danger, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Update Request</Text>
            <TouchableOpacity onPress={handleDecide} disabled={deciding}>
              {deciding ? <ActivityIndicator color={C.primary} /> : <Text style={{ color: C.primary, fontSize: 15, fontWeight: '700' }}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {decideTarget && <Text style={styles.modalSubtitle} numberOfLines={2}>{decideTarget.title}</Text>}

            <Text style={styles.label}>New Status</Text>
            <View style={styles.chipPicker}>
              {ADMIN_STATUSES.map((s) => (
                <TouchableOpacity key={s} style={[styles.pickerChip, decideStatus === s && styles.pickerChipActive]} onPress={() => setDecideStatus(s)}>
                  <Text style={[styles.pickerChipText, decideStatus === s && { color: '#fff' }]}>{s.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Admin Note (optional)</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={decideNote} onChangeText={setDecideNote} placeholder="Add a note for the vendor…" multiline />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  newBtn: { backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  chipText: { fontSize: 11, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '700' },
  desc: { fontSize: 13, color: '#44474c', marginBottom: 8, lineHeight: 18 },
  cardFooter: { marginTop: 4 },
  meta: { fontSize: 11, color: C.muted },
  adminNote: { fontSize: 12, color: '#44474c', fontStyle: 'italic', marginTop: 4 },
  decideBtn: { marginTop: 10, backgroundColor: '#e8f1fb', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  decideBtnText: { color: '#1a56a0', fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', color: C.muted, marginTop: 48, fontSize: 14, lineHeight: 22 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  modalSubtitle: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: C.card, color: C.text },
  chipPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  pickerChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  pickerChipText: { fontSize: 13, fontWeight: '600', color: C.text },
})
