import React, { useState, useRef, useEffect } from 'react'
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
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  primary: '#006a66',
  primarySoft: '#e6f7f6',
  text: '#191c1e',
  muted: '#737c7f',
  border: '#e0e3e5',
  danger: '#ba1a1a',
  dangerSoft: '#fce8e8',
  bg: '#f8f9fa',
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BarcodeScannerModalProps {
  visible: boolean
  itemName: string
  /** When true, a manual text-input is shown (super admin bypass) */
  allowManual?: boolean
  loading?: boolean
  onConfirm: (serials: string[]) => void
  onCancel: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BarcodeScannerModal({
  visible,
  itemName,
  allowManual = false,
  loading = false,
  onConfirm,
  onCancel,
}: BarcodeScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const insets = useSafeAreaInsets()
  const [scanned, setScanned] = useState<string[]>([])
  const [manualInput, setManualInput] = useState('')
  const lastScannedRef = useRef<string | null>(null)

  // Reset state when modal opens + immediately ask for permission
  useEffect(() => {
    if (!visible) return
    setScanned([])
    setManualInput('')
    lastScannedRef.current = null
    // Auto-request: if not yet determined or not granted, show the OS dialog immediately
    requestPermission()
  }, [visible])

  function handleBarcode(result: BarcodeScanningResult) {
    const value = result.data?.trim()
    if (!value) return
    // Debounce: ignore same code within 1.5 s
    if (lastScannedRef.current === value) return
    lastScannedRef.current = value
    setTimeout(() => { lastScannedRef.current = null }, 1500)

    if (scanned.includes(value)) return
    setScanned(prev => [...prev, value])
  }

  function removeSerial(sn: string) {
    setScanned(prev => prev.filter(s => s !== sn))
  }

  function addManual() {
    const val = manualInput.trim()
    if (!val) return
    if (scanned.includes(val)) return
    setScanned(prev => [...prev, val])
    setManualInput('')
  }

  function handleConfirm() {
    if (scanned.length === 0) {
      Alert.alert('No serials', 'Please scan or enter at least one serial number.')
      return
    }
    onConfirm(scanned)
  }

  if (!visible) return null

  // ── Permission gate ────────────────────────────────────────────────────────
  const cardPadding = { paddingBottom: Math.max(32, insets.bottom + 20) }

  // Still loading permission status or the OS dialog is open
  if (!permission || !permission.granted) {
    const denied = permission && !permission.canAskAgain
    return (
      <Modal visible transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.card, cardPadding]}>
            {!permission ? (
              <ActivityIndicator color={C.primary} size="large" />
            ) : (
              <>
                <Text style={styles.title}>
                  {denied ? 'Camera access denied' : 'Requesting camera…'}
                </Text>
                <Text style={[styles.sub, { marginBottom: 20 }]}>
                  {denied
                    ? 'Please enable camera access in your device Settings.'
                    : 'Please allow camera access when prompted.'}
                </Text>
                {denied && (
                  <TouchableOpacity style={styles.btnPrimary} onPress={() => Linking.openSettings()}>
                    <Text style={styles.btnPrimaryText}>Open Settings</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            <TouchableOpacity style={[styles.btnGhost, { marginTop: 12 }]} onPress={onCancel}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )
  }

  // ── Main scanner UI ────────────────────────────────────────────────────────
  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.fullCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>Stock In — {itemName}</Text>
              <Text style={styles.sub}>Scanned: {scanned.length}</Text>
            </View>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Camera */}
          <View style={styles.cameraBox}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'datamatrix'] }}
              onBarcodeScanned={handleBarcode}
            />
            {/* Viewfinder guide */}
            <View style={styles.viewfinder} pointerEvents="none" />
          </View>

          {/* Manual input (super admin only) */}
          {allowManual && (
            <View style={styles.manualRow}>
              <TextInput
                style={styles.manualInput}
                value={manualInput}
                onChangeText={setManualInput}
                placeholder="Enter serial manually…"
                placeholderTextColor={C.muted}
                returnKeyType="done"
                onSubmitEditing={addManual}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.addBtn} onPress={addManual}>
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Scanned list */}
          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 8 }}>
            {scanned.length === 0 && (
              <Text style={styles.emptyText}>No serials scanned yet.</Text>
            )}
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

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.btnGhost} onPress={onCancel} disabled={loading}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, loading && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnPrimaryText}>Confirm ({scanned.length})</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
  },
  fullCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '92%',
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
  },
  sub: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  closeBtn: {
    fontSize: 18,
    color: C.muted,
    paddingLeft: 8,
  },
  cameraBox: {
    height: 220,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  viewfinder: {
    position: 'absolute',
    top: '20%',
    left: '15%',
    right: '15%',
    bottom: '20%',
    borderWidth: 2,
    borderColor: C.primary,
    borderRadius: 8,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  manualInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: C.text,
  },
  addBtn: {
    backgroundColor: C.primarySoft,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    color: C.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  list: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: C.muted,
    fontSize: 13,
    marginTop: 16,
  },
  serialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.bg,
    gap: 6,
  },
  serialIndex: {
    fontSize: 12,
    color: C.muted,
    width: 22,
    textAlign: 'right',
  },
  serialText: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    fontFamily: 'monospace',
  },
  removeBtn: {
    fontSize: 14,
    color: C.danger,
    paddingHorizontal: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: C.primary,
    borderRadius: 10,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  btnGhost: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnGhostText: {
    color: C.text,
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.6,
  },
})
