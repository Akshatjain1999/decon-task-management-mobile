import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { dashboardService } from '../services/dashboardService'
import type { TaskTypeDashboard, PipelineTaskItem } from '../types'
import type { RootStackParamList } from '../navigation/types'

type Route = RouteProp<RootStackParamList, 'TaskTypeDashboard'>

// ─── constants ───────────────────────────────────────────────────────────────

const TASK_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  CCTV_INSTALLATION:  { label: 'CCTV Installation',  color: '#006a66', bg: '#e8faf9' },
  LIFT_INSTALLATION:  { label: 'Lift Installation',  color: '#180092', bg: '#f0eeff' },
  RACKS_INSTALLATION: { label: 'Racks Installation', color: '#7d3600', bg: '#fff4ec' },
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  LOW:      { bg: '#e0e3e5', text: '#44474c' },
  MEDIUM:   { bg: '#81f2eb', text: '#006f6a' },
  HIGH:     { bg: '#e2dfff', text: '#180092' },
  CRITICAL: { bg: '#ffdad6', text: '#ba1a1a' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  COMPLETED:   { bg: '#dcfce7', text: '#166534' },
  IN_PROGRESS: { bg: '#e2dfff', text: '#180092' },
  OPEN:        { bg: '#e0e3e5', text: '#44474c' },
  OVERDUE:     { bg: '#ffdad6', text: '#ba1a1a' },
}

// ─── Ring Progress (pure RN) ──────────────────────────────────────────────────

