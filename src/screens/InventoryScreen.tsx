import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as inventoryService from '../services/inventoryService'
import type {
  InventoryCategory,
  InventoryDashboard,
  InventoryItem,
  TaskType,
  CreateInventoryItemRequest,
  UpdateInventoryItemRequest,
} from '../types'
import { useAppSelector } from '../store/hooks'
import BarcodeScannerModal from '../components/BarcodeScannerModal'

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  primary: '#006a66',
  primarySoft: '#e6f7f6',
  text: '#0e1a23',
  muted: '#737c7f',
  faint: '#9aa0a6',
  border: '#e8eaed',
  bg: '#f1f4f6',
  warning: '#b45309',
  warnBg: '#fef3c7',
  danger: '#ba1a1a',
  dangerBg: '#fce8e8',
  success: '#166534',
  successBg: '#dcfce7',
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORY_LABEL: Record<InventoryCategory, string> = {
  CAMERA: 'Camera',
  NVR_STORAGE: 'NVR/Storage',
  RACK: 'Rack',
  NETWORK: 'Network',
  DISPLAY: 'Display',
  CABLE: 'Cable',
  ACCESSORIES: 'Accessories',
}

const CATEGORY_COLOR: Record<InventoryCategory, string> = {
  CAMERA: '#0ea5e9',
  NVR_STORAGE: '#8b5cf6',
  RACK: '#f59e0b',
  NETWORK: '#10b981',
  DISPLAY: '#ec4899',
  CABLE: '#f97316',
  ACCESSORIES: '#6b7280',
}

const TASK_TYPE_LABEL: Record<TaskType, string> = {
  CCTV_INSTALLATION: 'CCTV',
  LIFT_INSTALLATION: 'Lift',
  RACKS_INSTALLATION: 'Racks',
}

const CATEGORIES: InventoryCategory[] = ['CAMERA', 'NVR_STORAGE', 'RACK', 'NETWORK', 'DISPLAY', 'CABLE', 'ACCESSORIES']
const TASK_TYPES: TaskType[] = ['CCTV_INSTALLATION', 'LIFT_INSTALLATION', 'RACKS_INSTALLATION']
const UNITS = ['pcs', 'meters', 'sets', 'rolls', 'boxes']

function today() {
  return new Date().toISOString().substring(0, 10)
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[kpi.card, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={[kpi.value, { color }]}>{value}</Text>
      <Text style={kpi.label}>{label}</Text>
    </View>
  )
}
const kpi = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e8eaed', alignItems: 'center' },
  value: { fontSize: 26, fontWeight: '900', lineHeight: 30 },
  label: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: C.faint, marginTop: 3, textAlign: 'center' },
})

