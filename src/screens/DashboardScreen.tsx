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
import { useNavigation } from '@react-navigation/native'
import { useAppSelector } from '../store/hooks'
import { dashboardService } from '../services/dashboardService'
import type { SuperAdminDashboard, DashboardStats, TaskTypeBreakdown } from '../types'

// ─── helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

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

// ─── Ring Progress (pure RN) ──────────────────────────────────────────────────

function RingProgress({
  value,
  size = 72,
  stroke = 7,
  color = '#006a66',
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
}) {
  const clamp = Math.min(100, Math.max(0, value))
  const deg = (clamp / 100) * 360
  const half = size / 2
  const innerSize = size - stroke * 2

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* bg track */}
      <View
        style={{
          position: 'absolute',
          width: size, height: size, borderRadius: half,
          borderWidth: stroke, borderColor: '#e0e3e5',
        }}
      />
      {/* first half 0–180 */}
      {clamp > 0 && (
        <View style={{ position: 'absolute', width: size, height: size, overflow: 'hidden',
          transform: deg <= 180 ? [{ rotate: `${deg - 180}deg` }] : [] }}>
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
      {/* second half 180–360 */}
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
      {/* inner hole */}
      <View style={{
        position: 'absolute',
        width: innerSize, height: innerSize, borderRadius: innerSize / 2,
        backgroundColor: '#fff',
      }} />
    </View>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      <View style={[styles.statAccent, { backgroundColor: accent }]} />
    </View>
  )
}

// ─── ProjectCard ──────────────────────────────────────────────────────────────

function ProjectCard({ typeKey, breakdown, onPress }: { typeKey: string; breakdown: TaskTypeBreakdown; onPress: () => void }) {
  const meta = TASK_TYPE_META[typeKey] ?? { label: typeKey, color: '#041627', bg: '#f2f4f6' }
  const subtaskPct = breakdown.totalSubtasks > 0 ? (breakdown.completedSubtasks / breakdown.totalSubtasks) * 100 : 0
  const typeEmoji = typeKey === 'CCTV_INSTALLATION' ? '📹' : typeKey === 'LIFT_INSTALLATION' ? '🛗' : '🗄️'

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.projectCard}>
      <View style={styles.projectCardHeader}>
        <View style={[styles.projectIconBadge, { backgroundColor: meta.bg }]}>
          <Text style={{ fontSize: 20 }}>{typeEmoji}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.projectCardTitle}>{meta.label}</Text>
          <Text style={styles.projectCardSub}>{breakdown.totalTasks} tasks</Text>
        </View>
        <Text style={[styles.projectCardArrow, { color: meta.color }]}>›</Text>
      </View>

      <View style={styles.projectRingRow}>
        <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
          <RingProgress value={breakdown.completionRate} size={64} stroke={6} color={meta.color} />
          <View style={styles.ringOverlay}>
            <Text style={styles.ringPct}>{breakdown.completionRate}%</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.projectStatRow}>
            <Text style={styles.projectStatLabel}>Completed</Text>
            <Text style={styles.projectStatValue}>{breakdown.completedTasks}</Text>
          </View>
          <View style={styles.projectStatRow}>
            <Text style={styles.projectStatLabel}>In Progress</Text>
            <Text style={styles.projectStatValue}>{breakdown.inProgressTasks}</Text>
          </View>
          <View style={styles.projectStatRow}>
            <Text style={styles.projectStatLabel}>Overdue</Text>
            <Text style={[styles.projectStatValue, { color: '#ba1a1a' }]}>{breakdown.overdueTasks}</Text>
          </View>
        </View>
      </View>

      <View style={{ marginBottom: 12 }}>
        <View style={styles.subtaskBarLabel}>
          <Text style={styles.subtaskBarTitle}>SUBTASKS</Text>
          <Text style={styles.subtaskBarCount}>{breakdown.completedSubtasks} / {breakdown.totalSubtasks}</Text>
        </View>
        <View style={styles.subtaskBarBg}>
          <View style={[styles.subtaskBarFill, { width: `${subtaskPct}%` as any, backgroundColor: meta.color }]} />
        </View>
      </View>

      <View style={[styles.projectCardFooter, { borderTopColor: '#eceef0' }]}>
        <Text style={styles.projectFooterText}>View detailed insights</Text>
        <Text style={[{ fontSize: 14, fontWeight: '700', color: meta.color }]}>↗</Text>
      </View>
    </TouchableOpacity>
  )
}

// ─── WccBillingCard ───────────────────────────────────────────────────────────

