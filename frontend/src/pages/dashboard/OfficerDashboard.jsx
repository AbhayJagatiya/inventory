import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Package, AlertTriangle, CheckCircle2, TrendingDown,
  RefreshCw, ClipboardCheck, ArrowRight, ShieldAlert,
  Search, FileText, ArrowUpRight
} from 'lucide-react'
import { getDashboardOfficer, getDashboardAlertsSummary } from '../../api/dashboard.api'
import PageHeader from '../../components/layout/PageHeader'
import ErrorState from '../../components/feedback/ErrorState'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import StatusBadge from '../../components/common/StatusBadge'
import { formatNumber, formatCurrency, formatDateTime } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'
import { motion } from 'framer-motion'

function KPICard({ title, value, subtitle, icon: Icon, color = 'teal', loading }) {
  const colorMap = {
    teal: {
      bg: 'bg-forest-500/10 text-forest-600 dark:text-forest-300 border-forest-500/20',
      val: 'text-forest-900 dark:text-forest-100',
    },
    amber: {
      bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20',
      val: 'text-amber-800 dark:text-amber-200',
    },
    blue: {
      bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/20',
      val: 'text-sky-800 dark:text-sky-200',
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
        <div className="h-8 bg-forest-500/10 dark:bg-forest-300/10 rounded w-20 mb-2" />
        <div className="h-3 bg-forest-500/10 dark:bg-forest-300/10 rounded w-28" />
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

function OfficerDashboard() {
  const { user, officeName } = useAuth()
  const { isDark } = useTheme()

  const {
    data: dashData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'officer'],
    queryFn: getDashboardOfficer,
    select: (res) => res?.data || res,
  })

  const { data: alertsData } = useQuery({
    queryKey: ['dashboard', 'alerts-summary'],
    queryFn: getDashboardAlertsSummary,
    select: (res) => res?.data || res,
  })

  const statusDistribution = dashData?.status_distribution
    ? Object.entries(dashData.status_distribution).map(([status, count]) => ({
        status: status.replace(/_/g, ' '),
        count,
      }))
    : []

  const barColor = isDark ? '#55C9A3' : '#087B61'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <PageHeader
        title="Store Officer Supervisory Center"
        subtitle={`Inventory Custody & Supervisory Review · Office: ${officeName || 'Veraval Office'}`}
        actions={
          <div className="flex items-center gap-2.5">
            <Link to={ROUTES.BARCODE_LOOKUP}>
              <Button variant="secondary" size="sm" leftIcon={<Search size={14} />}>
                Barcode Scanner
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              onClick={() => refetch()}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {isError && (
        <ErrorState
          message={error?.response?.data?.error?.message || 'Failed to load officer dashboard metrics.'}
          onRetry={refetch}
        />
      )}

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Office Stock Items"
          value={formatNumber(dashData?.total_office_items ?? '—')}
          subtitle="Assigned to this store"
          icon={Package}
          color="teal"
          loading={isLoading}
        />
        <KPICard
          title="Pending Condemnations"
          value={formatNumber(dashData?.pending_condemnations ?? '—')}
          subtitle="Awaiting sanction review"
          icon={TrendingDown}
          color="amber"
          loading={isLoading}
        />
        <KPICard
          title="Active Transfers"
          value={formatNumber(dashData?.pending_transfers ?? '—')}
          subtitle="Inter-office transit & approval"
          icon={ClipboardCheck}
          color="blue"
          loading={isLoading}
        />
        <KPICard
          title="Audit Discrepancies"
          value={formatNumber(dashData?.verification_discrepancies ?? '—')}
          subtitle="Physical vs book count flags"
          icon={ShieldAlert}
          color="red"
          loading={isLoading}
        />
      </div>

      {/* Main Grid: Status Distribution & Action Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution Chart */}
        <GlassCard level={1} className="lg:col-span-2 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50">
                Operational Status Distribution
              </h2>
              <p className="text-xs text-forest-600 dark:text-forest-400 mt-0.5">
                Breakdown of items in store custody
              </p>
            </div>
            <Link
              to={ROUTES.INVENTORY}
              className="text-xs font-semibold text-forest-600 dark:text-forest-300 hover:underline flex items-center gap-1"
            >
              View Register <ArrowRight size={13} />
            </Link>
          </div>

          {isLoading ? (
            <div className="h-56 bg-forest-500/5 dark:bg-forest-300/5 rounded-2xl animate-pulse" />
          ) : statusDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={statusDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#163C32' : '#E1EFEA'} />
                <XAxis dataKey="status" tick={{ fontSize: 11, fill: isDark ? '#A4B8AF' : '#667A75' }} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: isDark ? '#A4B8AF' : '#667A75' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#192A26' : '#FFFFFF',
                    borderColor: isDark ? '#163C32' : '#BCEBDD',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  }}
                  formatter={(value) => [formatNumber(value), 'Items']}
                />
                <Bar dataKey="count" fill={barColor} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex items-center justify-center text-sm text-forest-400">
              No status distribution indexed
            </div>
          )}
        </GlassCard>

        {/* Quick Actions & Supervisory Focus */}
        <GlassCard level={1} className="p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50 mb-3">
              Supervisory Quick Actions
            </h2>
            <div className="space-y-2.5">
              <Link
                to={ROUTES.CONDEMNATIONS}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10 hover:border-forest-500/30 hover:bg-forest-500/10 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded-lg">
                    <TrendingDown size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-forest-950 dark:text-forest-50">Condemnation Proposals</p>
                    <p className="text-[11px] text-forest-600 dark:text-forest-400">Review items for disposal</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-forest-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                to={ROUTES.VERIFICATION_SESSIONS}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10 hover:border-forest-500/30 hover:bg-forest-500/10 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-forest-500/15 text-forest-700 dark:text-forest-300 rounded-lg">
                    <ClipboardCheck size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-forest-950 dark:text-forest-50">Physical Stock Verification</p>
                    <p className="text-[11px] text-forest-600 dark:text-forest-400">Conduct annual audit sessions</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-forest-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                to={ROUTES.DEAD_STOCK_REGISTER}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10 hover:border-forest-500/30 hover:bg-forest-500/10 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-500/15 text-slate-700 dark:text-slate-300 rounded-lg">
                    <Package size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-forest-950 dark:text-forest-50">Dead Stock Register</p>
                    <p className="text-[11px] text-forest-600 dark:text-forest-400">Non-moving & obsolete stock</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-forest-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                to={ROUTES.REPORTS}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10 hover:border-forest-500/30 hover:bg-forest-500/10 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded-lg">
                    <FileText size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-forest-950 dark:text-forest-50">Department Reports</p>
                    <p className="text-[11px] text-forest-600 dark:text-forest-400">Registers, movements & valuation</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-forest-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-forest-500/10 dark:border-forest-400/10 flex items-center justify-between text-xs text-forest-600 dark:text-forest-400">
            <span>Critical alerts active:</span>
            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
              {alertsData?.critical_count ?? 0}
            </span>
          </div>
        </GlassCard>
      </div>

      {/* Recent Movements within Office */}
      <GlassCard level={1} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-forest-500/10 dark:border-forest-300/10 flex items-center justify-between">
          <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50">
            Recent Movements & Ledger Postings
          </h2>
          <Link to={ROUTES.TRANSACTIONS} className="text-xs font-semibold text-forest-600 dark:text-forest-300 hover:underline">
            View All Ledger Entries
          </Link>
        </div>

        {dashData?.recent_movements?.length > 0 ? (
          <div className="divide-y divide-forest-500/5 dark:divide-forest-300/5">
            {dashData.recent_movements.map((tx, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between hover:bg-forest-500/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-forest-500/10 border border-forest-500/15 flex items-center justify-center text-xs font-bold text-forest-700 dark:text-forest-300">
                    {tx.transaction_type?.substring(0, 2) || 'TX'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-forest-950 dark:text-forest-50 font-mono">
                      {tx.reference_number || tx.voucher_number || 'Transaction'}
                    </p>
                    <p className="text-xs text-forest-600 dark:text-forest-400">
                      {tx.item_name} · Qty: <span className="font-bold">{tx.quantity}</span> · {formatDateTime(tx.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={tx.status} />
                  <span className="text-xs text-forest-500 hidden sm:inline">{tx.created_by_name}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-xs text-forest-400">
            No recent store movements recorded
          </div>
        )}
      </GlassCard>
    </motion.div>
  )
}

export default OfficerDashboard