// ── SelectSheet (simple bottom-sheet picker) ──────────────────────────────────
function SelectSheet<T extends string>({
  visible, title, options, value, onSelect, onClose,
}: {
  visible: boolean
  title: string
  options: { value: T; label: string }[]
  value: T
  onSelect: (v: T) => void
  onClose: () => void
}) {
  if (!visible) return null
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={sel.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={sel.sheet}>
          <Text style={sel.title}>{title}</Text>
          <ScrollView>
            {options.map(o => (
              <TouchableOpacity
                key={o.value}
                style={[sel.row, o.value === value && sel.rowActive]}
                onPress={() => { onSelect(o.value); onClose() }}
              >
                <Text style={[sel.rowText, o.value === value && sel.rowTextActive]}>{o.label}</Text>
                {o.value === value && <Text style={sel.check}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
const sel = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, maxHeight: '70%' },
  title: { fontSize: 14, fontWeight: '700', color: C.text, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  rowActive: { backgroundColor: C.primarySoft },
  rowText: { fontSize: 14, color: C.text },
  rowTextActive: { fontWeight: '700', color: C.primary },
  check: { color: C.primary, fontWeight: '700' },
})

// ── AddEditModal ──────────────────────────────────────────────────────────────
function AddEditModal({
  visible, item, isSuperAdmin, onClose, onSaved,
}: {
  visible: boolean
  item: InventoryItem | null
  isSuperAdmin: boolean
  onClose: () => void
  onSaved: (saved: InventoryItem) => void
}) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('pcs')
  const [taskType, setTaskType] = useState<TaskType>('CCTV_INSTALLATION')
  const [category, setCategory] = useState<InventoryCategory>('ACCESSORIES')
  const [description, setDescription] = useState('')
  const [minStockAlert, setMinStockAlert] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [serialTracked, setSerialTracked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pickers
  const [showUnit, setShowUnit] = useState(false)
  const [showTaskType, setShowTaskType] = useState(false)
  const [showCategory, setShowCategory] = useState(false)

  useEffect(() => {
    if (!visible) return
    if (item) {
      setName(item.name); setUnit(item.unit); setTaskType(item.taskType)
      setCategory(item.category); setDescription(item.description ?? '')
      setMinStockAlert(String(item.minStockAlert)); setIsActive(item.isActive)
      setSerialTracked(item.serialTracked)
    } else {
      setName(''); setUnit('pcs'); setTaskType('CCTV_INSTALLATION')
      setCategory('ACCESSORIES'); setDescription(''); setMinStockAlert('0')
      setIsActive(true); setSerialTracked(false)
    }
    setError(null)
  }, [visible, item])

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    try {
      let saved: InventoryItem
      if (item) {
        const req: UpdateInventoryItemRequest = {
          name, unit, category,
          description: description || undefined,
          minStockAlert: Number(minStockAlert),
          isActive,
          serialTracked,
        }
        saved = await inventoryService.updateInventoryItem(item.id, req)
      } else {
        const req: CreateInventoryItemRequest = {
          name, unit, taskType, category,
          description: description || undefined,
          minStockAlert: Number(minStockAlert),
          serialTracked,
        }
        saved = await inventoryService.createInventoryItem(req)
      }
      onSaved(saved)
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.header}>
              <Text style={m.headerTitle}>{item ? 'Edit Item' : 'Add Catalog Item'}</Text>
              <TouchableOpacity onPress={onClose}><Text style={m.headerClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView style={m.body} keyboardShouldPersistTaps="handled">
              <Text style={m.label}>Name *</Text>
              <TextInput style={m.input} value={name} onChangeText={setName} placeholder="Item name" placeholderTextColor={C.faint} />

              <Text style={m.label}>Unit</Text>
              <TouchableOpacity style={m.picker} onPress={() => setShowUnit(true)}>
                <Text style={m.pickerText}>{unit}</Text>
                <Text style={m.pickerArrow}>▾</Text>
              </TouchableOpacity>

              {!item && (
                <>
                  <Text style={m.label}>Task Type</Text>
                  <TouchableOpacity style={m.picker} onPress={() => setShowTaskType(true)}>
                    <Text style={m.pickerText}>{TASK_TYPE_LABEL[taskType]}</Text>
                    <Text style={m.pickerArrow}>▾</Text>
                  </TouchableOpacity>
                </>
              )}

              <Text style={m.label}>Category</Text>
              <TouchableOpacity style={m.picker} onPress={() => setShowCategory(true)}>
                <Text style={m.pickerText}>{CATEGORY_LABEL[category]}</Text>
                <Text style={m.pickerArrow}>▾</Text>
              </TouchableOpacity>

              <Text style={m.label}>Min Stock Alert</Text>
              <TextInput style={m.input} value={minStockAlert} onChangeText={setMinStockAlert}
                keyboardType="number-pad" placeholderTextColor={C.faint} />

              <Text style={m.label}>Description</Text>
              <TextInput style={[m.input, { height: 72, textAlignVertical: 'top' }]}
                value={description} onChangeText={setDescription}
                placeholder="Optional" placeholderTextColor={C.faint} multiline />

              <View style={m.toggleRow}>
                <TouchableOpacity style={[m.toggle, serialTracked && m.toggleOn]} onPress={() => setSerialTracked(v => !v)}>
                  <Text style={[m.toggleText, serialTracked && m.toggleTextOn]}>Serial Tracked</Text>
                </TouchableOpacity>
                {item && (
                  <TouchableOpacity style={[m.toggle, isActive && m.toggleOn]} onPress={() => setIsActive(v => !v)}>
                    <Text style={[m.toggleText, isActive && m.toggleTextOn]}>Active</Text>
                  </TouchableOpacity>
                )}
              </View>

              {error ? <Text style={m.error}>{error}</Text> : null}

              <TouchableOpacity style={[m.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={m.saveBtnText}>{item ? 'Save Changes' : 'Add Item'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <SelectSheet visible={showUnit} title="Select Unit"
        options={UNITS.map(u => ({ value: u, label: u }))} value={unit}
        onSelect={setUnit} onClose={() => setShowUnit(false)} />
      <SelectSheet visible={showTaskType} title="Task Type"
        options={TASK_TYPES.map(t => ({ value: t, label: TASK_TYPE_LABEL[t] }))} value={taskType}
        onSelect={setTaskType} onClose={() => setShowTaskType(false)} />
      <SelectSheet visible={showCategory} title="Category"
        options={CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABEL[c] }))} value={category}
        onSelect={setCategory} onClose={() => setShowCategory(false)} />
    </>
  )
}

// ── StockInModal (non-serialised) ─────────────────────────────────────────────
function StockInQtyModal({
  visible, item, onClose, onStocked,
}: {
  visible: boolean
  item: InventoryItem | null
  onClose: () => void
  onStocked: () => void
}) {
  const [qty, setQty] = useState('1')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(today())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (visible) { setQty('1'); setNotes(''); setDate(today()); setError(null) } }, [visible])

  async function handleSubmit() {
    if (!item) return
    const n = parseInt(qty, 10)
    if (isNaN(n) || n < 1) { setError('Quantity must be at least 1'); return }
    setSaving(true); setError(null)
    try {
      await inventoryService.stockIn(item.id, { quantity: n, notes: notes || undefined, movementDate: date })
      onStocked()
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (!visible || !item) return null
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <View style={m.header}>
            <View style={{ flex: 1 }}>
              <Text style={m.headerTitle}>Stock In</Text>
              <Text style={[m.label, { marginTop: 2 }]} numberOfLines={1}>{item.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose}><Text style={m.headerClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={m.body} keyboardShouldPersistTaps="handled">
            <View style={si.stockRow}>
              <Text style={si.stockLabel}>Current stock</Text>
              <Text style={si.stockVal}>{item.stockQuantity} <Text style={si.stockUnit}>{item.unit}</Text></Text>
            </View>
            <Text style={m.label}>Quantity *</Text>
            <TextInput style={m.input} value={qty} onChangeText={setQty} keyboardType="number-pad" placeholderTextColor={C.faint} />
            <Text style={m.label}>Date (YYYY-MM-DD)</Text>
            <TextInput style={m.input} value={date} onChangeText={setDate} placeholder="2025-01-01" placeholderTextColor={C.faint} />
            <Text style={m.label}>Notes</Text>
            <TextInput style={m.input} value={notes} onChangeText={setNotes} placeholder="Optional" placeholderTextColor={C.faint} />
            {error ? <Text style={m.error}>{error}</Text> : null}
            <TouchableOpacity style={[m.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSubmit} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={m.saveBtnText}>Add Stock</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const si = StyleSheet.create({
  stockRow: { backgroundColor: C.bg, borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  stockLabel: { fontSize: 12, color: C.muted },
  stockVal: { fontSize: 20, fontWeight: '800', color: C.text },
  stockUnit: { fontSize: 13, fontWeight: '400', color: C.muted },
})

// ── Shared modal styles ───────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.text, flex: 1 },
  headerClose: { fontSize: 18, color: C.faint, paddingLeft: 8 },
  body: { padding: 20 },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: C.muted, marginBottom: 4, marginTop: 14 },
  input: { backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text },
  picker: { backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerText: { fontSize: 14, color: C.text },
  pickerArrow: { fontSize: 14, color: C.faint },
  toggleRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  toggle: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingVertical: 10, alignItems: 'center' },
  toggleOn: { backgroundColor: C.primarySoft, borderColor: C.primary },
  toggleText: { fontSize: 13, color: C.muted, fontWeight: '600' },
  toggleTextOn: { color: C.primary },
  error: { color: C.danger, fontSize: 13, marginTop: 8 },
  saveBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})

// ── Item card ─────────────────────────────────────────────────────────────────
function ItemCard({
  item, isAdmin, isSuperAdmin, onStockIn, onEdit,
}: {
  item: InventoryItem
  isAdmin: boolean
  isSuperAdmin: boolean
  onStockIn: (item: InventoryItem) => void
  onEdit: (item: InventoryItem) => void
}) {
  const catColor = CATEGORY_COLOR[item.category]
  const stockColor = item.stockQuantity === 0 ? C.danger : item.lowStock ? C.warning : C.text

  return (
    <View style={ic.card}>
      <View style={ic.row}>
        {/* Category dot */}
        <View style={[ic.dot, { backgroundColor: catColor }]} />
        <View style={{ flex: 1 }}>
          <View style={ic.nameRow}>
            <Text style={ic.name} numberOfLines={1}>{item.name}</Text>
            {item.lowStock && item.isActive && (
              <View style={ic.warnPill}>
                <Text style={ic.warnText}>Low</Text>
              </View>
            )}
            {!item.isActive && (
              <View style={ic.inactivePill}>
                <Text style={ic.inactiveText}>Inactive</Text>
              </View>
            )}
          </View>
          <Text style={ic.meta}>{CATEGORY_LABEL[item.category]} · {TASK_TYPE_LABEL[item.taskType]}</Text>
          {item.description ? <Text style={ic.desc} numberOfLines={1}>{item.description}</Text> : null}
        </View>
        {/* Stock badge */}
        <View style={ic.stockBox}>
          <Text style={[ic.stockVal, { color: stockColor }]}>{item.stockQuantity}</Text>
          <Text style={ic.stockUnit}>{item.unit}</Text>
        </View>
      </View>

      {isAdmin && (
        <View style={ic.actions}>
          <TouchableOpacity style={ic.actionBtn} onPress={() => onStockIn(item)}>
            <Text style={ic.actionBtnText}>+ Stock In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ic.actionBtn, ic.editBtn]} onPress={() => onEdit(item)}>
            <Text style={ic.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}
const ic = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: C.border, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 14, fontWeight: '700', color: C.text, flexShrink: 1 },
  meta: { fontSize: 11, color: C.faint, marginTop: 2 },
  desc: { fontSize: 11, color: C.muted, marginTop: 2 },
  warnPill: { backgroundColor: C.warnBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20 },
  warnText: { fontSize: 9, fontWeight: '700', color: C.warning },
  inactivePill: { backgroundColor: C.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20 },
  inactiveText: { fontSize: 9, fontWeight: '700', color: C.faint },
  stockBox: { alignItems: 'flex-end' },
  stockVal: { fontSize: 20, fontWeight: '900', lineHeight: 22 },
  stockUnit: { fontSize: 10, color: C.faint, marginTop: 1 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  actionBtn: { flex: 1, backgroundColor: C.primarySoft, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: C.primary },
  editBtn: { backgroundColor: C.bg },
  editBtnText: { fontSize: 12, fontWeight: '700', color: C.muted },
})

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function InventoryScreen() {
  const user = useAppSelector(s => s.auth.user)
  const role = (user?.role ?? '').toUpperCase()
  const isAdmin = role.includes('ADMIN')
  const isSuperAdmin = role === 'SUPER_ADMIN'

  const [items, setItems] = useState<InventoryItem[]>([])
  const [dashboard, setDashboard] = useState<InventoryDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterTaskType, setFilterTaskType] = useState<TaskType | ''>('')
  const [filterCategory, setFilterCategory] = useState<InventoryCategory | ''>('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active')

  // Filter sheet pickers
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const [showCatFilter, setShowCatFilter] = useState(false)
  const [showActiveFilter, setShowActiveFilter] = useState(false)

  // Modals
  const [addEditOpen, setAddEditOpen] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [siOpen, setSiOpen] = useState(false)
  const [siItem, setSiItem] = useState<InventoryItem | null>(null)
  const [barcodeOpen, setBarcodeOpen] = useState(false)
  const [barcodeItem, setBarcodeItem] = useState<InventoryItem | null>(null)
  const [barcodeSaving, setBarcodeSaving] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const [catalog, dash] = await Promise.all([
        inventoryService.getCatalog(),
        inventoryService.getInventoryDashboard(),
      ])
      setItems(catalog)
      setDashboard(dash)
    } catch (e: any) {
      setError(e?.message || 'Failed to load inventory')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (filterTaskType && item.taskType !== filterTaskType) return false
      if (filterCategory && item.category !== filterCategory) return false
      if (filterActive === 'active' && !item.isActive) return false
      if (filterActive === 'inactive' && item.isActive) return false
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [items, filterTaskType, filterCategory, filterActive, search])

  function openStockIn(item: InventoryItem) {
    if (item.serialTracked) {
      setBarcodeItem(item)
      setBarcodeOpen(true)
    } else {
      setSiItem(item)
      setSiOpen(true)
    }
  }

  async function submitBarcodeStockIn(serials: string[]) {
    if (!barcodeItem) return
    setBarcodeSaving(true)
    try {
      await inventoryService.stockInWithSerials(barcodeItem.id, { serialNumbers: serials, movementDate: today() })
      setBarcodeOpen(false)
      setBarcodeItem(null)
      load(true)
    } catch (e: any) {
      Alert.alert('Stock-in failed', e?.response?.data?.message || e?.message || 'Something went wrong')
    } finally {
      setBarcodeSaving(false)
    }
  }

  function onItemSaved(saved: InventoryItem) {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === saved.id)
      return idx >= 0 ? prev.map(i => i.id === saved.id ? saved : i) : [...prev, saved]
    })
    setAddEditOpen(false)
    setEditItem(null)
    load(true)
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Inventory</Text>
          <Text style={s.headerSub}>Material catalog & HQ stock</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity style={s.addBtn} onPress={() => { setEditItem(null); setAddEditOpen(true) }}>
            <Text style={s.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true) }} tintColor={C.primary} />}
      >
        {/* ── KPI row ──────────────────────────────────────────────────── */}
        {dashboard && (
          <View style={s.kpiRow}>
            <KpiCard label="Total" value={dashboard.totalItems} color={C.primary} />
            <KpiCard label="Low Stock" value={dashboard.lowStockItems} color={C.warning} />
            <KpiCard label="Out" value={dashboard.outOfStockItems} color={C.danger} />
            <KpiCard label="Active" value={items.filter(i => i.isActive).length} color="#10b981" />
          </View>
        )}

        {/* ── Low stock banner ─────────────────────────────────────────── */}
        {dashboard && dashboard.lowStockItems > 0 && (
          <View style={s.warnBanner}>
            <Text style={s.warnBannerTitle}>⚠ {dashboard.lowStockItems} item{dashboard.lowStockItems > 1 ? 's' : ''} need restocking</Text>
            <Text style={s.warnBannerItems} numberOfLines={2}>
              {dashboard.lowStockList.slice(0, 5).map(i => `${i.name} (${i.stockQuantity})`).join(' · ')}
              {dashboard.lowStockList.length > 5 ? ` +${dashboard.lowStockList.length - 5} more` : ''}
            </Text>
          </View>
        )}

        {/* ── Search + Filters ─────────────────────────────────────────── */}
        <View style={s.searchRow}>
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search items…"
            placeholderTextColor={C.faint}
            clearButtonMode="while-editing"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          <TouchableOpacity style={[s.chip, filterTaskType && s.chipActive]} onPress={() => setShowTypeFilter(true)}>
            <Text style={[s.chipText, filterTaskType && s.chipTextActive]}>
              {filterTaskType ? TASK_TYPE_LABEL[filterTaskType] : 'All Types'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.chip, filterCategory && s.chipActive]} onPress={() => setShowCatFilter(true)}>
            <Text style={[s.chipText, filterCategory && s.chipTextActive]}>
              {filterCategory ? CATEGORY_LABEL[filterCategory] : 'All Categories'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.chip, filterActive !== 'all' && s.chipActive]} onPress={() => setShowActiveFilter(true)}>
            <Text style={[s.chipText, filterActive !== 'all' && s.chipTextActive]}>
              {filterActive === 'all' ? 'All Status' : filterActive === 'active' ? 'Active' : 'Inactive'}
            </Text>
          </TouchableOpacity>
          {(filterTaskType || filterCategory || filterActive !== 'all' || search) && (
            <TouchableOpacity style={s.clearChip} onPress={() => { setFilterTaskType(''); setFilterCategory(''); setFilterActive('all'); setSearch('') }}>
              <Text style={s.clearChipText}>Clear ✕</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* ── Content ──────────────────────────────────────────────────── */}
        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator color={C.primary} size="large" />
          </View>
        ) : error ? (
          <View style={s.centered}>
            <Text style={s.errText}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.centered}>
            <Text style={s.emptyText}>No items found</Text>
          </View>
        ) : (
          <View style={{ paddingTop: 8, paddingBottom: 24 }}>
            <Text style={s.countLabel}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</Text>
            {filtered.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                isSuperAdmin={isSuperAdmin}
                onStockIn={openStockIn}
                onEdit={item => { setEditItem(item); setAddEditOpen(true) }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Filter sheets ─────────────────────────────────────────────── */}
      <SelectSheet visible={showTypeFilter} title="Task Type"
        options={[{ value: '' as TaskType, label: 'All Types' }, ...TASK_TYPES.map(t => ({ value: t, label: TASK_TYPE_LABEL[t] }))]}
        value={filterTaskType as TaskType} onSelect={v => setFilterTaskType(v)} onClose={() => setShowTypeFilter(false)} />
      <SelectSheet visible={showCatFilter} title="Category"
        options={[{ value: '' as InventoryCategory, label: 'All Categories' }, ...CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABEL[c] }))]}
        value={filterCategory as InventoryCategory} onSelect={v => setFilterCategory(v)} onClose={() => setShowCatFilter(false)} />
      <SelectSheet visible={showActiveFilter} title="Status"
        options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
        value={filterActive} onSelect={v => setFilterActive(v as 'all' | 'active' | 'inactive')} onClose={() => setShowActiveFilter(false)} />

      {/* ── Modals ────────────────────────────────────────────────────── */}
      <AddEditModal
        visible={addEditOpen}
        item={editItem}
        isSuperAdmin={isSuperAdmin}
        onClose={() => { setAddEditOpen(false); setEditItem(null) }}
        onSaved={onItemSaved}
      />
      <StockInQtyModal
        visible={siOpen}
        item={siItem}
        onClose={() => { setSiOpen(false); setSiItem(null) }}
        onStocked={() => { setSiOpen(false); setSiItem(null); load(true) }}
      />
      <BarcodeScannerModal
        visible={barcodeOpen}
        itemName={barcodeItem?.name ?? ''}
        allowManual={isSuperAdmin}
        loading={barcodeSaving}
        onConfirm={submitBarcodeStockIn}
        onCancel={() => { setBarcodeOpen(false); setBarcodeItem(null) }}
      />
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 22, fontWeight: '900', color: C.text },
  headerSub: { fontSize: 12, color: C.muted, marginTop: 1 },
  addBtn: { backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  kpiRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },

  warnBanner: { marginHorizontal: 16, marginTop: 8, backgroundColor: C.warnBg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fde68a' },
  warnBannerTitle: { fontSize: 12, fontWeight: '700', color: C.warning, marginBottom: 4 },
  warnBannerItems: { fontSize: 11, color: '#92400e' },

  searchRow: { paddingHorizontal: 16, paddingTop: 12 },
  searchInput: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.text },

  filterScroll: { marginTop: 10 },
  chip: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.primarySoft, borderColor: C.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: C.muted },
  chipTextActive: { color: C.primary },
  clearChip: { backgroundColor: '#fce8e8', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#f5c2c2' },
  clearChipText: { fontSize: 12, fontWeight: '600', color: C.danger },

  countLabel: { fontSize: 11, fontWeight: '700', color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 20, paddingBottom: 8 },
  centered: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: C.faint, fontSize: 14 },
  errText: { color: C.danger, fontSize: 14, textAlign: 'center' },
  retryBtn: { backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
})
