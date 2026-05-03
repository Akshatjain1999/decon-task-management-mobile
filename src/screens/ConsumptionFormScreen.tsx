import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import { vendorBucketService, type VendorBucketItem, type SubmitConsumptionItem } from '../services/vendorService'
import { taskService } from '../services/taskService'
import type { Task } from '../types'

type Props = NativeStackScreenProps<RootStackParamList, 'ConsumptionForm'>

interface DispRow {
  dispositionType: 'TO_WAREHOUSE' | 'TO_ANOTHER_SITE' | 'KEPT_BY_VENDOR'
  quantity: string
  targetTaskId?: number
  keptLocationText?: string
}

interface ItemRow {
  taskInventoryId: number
  itemName: string
  pending: number
  quantityConsumed: string
  notes: string
  dispositions: DispRow[]
}

export default function ConsumptionFormScreen({ route, navigation }: Props) {
  const { taskId } = route.params
  const [items, setItems] = useState<ItemRow[]>([])
  const [otherTasks, setOtherTasks] = useState<Task[]>([])
  const [latitude, setLatitude] = useState<string>('')
  const [longitude, setLongitude] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      vendorBucketService.getBucket(taskId),
      taskService.getAll().catch(() => [] as Task[]),
    ])
      .then(([bucket, all]) => {
        setItems(bucket.map((b: VendorBucketItem) => ({
          taskInventoryId: b.id,
          itemName: b.itemName,
          pending: b.quantityPending ?? 0,
          quantityConsumed: '0',
          notes: '',
          dispositions: [],
        })))
        setOtherTasks(all.filter((t) => t.id !== taskId))
      })
      .catch((e: any) => Alert.alert('Failed to load vendor bucket', e?.response?.data?.message || e?.message))
      .finally(() => setLoading(false))

    captureLocation()
  }, [taskId])

  async function captureLocation() {
    setLocating(true)
    try {
      // Lazy require so the build doesn't hard-depend on expo-location until installed.
      const Location = require('expo-location')
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Location required', 'Please grant location permission to submit consumption.')
        return
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setLatitude(String(pos.coords.latitude))
      setLongitude(String(pos.coords.longitude))
    } catch (e: any) {
      Alert.alert('Location unavailable', e?.message || 'expo-location not installed')
    } finally {
      setLocating(false)
    }
  }

  function setItem(idx: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function addDisposition(idx: number) {
    setItems((prev) => prev.map((it, i) =>
      i === idx ? { ...it, dispositions: [...it.dispositions, { dispositionType: 'TO_WAREHOUSE', quantity: '0' }] } : it,
    ))
  }

  function setDisp(idx: number, dIdx: number, patch: Partial<DispRow>) {
    setItems((prev) => prev.map((it, i) => i === idx
      ? { ...it, dispositions: it.dispositions.map((d, j) => (j === dIdx ? { ...d, ...patch } : d)) }
      : it))
  }

  function removeDisp(idx: number, dIdx: number) {
    setItems((prev) => prev.map((it, i) => i === idx
      ? { ...it, dispositions: it.dispositions.filter((_, j) => j !== dIdx) }
      : it))
  }

  async function handleSubmit() {
    if (!latitude || !longitude) {
      Alert.alert('Location required', 'Acquire your location before submitting.')
      return
    }
    const payloadItems: SubmitConsumptionItem[] = items
      .map((it) => ({
        taskInventoryId: it.taskInventoryId,
        quantityConsumed: Number(it.quantityConsumed) || 0,
        notes: it.notes || undefined,
        dispositions: it.dispositions.map((d) => ({
          dispositionType: d.dispositionType,
          quantity: Number(d.quantity) || 0,
          targetTaskId: d.dispositionType === 'TO_ANOTHER_SITE' ? d.targetTaskId : undefined,
          keptLocationText: d.dispositionType === 'KEPT_BY_VENDOR' ? d.keptLocationText : undefined,
        })),
      }))
      .filter((it) => it.quantityConsumed > 0 || it.dispositions.length > 0)
    if (payloadItems.length === 0) {
      Alert.alert('Nothing to submit', 'Enter at least one consumption row.')
      return
    }
    setSubmitting(true)
    try {
      await vendorBucketService.submit(taskId, {
        latitude: Number(latitude),
        longitude: Number(longitude),
        items: payloadItems,
      })
      Alert.alert('Submitted', 'Consumption awaiting approval.')
      navigation.goBack()
    } catch (e: any) {
      Alert.alert('Submission failed', e?.response?.data?.message || e?.message || 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#006a66" style={{ marginTop: 40 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        <View style={styles.locBox}>
          <Text style={styles.locTitle}>📍 Current location</Text>
          <Text style={styles.locText}>
            {latitude && longitude ? `${latitude}, ${longitude}` : locating ? 'Acquiring…' : 'Unavailable'}
          </Text>
          <TouchableOpacity onPress={captureLocation} style={styles.locBtn}>
            <Text style={styles.locBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <Text style={styles.empty}>No dispatched material in vendor bucket.</Text>
        ) : (
          items.map((it, idx) => {
            const consumed = Number(it.quantityConsumed) || 0
            const expectedDisp = Math.max(0, it.pending - consumed)
            const dispTotal = it.dispositions.reduce((s, d) => s + (Number(d.quantity) || 0), 0)
            const ok = dispTotal === expectedDisp || (consumed === 0 && it.dispositions.length === 0)
            return (
              <View key={it.taskInventoryId} style={styles.card}>
                <Text style={styles.itemName}>{it.itemName}</Text>
                <Text style={styles.subText}>Pending: {it.pending}</Text>
                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.label}>Consumed</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={it.quantityConsumed}
                      onChangeText={(v) => setItem(idx, { quantityConsumed: v })}
                    />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.label}>Notes</Text>
                    <TextInput
                      style={styles.input}
                      value={it.notes}
                      onChangeText={(v) => setItem(idx, { notes: v })}
                    />
                  </View>
                </View>

                <View style={styles.dispHeader}>
                  <Text style={styles.label}>Dispositions for remaining {expectedDisp}</Text>
                  <TouchableOpacity onPress={() => addDisposition(idx)} disabled={expectedDisp <= 0}>
                    <Text style={[styles.addBtn, expectedDisp <= 0 && { opacity: 0.4 }]}>+ Add</Text>
                  </TouchableOpacity>
                </View>

                {it.dispositions.map((d, dIdx) => (
                  <View key={dIdx} style={styles.dispCard}>
                    <View style={styles.dispRow}>
                      {(['TO_WAREHOUSE', 'TO_ANOTHER_SITE', 'KEPT_BY_VENDOR'] as const).map((type) => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => setDisp(idx, dIdx, { dispositionType: type })}
                          style={[
                            styles.chip,
                            d.dispositionType === type && styles.chipActive,
                          ]}
                        >
                          <Text style={[styles.chipText, d.dispositionType === type && styles.chipTextActive]}>
                            {type === 'TO_WAREHOUSE' ? 'Warehouse' : type === 'TO_ANOTHER_SITE' ? 'Other site' : 'Kept'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="Quantity"
                      value={d.quantity}
                      onChangeText={(v) => setDisp(idx, dIdx, { quantity: v })}
                    />
                    {d.dispositionType === 'TO_ANOTHER_SITE' && (
                      <ScrollView horizontal style={{ marginTop: 6 }}>
                        {otherTasks.map((t) => (
                          <TouchableOpacity
                            key={t.id}
                            onPress={() => setDisp(idx, dIdx, { targetTaskId: t.id })}
                            style={[styles.chip, d.targetTaskId === t.id && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, d.targetTaskId === t.id && styles.chipTextActive]} numberOfLines={1}>
                              {t.title}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                    {d.dispositionType === 'KEPT_BY_VENDOR' && (
                      <TextInput
                        style={styles.input}
                        placeholder="Where kept?"
                        value={d.keptLocationText}
                        onChangeText={(v) => setDisp(idx, dIdx, { keptLocationText: v })}
                      />
                    )}
                    <TouchableOpacity onPress={() => removeDisp(idx, dIdx)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {!ok && (
                  <Text style={styles.errText}>
                    Disposition total ({dispTotal}) must equal {expectedDisp}.
                  </Text>
                )}
              </View>
            )
          })
        )}

        <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={[styles.submitBtn, submitting && { opacity: 0.5 }]}>
          <Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Submit Consumption'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f6' },
  empty: { textAlign: 'center', color: '#666', marginTop: 40 },
  locBox: { backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  locTitle: { fontWeight: '700', fontSize: 12 },
  locText: { flex: 1, marginLeft: 12, fontSize: 12, color: '#444' },
  locBtn: { backgroundColor: '#006a66', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  locBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  itemName: { fontWeight: '700', fontSize: 15, color: '#041627' },
  subText: { color: '#666', fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  col: { flex: 1 },
  label: { fontSize: 11, fontWeight: '700', color: '#666', textTransform: 'uppercase', marginBottom: 4 },
  input: { backgroundColor: '#f2f4f6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, marginTop: 4 },
  dispHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  addBtn: { color: '#006a66', fontWeight: '700', fontSize: 12 },
  dispCard: { backgroundColor: '#fafbfc', borderRadius: 8, padding: 10, marginTop: 8 },
  dispRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#e6e8ea', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 6, marginBottom: 4 },
  chipActive: { backgroundColor: '#006a66' },
  chipText: { fontSize: 11, color: '#444', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  removeText: { color: '#ba1a1a', fontSize: 11, marginTop: 6, fontWeight: '700' },
  errText: { color: '#ba1a1a', fontSize: 11, marginTop: 6 },
  submitBtn: { backgroundColor: '#041627', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
