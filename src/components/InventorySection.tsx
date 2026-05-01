import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import * as inventoryService from '../services/inventoryService'
import type { DispatchStatus, InventoryMovement, RecordMovementRequest, TaskInventoryItem } from '../types'

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DispatchStatus, { bg: string; text: string; label: string }> = {
  PENDING:              { bg: '#f1f4f6', text: '#44474c', label: 'Pending' },
  PARTIALLY_DISPATCHED: { bg: '#fef3c7', text: '#b45309', label: 'Partial' },
  DISPATCHED:           { bg: '#dbeafe', text: '#1d4ed8', label: 'Dispatched' },
  DELIVERED:            { bg: '#dcfce7', text: '#166534', label: 'Delivered' },
}

const MOV_TYPE_CONFIG: Record<string, { bg: string; text: string }> = {
  STOCK_IN:   { bg: '#dcfce7', text: '#166534' },
  DISPATCH:   { bg: '#dbeafe', text: '#1d4ed8' },
  DELIVERY:   { bg: '#e6f7f6', text: '#006a66' },
  RETURN:     { bg: '#fef3c7', text: '#b45309' },
  ADJUSTMENT: { bg: '#f1f4f6', text: '#44474c' },
}

// ── Props ───────────────────────────────────────────────────────────────────

interface Props {
  taskId: number
  isAdmin: boolean
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().substring(0, 10)
}

// ── Component ────────────────────────────────────────────────────────────────