function RingProgress({ value, size = 72, stroke = 7, color = '#006a66' }: {
  value: number; size?: number; stroke?: number; color?: string
}) {
  const clamp = Math.min(100, Math.max(0, value))
  const deg = (clamp / 100) * 360
  const half = size / 2
  const innerSize = size - stroke * 2

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute', width: size, height: size, borderRadius: half,
        borderWidth: stroke, borderColor: '#e0e3e5',
      }} />
      {clamp > 0 && (
        <View style={{
          position: 'absolute', width: size, height: size, overflow: 'hidden',
          transform: deg <= 180 ? [{ rotate: `${deg - 180}deg` }] : [],
        }}>
          <View style={{ position: 'absolute', left: half, width: half, height: size, overflow: 'hidden' }}>
            <View style={{
              position: 'absolute', left: -half,
              width: size, height: size, borderRadius: half,
              borderWidth: stroke, borderColor: color,
              transform: [{ rotate: deg <= 180 ? `${deg}deg` : '0deg' }],
            }} />
          </View>
        </View>
      )}
      {clamp > 180 && (
        <View style={{ position: 'absolute', width: size, height: size, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', left: 0, width: half, height: size, overflow: 'hidden' }}>
            <View style={{
              position: 'absolute',
              width: size, height: size, borderRadius: half,
              borderWidth: stroke, borderColor: color,
              transform: [{ rotate: `${deg - 180}deg` }],
            }} />
          </View>
        </View>
      )}
      <View style={{
        position: 'absolute',
        width: innerSize, height: innerSize, borderRadius: innerSize / 2,
        backgroundColor: '#fff',
      }} />
    </View>
  )
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function TaskTypeDashboardScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<Route>()
  const { typeKey } = route.params

  const meta = TASK_TYPE_META[typeKey] ?? { label: typeKey, color: '#041627', bg: '#f2f4f6' }
  const typeEmoji = typeKey === 'CCTV_INSTALLATION' ? '📹' : typeKey === 'LIFT_INSTALLATION' ? '🛗' : '🗄️'

  const [data, setData] = useState<TaskTypeDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // pipeline accordion
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [stepTasks, setStepTasks] = useState<Record<string, PipelineTaskItem[]>>({})
  const [stepLoading, setStepLoading] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    try {
      const d = await dashboardService.getTaskTypeDashboard(typeKey)
      setData(d)
    } catch {
      // show empty state
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [typeKey])

  useEffect(() => { load() }, [load])

  const onRefresh = () => { setRefreshing(true); load() }

  const handleStepPress = async (stepTitle: string) => {
    if (expandedStep === stepTitle) { setExpandedStep(null); return }
    setExpandedStep(stepTitle)
    if (stepTasks[stepTitle]) return
    setStepLoading(prev => ({ ...prev, [stepTitle]: true }))
    try {
      const tasks = await dashboardService.getPipelineTasks(typeKey, stepTitle)
      setStepTasks(prev => ({ ...prev, [stepTitle]: tasks }))
    } catch {
      // ignore
    } finally {
      setStepLoading(prev => ({ ...prev, [stepTitle]: false }))
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={meta.color} />
      </View>
    )
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#44474c' }}>Failed to load dashboard.</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f9fb' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={meta.color} />}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={styles.headerIconRow}>
              <View style={[styles.headerIconBadge, { backgroundColor: meta.bg }]}>
                <Text style={{ fontSize: 16 }}>{typeEmoji}</Text>
              </View>
              <Text style={[styles.headerTypeLabel, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Text style={styles.headerTitle}>Project Insights</Text>
            <Text style={styles.headerDesc}>Subtask completion per owner and installation pipeline.</Text>
          </View>
        </View>

        {/* ── KPI Cards ── */}
        <Text style={styles.sectionTitle}>KEY METRICS</Text>
        <View style={styles.kpiGrid}>
          {[
            { label: 'Total Tasks',  value: data.totalTasks,       accent: '#041627' },
            { label: 'Completed',    value: data.completedTasks,   accent: '#006a66' },
            { label: 'In Progress',  value: data.inProgressTasks,  accent: '#180092' },
            { label: 'Open',         value: data.openTasks,        accent: '#e0e3e5' },
            { label: 'Overdue',      value: data.overdueTasks,     accent: '#ba1a1a' },
            { label: 'Completion',   value: `${data.completionRate}%`, accent: meta.color },
          ].map((c) => (
            <View key={c.label} style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>{c.label}</Text>
              <Text style={styles.kpiValue}>{c.value}</Text>
              <View style={[styles.kpiAccent, { backgroundColor: c.accent }]} />
            </View>
          ))}
        </View>

        {/* ── Subtask Health + Priority ── */}
        <View style={styles.healthRow}>
          {/* ring */}
          <View style={[styles.healthCard, { flex: 1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <RingProgress value={data.subtaskCompletionRate} size={72} stroke={7} color={meta.color} />
                <View style={styles.ringOverlay}>
                  <Text style={[styles.ringPct, { color: '#041627' }]}>{data.subtaskCompletionRate}%</Text>
                </View>
              </View>
              <View>
                <Text style={styles.healthLabel}>SUBTASK COMPLETION</Text>
                <Text>
                  <Text style={styles.healthCountBig}>{data.completedSubtasks}</Text>
                  <Text style={styles.healthCountSmall}> / {data.totalSubtasks}</Text>
                </Text>
                <Text style={styles.healthPending}>{data.totalSubtasks - data.completedSubtasks} pending</Text>
              </View>
            </View>
          </View>
        </View>

        {/* priority chips */}
        <View style={[styles.card, { marginBottom: 20 }]}>
          <Text style={styles.sectionTitleInCard}>PRIORITY BREAKDOWN</Text>
          <View style={styles.priorityChips}>
            {Object.entries(data.tasksByPriority).map(([key, val]) => {
              const c = PRIORITY_COLORS[key] ?? { bg: '#e0e3e5', text: '#44474c' }
              return (
                <View key={key} style={[styles.priorityChip, { backgroundColor: c.bg }]}>
                  <Text style={[styles.priorityChipLabel, { color: c.text }]}>{key}</Text>
                  <Text style={[styles.priorityChipValue, { color: c.text }]}>{val}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* ── Owner Subtask Stats ── */}
        <Text style={styles.sectionTitle}>SUBTASK COMPLETION BY OWNER</Text>
        <View style={[styles.card, { padding: 0, marginBottom: 20 }]}>
          {data.ownerSubtaskStats.length === 0 ? (
            <Text style={styles.emptyText}>No owner assignments for this project type.</Text>
          ) : (
            <>
              {/* header row */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>OWNER</Text>
                <Text style={[styles.tableHeaderCell, { width: 40, textAlign: 'center' }]}>TOT</Text>
                <Text style={[styles.tableHeaderCell, { width: 40, textAlign: 'center' }]}>DONE</Text>
                <Text style={[styles.tableHeaderCell, { width: 44, textAlign: 'center' }]}>PEND</Text>
                <Text style={[styles.tableHeaderCell, { width: 88 }]}>PROGRESS</Text>
              </View>
              {data.ownerSubtaskStats.map((owner, i) => (
                <View key={owner.ownerId} style={[styles.tableRow, i === data.ownerSubtaskStats.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <View style={[styles.ownerAvatar, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.ownerAvatarText, { color: meta.color }]}>{owner.ownerName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.ownerName} numberOfLines={1}>{owner.ownerName}</Text>
                  </View>
                  <Text style={[styles.tableStat, { width: 40, color: '#041627' }]}>{owner.totalSubtasks}</Text>
                  <Text style={[styles.tableStat, { width: 40, color: '#006a66' }]}>{owner.completedSubtasks}</Text>
                  <Text style={[styles.tableStat, { width: 44, color: '#44474c' }]}>{owner.pendingSubtasks}</Text>
                  <View style={{ width: 88, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${owner.completionRate}%` as any, backgroundColor: meta.color }]} />
                    </View>
                    <Text style={[styles.progressPct, { color: meta.color }]}>{owner.completionRate}%</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        {/* ── WCC & Billing ── */}
        {data.wccBillingStats && (
          <>
            <Text style={styles.sectionTitle}>WCC & BILLING STATUS</Text>
            <View style={styles.wccGrid}>
              {[
                { label: 'WCC Pending',       value: data.wccBillingStats.wccPending,       text: '#b45309', accent: '#fde68a', bg: '#fff8e1' },
                { label: 'WCC Completed',     value: data.wccBillingStats.wccCompleted,     text: '#166534', accent: '#86efac', bg: '#dcfce7' },
                { label: 'Billing Pending',   value: data.wccBillingStats.billingPending,   text: '#ba1a1a', accent: '#fca5a5', bg: '#fef2f2' },
                { label: 'Billing Completed', value: data.wccBillingStats.billingCompleted, text: '#15803d', accent: '#4ade80', bg: '#f0fdf4' },
              ].map((c) => (
                <View key={c.label} style={styles.wccCard}>
                  <Text style={styles.wccValue}>{c.value}</Text>
                  <Text style={[styles.wccLabel, { color: c.text }]}>{c.label}</Text>
                  <View style={[styles.wccAccent, { backgroundColor: c.accent }]} />
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Installation Pipeline ── */}
        {data.subtaskPipeline.length > 0 && (
          <>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>INSTALLATION PIPELINE</Text>
              <View style={styles.stepsBadge}>
                <Text style={styles.stepsBadgeText}>{data.subtaskPipeline.length} steps</Text>
              </View>
            </View>
            <View style={[styles.card, { padding: 0, marginBottom: 20 }]}>
              {data.subtaskPipeline.map((step, i) => {
                const isExpanded = expandedStep === step.stepTitle
                const tasks = stepTasks[step.stepTitle] ?? []
                const isLoadingTasks = stepLoading[step.stepTitle]
                const isLast = i === data.subtaskPipeline.length - 1

                return (
                  <View key={step.stepTitle}>
                    <TouchableOpacity
                      onPress={() => handleStepPress(step.stepTitle)}
                      activeOpacity={0.75}
                      style={[
                        styles.stepRow,
                        (!isLast || isExpanded) && { borderBottomWidth: 1, borderBottomColor: '#eceef0' },
                        isExpanded && { backgroundColor: '#f7f9fb' },
                      ]}
                    >
                      {/* step number / check */}
                      <View style={[
                        styles.stepNumber,
                        {
                          backgroundColor: step.completionRate >= 100 ? meta.color
                            : step.completionRate > 0 ? meta.bg : '#e0e3e5',
                        },
                      ]}>
                        <Text style={[
                          styles.stepNumberText,
                          { color: step.completionRate >= 100 ? '#fff' : step.completionRate > 0 ? meta.color : '#44474c' },
                        ]}>
                          {step.completionRate >= 100 ? '✓' : String(i + 1)}
                        </Text>
                      </View>

                      {/* step name */}
                      <Text style={styles.stepTitle} numberOfLines={1}>{step.stepTitle}</Text>

                      {/* bar + stats */}
                      <View style={styles.stepBarWrapper}>
                        <View style={styles.stepBarBg}>
                          <View style={[styles.stepBarFill, { width: `${step.completionRate}%` as any, backgroundColor: meta.color }]} />
                        </View>
                      </View>

                      <Text style={[styles.stepPct, { color: step.completionRate >= 100 ? meta.color : '#041627' }]}>
                        {step.completionRate}%
                      </Text>
                      <Text style={styles.stepChevron}>{isExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {/* expanded task list */}
                    {isExpanded && (
                      <View style={[styles.stepTasksContainer, !isLast && { borderBottomWidth: 1, borderBottomColor: '#eceef0' }]}>
                        {isLoadingTasks ? (
                          <View style={styles.stepTasksLoading}>
                            <ActivityIndicator size="small" color={meta.color} />
                            <Text style={styles.stepTasksLoadingText}>Loading tasks…</Text>
                          </View>
                        ) : tasks.length === 0 ? (
                          <Text style={styles.emptyText}>No tasks found for this step.</Text>
                        ) : (
                          tasks.map((task, ti) => {
                            const sc = STATUS_COLORS[task.status] ?? { bg: '#e0e3e5', text: '#44474c' }
                            const pc = PRIORITY_COLORS[task.priority] ?? { bg: '#e0e3e5', text: '#44474c' }
                            return (
                              <View key={task.id} style={[styles.pipelineTaskRow, ti === tasks.length - 1 && { borderBottomWidth: 0 }]}>
                                <View style={[styles.subtaskDot, { backgroundColor: task.subtaskCompleted ? meta.color : '#e0e3e5' }]}>
                                  {task.subtaskCompleted && <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>✓</Text>}
                                </View>
                                <Text style={styles.pipelineTaskTitle} numberOfLines={1}>{task.title}</Text>
                                {task.assignedToName ? (
                                  <Text style={styles.pipelineTaskAssignee} numberOfLines={1}>{task.assignedToName}</Text>
                                ) : null}
                                <View style={[styles.badge, { backgroundColor: pc.bg }]}>
                                  <Text style={[styles.badgeText, { color: pc.text }]}>{task.priority}</Text>
                                </View>
                                <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                                  <Text style={[styles.badgeText, { color: sc.text }]}>{task.status.replace('_', ' ')}</Text>
                                </View>
                              </View>
                            )
                          })
                        )}
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7f9fb' },
  content: { padding: 16, paddingBottom: 32 },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  backBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#e0e3e5',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  backArrow: { fontSize: 22, color: '#041627', fontWeight: '300', marginTop: -2 },
  headerIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  headerIconBadge: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerTypeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#041627', letterSpacing: -0.5 },
  headerDesc: { fontSize: 11, color: '#44474c', marginTop: 2 },

  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: '#44474c', textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  sectionTitleInCard: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: '#44474c', textTransform: 'uppercase', marginBottom: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 },
  stepsBadge: { backgroundColor: '#f2f4f6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  stepsBadgeText: { fontSize: 9, color: '#44474c', fontWeight: '600' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#041627', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 2, borderWidth: 1, borderColor: '#eceef0',
  },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiCard: {
    width: '47%', backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#041627', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 2, borderWidth: 1, borderColor: '#eceef0',
  },
  kpiLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: '#44474c', textTransform: 'uppercase', marginBottom: 6 },
  kpiValue: { fontSize: 28, fontWeight: '800', color: '#041627', lineHeight: 32 },
  kpiAccent: { marginTop: 8, height: 3, borderRadius: 2 },

  healthRow: { marginBottom: 12 },
  healthCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#041627', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 2, borderWidth: 1, borderColor: '#eceef0',
  },
  healthLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: '#44474c', textTransform: 'uppercase', marginBottom: 4 },
  healthCountBig: { fontSize: 22, fontWeight: '800', color: '#041627' },
  healthCountSmall: { fontSize: 13, fontWeight: '600', color: '#44474c' },
  healthPending: { fontSize: 11, color: '#44474c', marginTop: 2 },

  ringOverlay: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontSize: 12, fontWeight: '800', lineHeight: 15 },

  priorityChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  priorityChip: { flex: 1, minWidth: 60, borderRadius: 10, padding: 8, alignItems: 'center' },
  priorityChipLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  priorityChipValue: { fontSize: 20, fontWeight: '800' },

  tableHeaderRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#f7f9fb', borderBottomWidth: 1, borderBottomColor: '#eceef0',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  tableHeaderCell: { fontSize: 8, fontWeight: '700', letterSpacing: 1, color: '#44474c', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#eceef0',
  },
  ownerAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ownerAvatarText: { fontSize: 11, fontWeight: '700' },
  ownerName: { fontSize: 11, fontWeight: '600', color: '#041627', flexShrink: 1 },
  tableStat: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  progressBarBg: { flex: 1, height: 6, backgroundColor: '#e0e3e5', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, borderRadius: 3 },
  progressPct: { fontSize: 9, fontWeight: '700', width: 30, textAlign: 'right' },

  wccGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  wccCard: {
    width: '47%', backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#041627', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 2, borderWidth: 1, borderColor: '#eceef0',
  },
  wccValue: { fontSize: 28, fontWeight: '800', color: '#041627', lineHeight: 32, marginBottom: 2 },
  wccLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  wccAccent: { marginTop: 8, height: 2, borderRadius: 1 },

  stepRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8,
  },
  stepNumber: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNumberText: { fontSize: 10, fontWeight: '800' },
  stepTitle: { fontSize: 12, fontWeight: '600', color: '#041627', width: 110, flexShrink: 0 },
  stepBarWrapper: { flex: 1 },
  stepBarBg: { height: 5, backgroundColor: '#e0e3e5', borderRadius: 3, overflow: 'hidden' },
  stepBarFill: { height: 5, borderRadius: 3 },
  stepPct: { fontSize: 10, fontWeight: '700', width: 36, textAlign: 'right', flexShrink: 0 },
  stepChevron: { fontSize: 9, color: '#44474c', width: 16, textAlign: 'center', flexShrink: 0 },

  stepTasksContainer: { backgroundColor: '#fafbfc', paddingHorizontal: 12, paddingVertical: 4 },
  stepTasksLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  stepTasksLoadingText: { fontSize: 12, color: '#44474c' },

  pipelineTaskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eceef0',
  },
  subtaskDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pipelineTaskTitle: { flex: 1, fontSize: 11, fontWeight: '500', color: '#041627' },
  pipelineTaskAssignee: { fontSize: 10, color: '#44474c', maxWidth: 70, flexShrink: 0 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20, flexShrink: 0 },
  badgeText: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },

  emptyText: { fontSize: 12, color: '#44474c', padding: 16, textAlign: 'center' },
})
