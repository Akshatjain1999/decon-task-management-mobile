import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Linking,
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Constants from 'expo-constants'

// Detect Expo Go — VisionCamera native module is not bundled there
const IS_EXPO_GO = Constants.appOwnership === 'expo'

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  primary: '#006a66',
  primarySoft: '#e6f7f6',
  text: '#191c1e',
  muted: '#737c7f',
  border: '#e0e3e5',
  danger: '#ba1a1a',
  bg: '#f8f9fa',
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BarcodeScannerModalProps {
  visible: boolean
  itemName: string
  allowManual?: boolean
  loading?: boolean
  onConfirm: (serials: string[]) => void
  onCancel: () => void
}

// ── ROI (VisionCamera, normalised 0-1) ────────────────────────────────────────
const ROI = { x: 0.14, y: 0.225, width: 0.72, height: 0.55 }

// ─────────────────────────────────────────────────────────────────────────────
// Expo Go scanner — uses expo-camera (works in Expo Go)
// ─────────────────────────────────────────────────────────────────────────────
function ExpoGoScannerView({ onCode }: { onCode: (value: string) => void }) {
  const { CameraView, useCameraPermissions } = require('expo-camera')
  const [permission, requestPermission] = useCameraPermissions()
  const lastRef = useRef<string | null>(null)

  useEffect(() => {
    if (permission && !permission.granted) requestPermission()
  }, [permission?.granted])

  if (!permission) return <View style={sv.box}><ActivityIndicator color={C.primary} /></View>

  if (!permission.granted) {
    return (
      <View style={[sv.box, { justifyContent: 'center', alignItems: 'center', padding: 16 }]}>
        <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 12 }}>Camera permission required</Text>
        <TouchableOpacity
          style={{ backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
          onPress={() => requestPermission().then((r: { granted: boolean }) => { if (!r.granted) Linking.openSettings() })}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={sv.box}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'datamatrix', 'code93'] }}
        onBarcodeScanned={({ data }: { data: string }) => {
          const value = data?.trim()
          if (!value) return
          if (lastRef.current === value) return
          lastRef.current = value
          setTimeout(() => { lastRef.current = null }, 1500)
          onCode(value)
        }}
      />
      {/* Visual ROI overlay */}
      <View style={sv.maskTop} pointerEvents="none" />
      <View style={sv.maskBottom} pointerEvents="none" />
      <View style={sv.maskLeft} pointerEvents="none" />
      <View style={sv.maskRight} pointerEvents="none" />
      <View style={sv.viewfinder} pointerEvents="none">
        <View style={[sv.corner, sv.cornerTL]} />
        <View style={[sv.corner, sv.cornerTR]} />
        <View style={[sv.corner, sv.cornerBL]} />
        <View style={[sv.corner, sv.cornerBR]} />
      </View>
      <Text style={sv.hint}>Align barcode within the frame</Text>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Dev/Production scanner — uses react-native-vision-camera (dev build)