export default function InventorySection({ taskId, isAdmin }: Props) {
  const [items, setItems] = useState<TaskInventoryItem[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [showMovements, setShowMovements] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Movement modal
  const [movOpen, setMovOpen] = useState(false)
  const [movItem, setMovItem] = useState<TaskInventoryItem | null>(null)
  const [movType, setMovType] = useState<'DISPATCH' | 'DELIVERY' | 'RETURN'>('DISPATCH')
  const [movQty, setMovQty] = useState('1')
  const [movNotes, setMovNotes] = useState('')
  const [movDate, setMovDate] = useState(today())
  const [movSaving, setMovSaving] = useState(false)
  const [movError, setMovError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [itemsData, movData] = await Promise.all([
        inventoryService.getTaskInventory(taskId),
        inventoryService.getTaskMovements(taskId),
      ])
      setItems(itemsData)
      setMovements(movData)
    } catch (e: any) {
      setError(e?.message || 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => { load() }, [load])

  function openMov(item: TaskInventoryItem, type: 'DISPATCH' | 'DELIVERY' | 'RETURN') {
    setMovItem(item)
    setMovType(type)
    setMovQty('1')
    setMovNotes('')
    setMovDate(today())
    setMovError(null)
    setMovOpen(true)
  }

  async function submitMov() {
    if (!movItem) return
    const qty = parseInt(movQty, 10)
    if (isNaN(qty) || qty < 1) { setMovError('Quantity must be at least 1'); return }
    setMovSaving(true)
    setMovError(null)
    try {
      const req: RecordMovementRequest = { quantity: qty, movementDate: movDate, notes: movNotes || undefined }
      if (movType === 'DISPATCH') await inventoryService.recordDispatch(taskId, movItem.inventoryItemId, req)
      else if (movType === 'DELIVERY') await inventoryService.recordDelivery(taskId, movItem.inventoryItemId, req)
      else await inventoryService.recordReturn(taskId, movItem.inventoryItemId, req)
      setMovOpen(false)
      setMovItem(null)
      load()
    } catch (e: any) {
      setMovError(e?.response?.data?.message || e?.message || 'Something went wrong')
    } finally {
      setMovSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color="#006a66" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={s.centered}>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity onPress={load} style={s.retryBtn}>
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View>
      {/* BOM list */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Bill of Materials</Text>
          <Text style={s.sectionCount}>{items.length} items</Text>
        </View>

        {items.length === 0 ? (
          <Text style={s.emptyText}>No inventory items for this task.</Text>
        ) : (
          items.map(item => {
            const sc = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING
            return (
              <View key={item.id} style={s.itemCard}>
                <View style={s.itemTop}>
                  <View style={s.itemNameWrap}>
                    <Text style={s.itemName}>{item.itemName}</Text>
                    <Text style={s.itemUnit}>{item.unit}</Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: sc.bg }]}>
                    <Text style={[s.statusPillText, { color: sc.text }]}>{sc.label}</Text>
                  </View>
                </View>
                <View style={s.itemQtyRow}>
                  <View style={s.qtyBox}>
                    <Text style={s.qtyLabel}>Required</Text>
                    <Text style={s.qtyVal}>{item.quantityRequired}</Text>
                  </View>
                  <View style={s.qtyBox}>
                    <Text style={s.qtyLabel}>Dispatched</Text>
                    <Text style={s.qtyVal}>{item.quantityDispatched}</Text>
                  </View>
                  <View style={s.qtyBox}>
                    <Text style={s.qtyLabel}>Delivered</Text>
                    <Text style={s.qtyVal}>{item.quantityDelivered}</Text>
                  </View>
                </View>
                {isAdmin && (
                  <View style={s.itemActions}>
                    <TouchableOpacity style={[s.actionBtn, { borderColor: '#1d4ed8' }]} onPress={() => openMov(item, 'DISPATCH')}>
                      <Text style={[s.actionBtnText, { color: '#1d4ed8' }]}>Dispatch</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionBtn, { borderColor: '#166534' }]} onPress={() => openMov(item, 'DELIVERY')}>
                      <Text style={[s.actionBtnText, { color: '#166534' }]}>Delivered</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionBtn, { borderColor: '#b45309' }]} onPress={() => openMov(item, 'RETURN')}>
                      <Text style={[s.actionBtnText, { color: '#b45309' }]}>Return</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )
          })
        )}
      </View>

      {/* Movement log */}
      {movements.length > 0 && (
        <View style={s.section}>
          <TouchableOpacity style={s.sectionHeader} onPress={() => setShowMovements(v => !v)}>
            <Text style={s.sectionTitle}>Movement Log</Text>
            <View style={s.sectionHeaderRight}>
              <Text style={s.sectionCount}>{movements.length}</Text>
              <Text style={s.chevron}>{showMovements ? '▲' : '▼'}</Text>
            </View>
          </TouchableOpacity>
          {showMovements && movements.map(m => {
            const tc = MOV_TYPE_CONFIG[m.movementType] ?? MOV_TYPE_CONFIG.ADJUSTMENT
            return (
              <View key={m.id} style={s.movRow}>
                <View style={s.movLeft}>
                  <Text style={s.movItemName}>{m.itemName}</Text>
                  <Text style={s.movMeta}>{m.movementDate} · {m.performedByName}</Text>
                  {m.notes ? <Text style={s.movNotes}>{m.notes}</Text> : null}
                </View>
                <View style={s.movRight}>
                  <View style={[s.movTypePill, { backgroundColor: tc.bg }]}>
                    <Text style={[s.movTypePillText, { color: tc.text }]}>{m.movementType}</Text>
                  </View>
                  <Text style={s.movQty}>{m.quantity}</Text>
                </View>
              </View>
            )
          })}
        </View>
      )}

      {/* Movement Modal */}
      <Modal visible={movOpen} transparent animationType="slide" onRequestClose={() => setMovOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {movType === 'DISPATCH' ? 'Record Dispatch' : movType === 'DELIVERY' ? 'Mark Delivered' : 'Record Return'}
              </Text>
              <TouchableOpacity onPress={() => setMovOpen(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {movItem && (
              <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
                <Text style={s.modalItemName}>{movItem.itemName}</Text>
                <View style={s.currentQtyRow}>
                  <View style={s.cqBox}><Text style={s.cqLabel}>Required</Text><Text style={s.cqVal}>{movItem.quantityRequired}</Text></View>
                  <View style={s.cqBox}><Text style={s.cqLabel}>Dispatched</Text><Text style={s.cqVal}>{movItem.quantityDispatched}</Text></View>
                  <View style={s.cqBox}><Text style={s.cqLabel}>Delivered</Text><Text style={s.cqVal}>{movItem.quantityDelivered}</Text></View>
                </View>
                <Text style={s.fieldLabel}>Quantity *</Text>
                <TextInput value={movQty} onChangeText={setMovQty} keyboardType="number-pad" style={s.fieldInput} />
                <Text style={s.fieldLabel}>Date (YYYY-MM-DD)</Text>
                <TextInput value={movDate} onChangeText={setMovDate} placeholder="2025-01-01" style={s.fieldInput} />
                <Text style={s.fieldLabel}>Notes</Text>
                <TextInput value={movNotes} onChangeText={setMovNotes} placeholder="Optional" style={s.fieldInput} />
                {movError ? <Text style={s.movErrText}>{movError}</Text> : null}
                <TouchableOpacity style={s.submitBtn} onPress={submitMov} disabled={movSaving}>
                  {movSaving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.submitBtnText}>Confirm</Text>}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  centered: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  errorText: { color: '#ba1a1a', textAlign: 'center', fontSize: 14 },
  retryBtn: { backgroundColor: '#006a66', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },

  section: { marginBottom: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e8eaed' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f4f6' },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: '#9aa0a6' },
  sectionCount: { fontSize: 11, color: '#9aa0a6' },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chevron: { fontSize: 10, color: '#9aa0a6' },
  emptyText: { padding: 16, color: '#9aa0a6', fontSize: 13, textAlign: 'center' },

  itemCard: { borderBottomWidth: 1, borderBottomColor: '#f1f4f6', padding: 14 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  itemNameWrap: { flex: 1, marginRight: 8 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#0e1a23' },
  itemUnit: { fontSize: 11, color: '#9aa0a6', marginTop: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  itemQtyRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  qtyBox: { flex: 1, backgroundColor: '#f1f4f6', borderRadius: 8, padding: 8, alignItems: 'center' },
  qtyLabel: { fontSize: 10, color: '#9aa0a6', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  qtyVal: { fontSize: 18, fontWeight: '800', color: '#0e1a23' },
  itemActions: { flexDirection: 'row', gap: 6 },
  actionBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  actionBtnText: { fontSize: 12, fontWeight: '600' },

  movRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f4f6' },
  movLeft: { flex: 1, marginRight: 8 },
  movItemName: { fontSize: 13, fontWeight: '500', color: '#0e1a23' },
  movMeta: { fontSize: 11, color: '#9aa0a6', marginTop: 1 },
  movNotes: { fontSize: 11, color: '#737c7f', marginTop: 2 },
  movRight: { alignItems: 'flex-end', gap: 4 },
  movTypePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  movTypePillText: { fontSize: 10, fontWeight: '700' },
  movQty: { fontSize: 16, fontWeight: '800', color: '#0e1a23' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f4f6' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0e1a23' },
  modalClose: { fontSize: 18, color: '#9aa0a6', padding: 4 },
  modalBody: { padding: 20 },
  modalItemName: { fontSize: 14, fontWeight: '600', color: '#006a66', marginBottom: 12 },
  currentQtyRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  cqBox: { flex: 1, backgroundColor: '#f1f4f6', borderRadius: 8, padding: 8, alignItems: 'center' },
  cqLabel: { fontSize: 10, color: '#9aa0a6', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  cqVal: { fontSize: 18, fontWeight: '800', color: '#0e1a23' },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: '#737c7f', marginBottom: 4, marginTop: 12 },
  fieldInput: { backgroundColor: '#f1f4f6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0e1a23' },
  movErrText: { color: '#ba1a1a', fontSize: 13, marginTop: 8 },
  submitBtn: { backgroundColor: '#006a66', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