function WccBillingCard({ typeKey, breakdown }: { typeKey: string; breakdown: TaskTypeBreakdown }) {
  const meta = TASK_TYPE_META[typeKey] ?? { label: typeKey, color: '#041627', bg: '#f2f4f6' }
  const wb = breakdown.wccBillingStats
  if (!wb) return null

  const miniCards = [
    { label: 'WCC Pending',       value: wb.wccPending,       text: '#b45309', accent: '#fde68a' },
    { label: 'WCC Completed',     value: wb.wccCompleted,     text: '#166534', accent: '#86efac' },
    { label: 'Billing Pending',   value: wb.billingPending,   text: '#ba1a1a', accent: '#fca5a5' },
    { label: 'Billing Completed', value: wb.billingCompleted, text: '#15803d', accent: '#4ade80' },
  ]

  const highlightCards: { label: string; value: number; text: string; accent: string }[] = []
  highlightCards.push({ label: 'L1', value: wb.l1Completed ?? 0, text: '#0e7490', accent: '#67e8f9' })
  highlightCards.push({ label: 'L2', value: wb.l2Completed ?? 0, text: '#15803d', accent: '#4ade80' })
  if (wb.l3Completed != null) {
    highlightCards.push({ label: 'L3', value: wb.l3Completed, text: '#92400e', accent: '#fcd34d' })
  }

  return (
    <View style={styles.wccCard}>
      <View style={[styles.wccCardHeader, { backgroundColor: meta.bg }]}>
        <Text style={[styles.wccCardHeaderText, { color: meta.color }]}>{meta.label}</Text>
      </View>
      <View style={styles.wccGrid}>
        {miniCards.map((c, idx) => (
          <View
            key={c.label}
            style={[
              styles.wccMiniCard,
              idx === 1 && { borderLeftWidth: 1, borderLeftColor: '#eceef0' },
              idx === 2 && { borderTopWidth: 1, borderTopColor: '#eceef0' },
              idx === 3 && { borderLeftWidth: 1, borderLeftColor: '#eceef0', borderTopWidth: 1, borderTopColor: '#eceef0' },
            ]}
          >
            <Text style={styles.wccMiniValue}>{c.value}</Text>
            <Text style={[styles.wccMiniLabel, { color: c.text }]}>{c.label}</Text>
            <View style={[styles.wccMiniAccent, { backgroundColor: c.accent }]} />
          </View>
        ))}
      </View>
      {highlightCards.length > 0 && (
        <View style={[styles.wccGrid, { borderTopWidth: 1, borderTopColor: '#eceef0' }]}>
          {highlightCards.map((c, idx) => (
            <View
              key={c.label}
              style={[
                styles.wccMiniCard,
                idx > 0 && { borderLeftWidth: 1, borderLeftColor: '#eceef0' },
              ]}
            >
              <Text style={styles.wccMiniValue}>{c.value}</Text>
              <Text style={[styles.wccMiniLabel, { color: c.text }]}>{c.label}</Text>
              <View style={[styles.wccMiniAccent, { backgroundColor: c.accent }]} />
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const navigation = useNavigation<any>()
  const user = useAppSelector((s) => s.auth.user)
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const [data, setData] = useState<SuperAdminDashboard | null>(null)
  const [basicStats, setBasicStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      if (isSuperAdmin) {
        const d = await dashboardService.getSuperAdminDashboard()
        setData(d)
      } else {
        const d = await dashboardService.getStats()
        setBasicStats(d)
      }
    } catch {
      // silently show empty state
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [isSuperAdmin])

  useEffect(() => { load() }, [load])

  const onRefresh = () => { setRefreshing(true); load() }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#006a66" />
      </View>
    )
  }

  // ── Non-super-admin basic dashboard ──────────────────────────────────────
  if (!isSuperAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f9fb' }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.headerSection}>
            <Text style={styles.roleLabel}>Overview</Text>
            <Text style={styles.greeting}>{getGreeting()}, {user?.name?.split(' ')[0]}.</Text>
          </View>
          <View style={styles.kpiGrid}>
            {[
              { label: 'Total Tasks',  value: basicStats?.totalTasks ?? '—',      accent: '#041627' },
              { label: 'Completed',    value: basicStats?.completedTasks ?? '—',  accent: '#006a66' },
              { label: 'In Progress',  value: basicStats?.inProgressTasks ?? '—', accent: '#180092' },
              { label: 'Open',         value: basicStats?.openTasks ?? '—',        accent: '#e0e3e5' },
              { label: 'Overdue',      value: basicStats?.overdueTasks ?? '—',     accent: '#ba1a1a' },
              { label: 'Team Members', value: basicStats?.totalUsers ?? '—',       accent: '#7d3600' },
            ].map((c) => <StatCard key={c.label} {...c} />)}
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Super admin dashboard ─────────────────────────────────────────────────
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#006a66" />}
      >
        {/* ── Header ── */}
        <View style={styles.headerSection}>
          <Text style={styles.roleLabel}>SUPER ADMIN · OVERVIEW</Text>
          <Text style={styles.greeting}>{getGreeting()}, {user?.name?.split(' ')[0]}.</Text>
          <Text style={styles.headerDesc}>Complete operational view across all project types.</Text>
        </View>

        {/* ── Global KPIs ── */}
        <Text style={styles.sectionTitle}>GLOBAL METRICS</Text>
        <View style={styles.kpiGrid}>
          <StatCard label="Total Tasks"   value={data.totalTasks}      sub={`${data.taskCompletionRate}% done`} accent="#041627" />
          <StatCard label="Completed"     value={data.completedTasks}  sub="finished"  accent="#006a66" />
          <StatCard label="In Progress"   value={data.inProgressTasks} sub="active"    accent="#180092" />
          <StatCard label="Open"          value={data.openTasks}       sub="awaiting"  accent="#e0e3e5" />
          <StatCard label="Overdue"       value={data.overdueTasks}    sub="past due"  accent="#ba1a1a" />
          <StatCard label="Team Members"  value={data.totalUsers}      sub="users"     accent="#7d3600" />
        </View>

        {/* ── Global Subtask Health ── */}
        <View style={styles.subtaskHealthCard}>
          <View style={styles.subtaskHealthTop}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <RingProgress value={data.subtaskCompletionRate} size={88} stroke={8} color="#006a66" />
              <View style={styles.ringOverlay}>
                <Text style={[styles.ringPct, { fontSize: 16 }]}>{data.subtaskCompletionRate}%</Text>
                <Text style={styles.ringDoneLabel}>DONE</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subtaskHealthSectionLabel}>GLOBAL SUBTASK COMPLETION</Text>
              <Text>
                <Text style={styles.subtaskHealthCountBig}>{data.completedSubtasks}</Text>
                <Text style={styles.subtaskHealthCountSmall}> / {data.totalSubtasks} subtasks</Text>
              </Text>
              <Text style={styles.subtaskHealthPending}>
                {data.totalSubtasks - data.completedSubtasks} subtasks still pending
              </Text>
            </View>
          </View>
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

        {/* ── Project Type Breakdown ── */}
        <Text style={styles.sectionTitle}>PROJECT TYPE BREAKDOWN</Text>
        {Object.entries(data.taskTypeBreakdown).map(([typeKey, breakdown]) => (
          <ProjectCard
            key={typeKey}
            typeKey={typeKey}
            breakdown={breakdown}
            onPress={() => navigation.getParent()?.navigate('TaskTypeDashboard', { typeKey })}
          />
        ))}

        {/* ── WCC & Billing Status ── */}
        <Text style={styles.sectionTitle}>WCC & BILLING STATUS</Text>
        <Text style={styles.sectionDesc}>Per project type</Text>
        {Object.entries(data.taskTypeBreakdown).map(([typeKey, breakdown]) => (
          <WccBillingCard key={typeKey} typeKey={typeKey} breakdown={breakdown} />
        ))}

        {/* ── Top Subtask Performers ── */}
        {data.topOwners.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>TOP SUBTASK PERFORMERS</Text>
            <View style={styles.performersCard}>
              <View style={styles.performerHeaderRow}>
                <Text style={[styles.performerHeaderCell, { width: 28 }]}>#</Text>
                <Text style={[styles.performerHeaderCell, { flex: 1 }]}>OWNER</Text>
                <Text style={[styles.performerHeaderCell, { width: 38, textAlign: 'center' }]}>TOT</Text>
                <Text style={[styles.performerHeaderCell, { width: 38, textAlign: 'center' }]}>DONE</Text>
                <Text style={[styles.performerHeaderCell, { width: 42, textAlign: 'center' }]}>PEND</Text>
                <Text style={[styles.performerHeaderCell, { width: 76 }]}>PROGRESS</Text>
              </View>
              {data.topOwners.map((owner, i) => (
                <View key={owner.ownerId} style={[styles.performerRow, i === data.topOwners.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={[styles.performerRank, { width: 28 }]}>{i + 1}</Text>
                  <View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                    <View style={styles.ownerAvatar}>
                      <Text style={styles.ownerAvatarText}>{owner.ownerName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.ownerName} numberOfLines={1}>{owner.ownerName}</Text>
                  </View>
                  <Text style={[styles.performerStat, { width: 38, color: '#041627' }]}>{owner.totalSubtasks}</Text>
                  <Text style={[styles.performerStat, { width: 38, color: '#006a66' }]}>{owner.completedSubtasks}</Text>
                  <Text style={[styles.performerStat, { width: 42, color: '#44474c' }]}>{owner.pendingSubtasks}</Text>
                  <View style={{ width: 76, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <View style={styles.performerBarBg}>
                      <View style={[styles.performerBarFill, { width: `${owner.completionRate}%` as any }]} />
                    </View>
                    <Text style={styles.performerPct}>{owner.completionRate}%</Text>
                  </View>
                </View>
              ))}
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

  headerSection: { marginBottom: 20 },
  roleLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: '#006a66', marginBottom: 4, textTransform: 'uppercase' },
  greeting: { fontSize: 26, fontWeight: '800', color: '#041627', letterSpacing: -0.5 },
  headerDesc: { fontSize: 13, color: '#44474c', marginTop: 2 },

  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: '#44474c', textTransform: 'uppercase', marginBottom: 10, marginTop: 8 },
  sectionDesc: { fontSize: 11, color: '#44474c', marginTop: -8, marginBottom: 10 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#041627',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eceef0',
  },
  statLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: '#44474c', textTransform: 'uppercase', marginBottom: 6 },
  statValue: { fontSize: 30, fontWeight: '800', color: '#041627', lineHeight: 34 },
  statSub: { fontSize: 11, color: '#44474c', marginTop: 2 },
  statAccent: { marginTop: 10, height: 3, borderRadius: 2 },

  subtaskHealthCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#041627',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eceef0',
  },
  subtaskHealthTop: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  subtaskHealthSectionLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: '#44474c', textTransform: 'uppercase', marginBottom: 4 },
  subtaskHealthCountBig: { fontSize: 22, fontWeight: '800', color: '#041627' },
  subtaskHealthCountSmall: { fontSize: 13, fontWeight: '600', color: '#44474c' },
  subtaskHealthPending: { fontSize: 11, color: '#44474c', marginTop: 2 },

  ringOverlay: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontSize: 13, fontWeight: '800', color: '#041627', lineHeight: 16 },
  ringDoneLabel: { fontSize: 7, fontWeight: '700', color: '#44474c', letterSpacing: 0.5 },

  priorityChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  priorityChip: { flex: 1, minWidth: 60, borderRadius: 10, padding: 8, alignItems: 'center' },
  priorityChipLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  priorityChipValue: { fontSize: 20, fontWeight: '800' },

  projectCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#041627',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eceef0',
  },
  projectCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  projectIconBadge: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  projectCardTitle: { fontSize: 14, fontWeight: '700', color: '#041627', lineHeight: 18 },
  projectCardSub: { fontSize: 10, color: '#44474c', textTransform: 'uppercase', letterSpacing: 0.5 },
  projectCardArrow: { fontSize: 24, fontWeight: '300' },
  projectRingRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 },
  projectStatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  projectStatLabel: { fontSize: 11, color: '#44474c' },
  projectStatValue: { fontSize: 11, fontWeight: '700', color: '#041627' },
  subtaskBarLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  subtaskBarTitle: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: '#44474c', textTransform: 'uppercase' },
  subtaskBarCount: { fontSize: 9, color: '#44474c' },
  subtaskBarBg: { height: 5, backgroundColor: '#e0e3e5', borderRadius: 3, overflow: 'hidden' },
  subtaskBarFill: { height: 5, borderRadius: 3 },
  projectCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1 },
  projectFooterText: { fontSize: 9, fontWeight: '700', letterSpacing: 1, color: '#44474c', textTransform: 'uppercase' },

  wccCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#041627',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eceef0',
    overflow: 'hidden',
  },
  wccCardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  wccCardHeaderText: { fontSize: 13, fontWeight: '700' },
  wccGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  wccMiniCard: { width: '50%', padding: 14 },
  wccMiniValue: { fontSize: 24, fontWeight: '800', color: '#041627', lineHeight: 28 },
  wccMiniLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 },
  wccMiniAccent: { marginTop: 6, height: 2, borderRadius: 1, width: '100%' },

  performersCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#041627',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eceef0',
    overflow: 'hidden',
  },
  performerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f7f9fb',
    borderBottomWidth: 1,
    borderBottomColor: '#eceef0',
  },
  performerHeaderCell: { fontSize: 8, fontWeight: '700', letterSpacing: 1, color: '#44474c', textTransform: 'uppercase' },
  performerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eceef0',
  },
  performerRank: { fontSize: 11, fontWeight: '700', color: '#44474c' },
  ownerAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#041627', alignItems: 'center', justifyContent: 'center' },
  ownerAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  ownerName: { fontSize: 11, fontWeight: '600', color: '#041627', flexShrink: 1 },
  performerStat: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  performerBarBg: { flex: 1, height: 6, backgroundColor: '#e0e3e5', borderRadius: 3, overflow: 'hidden' },
  performerBarFill: { height: 6, backgroundColor: '#006a66', borderRadius: 3 },
  performerPct: { fontSize: 9, fontWeight: '700', color: '#041627', width: 30, textAlign: 'right' },
})
