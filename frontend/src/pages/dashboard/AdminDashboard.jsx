import { useQuery } from '@tanstack/react-query'
import {
  Package, AlertTriangle, CheckCircle2, TrendingDown,
  Building2, RefreshCw, ClipboardCheck, ArrowUpRight, ShieldCheck,
  Activity, Clock, Layers
} from 'lucide-react'
import { getDashboardAdmin, getDashboardAlertsSummary } from '../../api/dashboard.api'
import { runClassificationEngine } from '../../api/disposal.api'
import PageHeader from '../../components/layout/PageHeader'
import ErrorState from '../../components/feedback/ErrorState'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import { formatCurrency, formatNumber, formatDateTime } from '../../utils/formatters'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import toast from 'react-hot-toast'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'
import { motion } from 'framer-motion'

const THEME_PIE_COLORS = {
  light: ['#087B61', '#10b981', '#f59e0b', '#ef4444'],
  dark:  ['#55C9A3', '#34d399', '#fbbf24', '#f87171'],
}

function KPICard({ title, value, subtitle, icon: Icon, color = 'teal', loading }) {
  const colorMap = {
    teal: {
      bg: 'bg-forest-500/10 text-forest-600 dark:text-forest-300 border-forest-500/20',
      val: 'text-forest-900 dark:text-forest-100',
    },
    green: {
      bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
      val: 'text-emerald-800 dark:text-emerald-200',
    },
    amber: {
      bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20',
      val: 'text-amber-800 dark:text-amber-200',
    },
    red: {
      bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/20',
      val: 'text-rose-800 dark:text-rose-200',
    },
  }
  const c = colorMap[color] || colorMap.teal

  if (loading) {
    return (
      <GlassCard level={1} className="p-5 animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-forest-500/10 dark:bg-forest-300/10 rounded w-28" />
          <div className="h-9 w-9 bg-forest-500/10 dark:bg-forest-300/10 rounded-xl" />
        </div>
        <div className="h-8 bg-forest-500/10 dark:bg-forest-300/10 rounded w-24 mb-2" />
        <div className="h-3 bg-forest-500/10 dark:bg-forest-300/10 rounded w-32" />
      </GlassCard>
    )
  }

  return (
    <GlassCard
      level={1}
      tilt={true}
      cursorLight={true}
      className="p-5 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-600/90 dark:text-forest-300/80">
            {title}
          </p>
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${c.bg}`}>
            <Icon size={19} />
          </div>
        </div>
        <div className={`text-2xl sm:text-3xl font-extrabold ${c.val} tracking-tight mb-1`}>
          {value}
        </div>
      </div>
      {subtitle && (
        <p className="text-xs text-forest-600 dark:text-forest-400 font-medium mt-2">
          {subtitle}
        </p>
      )}
    </GlassCard>
  )
}

function AdminDashboard() {
  const { user } = useAuth()
  const { isDark } = useTheme()

  const {
    data: dashData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: getDashboardAdmin,
    select: (res) => res?.data || res,
  })

  const { data: alertsData } = useQuery({
    queryKey: ['dashboard', 'alerts-summary'],
    queryFn: getDashboardAlertsSummary,
    select: (res) => res?.data || res,
  })

  const handleRunClassification = async () => {
    try {
      await runClassificationEngine({ office_id: user?.office?.id })
      toast.success('Classification engine executed successfully')
      refetch()
    } catch {
      toast.error('Failed to trigger classification engine')
    }
  }

  const classificationChartData = dashData?.classification_breakdown
    ? Object.entries(dashData.classification_breakdown).map(([name, value]) => ({ name, value }))
    : []

  const pieColors = isDark ? THEME_PIE_COLORS.dark : THEME_PIE_COLORS.light

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <PageHeader
        title="District Executive Dashboard"
        subtitle={`System Administration & Inventory Governance · Gir Somnath · ${formatDateTime(new Date().toISOString())}`}
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw size={14} />}
            onClick={() => refetch()}
          >
            Refresh Data
          </Button>
        }
      />

      {/* Demo notice pill */}
      <div className="p-3.5 rounded-2xl bg-forest-500/10 dark:bg-forest-950/60 border border-forest-500/20 text-xs text-forest-800 dark:text-forest-200 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-forest-600 dark:text-forest-400 shrink-0" />
          <span>
            <strong>System Status:</strong> PS000214 Dead Stock Management Core is active. All metrics sync with PostgreSQL schema.
          </span>
        </div>
        <span className="hidden sm:inline font-mono text-[11px] bg-white/40 dark:bg-forest-800/60 px-2 py-0.5 rounded-lg border border-forest-500/10">
          OFF-GS-VRV-001
        </span>
      </div>

      {isError && (
        <ErrorState
          message={error?.response?.data?.error?.message || 'Failed to load executive dashboard data.'}
          onRetry={refetch}
        />
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Registered Assets"
          value={formatNumber(dashData?.total_items ?? '—')}
          subtitle="All durable & consumable records"
          icon={Package}
          color="teal"
          loading={isLoading}
        />
        <KPICard
          title="Active Inventory Valuation"
          value={dashData?.active_inventory_value != null ? formatCurrency(dashData.active_inventory_value) : '—'}
          subtitle="Based on acquisition costs"
          icon={CheckCircle2}
          color="green"
          loading={isLoading}
        />
        <KPICard
          title="Dead Stock Volume"
          value={formatNumber(dashData?.dead_stock_count ?? '—')}
          subtitle={dashData?.dead_stock_value != null ? `Value: ${formatCurrency(dashData.dead_stock_value)}` : 'Non-moving & Obsolete pool'}
          icon={TrendingDown}
          color="amber"
          loading={isLoading}
        />
        <KPICard
          title="Pending Approvals"
          value={formatNumber(dashData?.pending_approvals ?? '—')}
          subtitle="Awaiting administrative sign-off"
          icon={ClipboardCheck}
          color="red"
          loading={isLoading}
        />
      </div>

      {/* Main Charts & Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Classification Breakdown Chart */}
        <GlassCard level={1} className="lg:col-span-2 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50 flex items-center gap-2">
                <Activity size={16} className="text-forest-600 dark:text-forest-400" />
                Asset Lifecycle Classification
              </h2>
              <p className="text-xs text-forest-600 dark:text-forest-400 mt-0.5">
                Distribution across Active, Slow-Moving, Non-Moving, and Obsolete stock
              </p>
            </div>
            <Button variant="secondary" size="xs" onClick={handleRunClassification}>
              Run Engine
            </Button>
          </div>

          {isLoading ? (
            <div className="h-56 bg-forest-500/5 dark:bg-forest-300/5 rounded-2xl animate-pulse" />
          ) : classificationChartData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-full sm:w-1/2 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={classificationChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {classificationChartData.map((_, i) => (
                        <Cell key={i} fill={pieColors[i % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#192A26' : '#FFFFFF',
                        borderColor: isDark ? '#163C32' : '#BCEBDD',
                        borderRadius: '12px',
                        fontSize: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend List */}
              <div className="w-full sm:w-1/2 space-y-2.5">
                {classificationChartData.map((item, idx) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-2 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: pieColors[idx % pieColors.length] }}
                      />
                      <span className="font-medium text-forest-900 dark:text-forest-100 capitalize">
                        {item.name.toLowerCase().replace('_', ' ')}
                      </span>
                    </div>
                    <span className="font-bold text-forest-950 dark:text-forest-50 font-mono">
                      {formatNumber(item.value)} items
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-sm text-forest-400">
              No classification data currently indexed
            </div>
          )}
        </GlassCard>

        {/* Alerts & Critical Queue */}
        <GlassCard level={1} className="p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50 mb-1 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              Exception & Alert Registry
            </h2>
            <p className="text-xs text-forest-600 dark:text-forest-400 mb-4">
              Real-time discrepancy triggers
            </p>

            {alertsData ? (
              <div className="space-y-2.5">
                {Object.entries(alertsData?.by_type || {}).map(([type, count]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10"
                  >
                    <span className="text-xs text-forest-700 dark:text-forest-200 capitalize font-medium">
                      {type.toLowerCase().replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-extrabold text-forest-900 dark:text-forest-100 font-mono px-2 py-0.5 rounded-lg bg-white/60 dark:bg-forest-800/60 border border-forest-500/10">
                      {count}
                    </span>
                  </div>
                ))}
                {(!alertsData?.by_type || Object.keys(alertsData.by_type).length === 0) && (
                  <p className="text-xs text-forest-500 py-6 text-center">
                    All store audits and threshold monitors are healthy.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-9 bg-forest-500/10 rounded-xl animate-pulse" />
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Recent Audit Ledger Events */}
      {dashData?.recent_audit_events?.length > 0 && (
        <GlassCard level={1} className="overflow-hidden">
          <div className="px-6 py-4 border-b border-forest-500/10 dark:border-forest-300/10 flex items-center justify-between">
            <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50 flex items-center gap-2">
              <Clock size={16} className="text-forest-600 dark:text-forest-400" />
              Recent Audit Log Operations
            </h2>
            <span className="text-xs text-forest-500">Immutable trail</span>
          </div>
          <div className="divide-y divide-forest-500/5 dark:divide-forest-300/5">
            {dashData.recent_audit_events.map((event, i) => (
              <div key={i} className="px-6 py-3.5 flex items-start gap-3 hover:bg-forest-500/5 transition-colors">
                <div className="w-2 h-2 rounded-full bg-forest-500 mt-2 shrink-0 ring-4 ring-forest-500/10" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-forest-900 dark:text-forest-100 truncate">
                    {event.description || event.action}
                  </p>
                  <p className="text-[11px] text-forest-500 dark:text-forest-400 mt-0.5">
                    {formatDateTime(event.created_at)} · Operator: <span className="font-medium text-forest-700 dark:text-forest-300">{event.actor_name}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </motion.div>
  )
}

export default AdminDashboard