// ─────────────────────────────────────────────────────────────────────────────
function VisionCameraScannerView({ onCode }: { onCode: (value: string) => void }) {
  const {
    Camera,
    useCameraDevice,
    useCameraPermission,
    useCodeScanner,
  } = require('react-native-vision-camera')

  const device = useCameraDevice('back')
  const { hasPermission, requestPermission } = useCameraPermission()
  const lastRef = useRef<string | null>(null)

  useEffect(() => {
    if (!hasPermission) requestPermission()
  }, [hasPermission])

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'code-128', 'code-39', 'ean-13', 'ean-8', 'data-matrix', 'code-93'],
    regionOfInterest: ROI,
    onCodeScanned: (codes: Array<{ value?: string }>) => {
      for (const code of codes) {
        const value = code.value?.trim()
        if (!value) continue
        if (lastRef.current === value) continue
        lastRef.current = value
        setTimeout(() => { lastRef.current = null }, 1500)
        onCode(value)
        break
      }
    },
  })

  if (!hasPermission) {
    return (
      <View style={[sv.box, { justifyContent: 'center', alignItems: 'center', padding: 16 }]}>
        <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 12 }}>Camera permission required</Text>
        <TouchableOpacity
          style={{ backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
          onPress={() => requestPermission().then((granted: boolean) => { if (!granted) Linking.openSettings() })}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!device) {
    return (
      <View style={[sv.box, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={C.primary} />
        <Text style={{ color: '#fff', marginTop: 8, fontSize: 12 }}>Loading camera…</Text>
      </View>
    )
  }

  return (
    <View style={sv.box}>
      <Camera
        style={StyleSheet.absoluteFillObject}
        device={device}
        isActive
        codeScanner={codeScanner}
      />
      <View style={sv.maskTop} pointerEvents="none" />
      <View style={sv.maskBottom} pointerEvents="none" />
      <View style={sv.maskLeft} pointerEvents="none" />
      <View style={sv.maskRight} pointerEvents="none" />
      <View style={sv.viewfinder} pointerEvents="none">
        <View style={[sv.corner, sv.cornerTL]} />
        <View style={[sv.corner, sv.cornerTR]} />
        <View style={[sv.corner, sv.cornerBL]} />
        <View style={[sv.corner, sv.cornerBR]} />
      </View>
      <Text style={sv.hint}>Align barcode within the frame</Text>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared ScannerView dispatcher
// ─────────────────────────────────────────────────────────────────────────────
function ScannerView({ onCode }: { onCode: (value: string) => void }) {
  return IS_EXPO_GO
    ? <ExpoGoScannerView onCode={onCode} />
    : <VisionCameraScannerView onCode={onCode} />
}

// ── Shared StyleSheet for scanner views ──────────────────────────────────────
const pct = (n: number) => `${n * 100}%` as `${number}%`
const sv = StyleSheet.create({
  box: { height: 260, backgroundColor: '#000', overflow: 'hidden', position: 'relative' },
  maskTop:    { position: 'absolute', top: 0, left: 0, right: 0, height: pct(ROI.y), backgroundColor: 'rgba(0,0,0,0.6)' },
  maskBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: pct(ROI.y), backgroundColor: 'rgba(0,0,0,0.6)' },
  maskLeft:   { position: 'absolute', top: pct(ROI.y), bottom: pct(ROI.y), left: 0, width: pct(ROI.x), backgroundColor: 'rgba(0,0,0,0.6)' },
  maskRight:  { position: 'absolute', top: pct(ROI.y), bottom: pct(ROI.y), right: 0, width: pct(ROI.x), backgroundColor: 'rgba(0,0,0,0.6)' },
  viewfinder: { position: 'absolute', top: pct(ROI.y), left: pct(ROI.x), width: pct(ROI.width), height: pct(ROI.height), borderRadius: 6 },
  corner:     { position: 'absolute', width: 22, height: 22, borderColor: C.primary, borderRadius: 3 },
  cornerTL:   { top: 0,    left: 0,  borderTopWidth: 3,    borderLeftWidth: 3  },
  cornerTR:   { top: 0,    right: 0, borderTopWidth: 3,    borderRightWidth: 3 },
  cornerBL:   { bottom: 0, left: 0,  borderBottomWidth: 3, borderLeftWidth: 3  },
  cornerBR:   { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  hint: { position: 'absolute', bottom: pct(ROI.y + 0.04), alignSelf: 'center', color: 'rgba(255,255,255,0.8)', fontSize: 11, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
})

// ── Main component ────────────────────────────────────────────────────────────
export default function BarcodeScannerModal({
  visible, itemName, allowManual = false, loading = false, onConfirm, onCancel,
}: BarcodeScannerModalProps) {
  const insets = useSafeAreaInsets()
  const [scanned, setScanned] = useState<string[]>([])
  const [manualInput, setManualInput] = useState('')

  useEffect(() => {
    if (!visible) return
    setScanned([])
    setManualInput('')
  }, [visible])

  const handleCode = useCallback((value: string) => {
    setScanned(prev => prev.includes(value) ? prev : [...prev, value])
  }, [])

  function removeSerial(sn: string) { setScanned(prev => prev.filter(s => s !== sn)) }

  function addManual() {
    const val = manualInput.trim()
    if (!val) return
    setScanned(prev => prev.includes(val) ? prev : [...prev, val])
    setManualInput('')
  }

  function handleConfirm() {
    if (scanned.length === 0) { Alert.alert('No serials', 'Please scan or enter at least one serial number.'); return }
    onConfirm(scanned)
  }

  if (!visible) return null

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.fullCard}>
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.headerLabel}>STOCK IN</Text>
              <Text style={styles.title} numberOfLines={2}>{itemName}</Text>
              {scanned.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{scanned.length} scanned</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.closeCircle} onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScannerView onCode={handleCode} />

          {allowManual && (
            <View style={styles.manualRow}>
              <TextInput style={styles.manualInput} value={manualInput} onChangeText={setManualInput}
                placeholder="Enter serial manually…" placeholderTextColor={C.muted}
                returnKeyType="done" onSubmitEditing={addManual} autoCapitalize="characters" />
              <TouchableOpacity style={styles.addBtn} onPress={addManual}>
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 8 }}>
            {scanned.length === 0 && <Text style={styles.emptyText}>No serials scanned yet.</Text>}
            {scanned.map((sn, i) => (
              <View key={sn} style={styles.serialRow}>
                <Text style={styles.serialIndex}>{i + 1}.</Text>
                <Text style={styles.serialText} numberOfLines={1}>{sn}</Text>
                <TouchableOpacity onPress={() => removeSerial(sn)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Text style={styles.removeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom) }]}>
            <TouchableOpacity style={styles.btnGhost} onPress={onCancel} disabled={loading}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnPrimary, loading && styles.btnDisabled]} onPress={handleConfirm} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimaryText}>Confirm ({scanned.length})</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  fullCard:  { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, height: '92%' },
  header:       { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerLabel:  { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: C.primary, textTransform: 'uppercase', marginBottom: 2 },
  title:        { fontSize: 15, fontWeight: '700', color: C.text, lineHeight: 21 },
  countBadge:   { alignSelf: 'flex-start', marginTop: 6, backgroundColor: C.primarySoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  countBadgeText: { fontSize: 12, fontWeight: '600', color: C.primary },
  closeCircle:  { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  closeIcon:    { fontSize: 14, color: C.muted, lineHeight: 16 },
  manualRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 },
  manualInput: { flex: 1, height: 40, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: C.text },
  addBtn:    { backgroundColor: C.primarySoft, paddingHorizontal: 16, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: C.primary, fontWeight: '600', fontSize: 14 },
  list:      { flex: 1, paddingHorizontal: 12, paddingTop: 8 },
  emptyText: { textAlign: 'center', color: C.muted, fontSize: 13, marginTop: 16 },
  serialRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.bg, gap: 6 },
  serialIndex: { fontSize: 12, color: C.muted, width: 22, textAlign: 'right' },
  serialText:  { flex: 1, fontSize: 14, color: C.text, fontFamily: 'monospace' },
  removeBtn:   { fontSize: 14, color: C.danger, paddingHorizontal: 4 },
  footer:    { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingTop: 8 },
  btnPrimary:     { flex: 1, backgroundColor: C.primary, borderRadius: 10, height: 44, justifyContent: 'center', alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnGhost:       { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: C.border, height: 44, justifyContent: 'center', alignItems: 'center' },
  btnGhostText:   { color: C.text, fontSize: 15 },
  btnDisabled:    { opacity: 0.6 },
})
