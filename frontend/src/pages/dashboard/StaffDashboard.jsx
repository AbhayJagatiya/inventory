import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Package, ArrowDownLeft, ArrowUpRight, RotateCcw,
  QrCode, PlusCircle, AlertCircle, RefreshCw, ArrowRight,
  TrendingDown, CheckCircle
} from 'lucide-react'
import { getDashboardStaff } from '../../api/dashboard.api'
import PageHeader from '../../components/layout/PageHeader'
import ErrorState from '../../components/feedback/ErrorState'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import StatusBadge from '../../components/common/StatusBadge'
import { formatNumber, formatDateTime } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { motion } from 'framer-motion'

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
    purple: {
      bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20',
      val: 'text-purple-800 dark:text-purple-200',
    },
  }
  const c = colorMap[color] || colorMap.teal

  if (loading) {
    return (
      <GlassCard level={1} className="p-5 animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-forest-500/10 dark:bg-forest-300/10 rounded w-24" />
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

function StaffDashboard() {
  const { user, officeName } = useAuth()

  const {
    data: dashData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'staff'],
    queryFn: getDashboardStaff,
    select: (res) => res?.data || res,
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <PageHeader
        title="Store Staff Daily Operations"
        subtitle={`Receipts, Issues & Inventory Handover · Office: ${officeName || 'Veraval Office'}`}
        actions={
          <div className="flex items-center gap-2.5">
            <Link to={ROUTES.BARCODE_LOOKUP}>
              <Button variant="secondary" size="sm" leftIcon={<QrCode size={14} />}>
                Scan Barcode
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
          message={error?.response?.data?.error?.message || 'Failed to load staff operational metrics.'}
          onRetry={refetch}
        />
      )}

      {/* Operational KPI Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Available Store Stock"
          value={formatNumber(dashData?.available_stock_count ?? '—')}
          subtitle="Ready for issue"
          icon={Package}
          color="green"
          loading={isLoading}
        />
        <KPICard
          title="Today's Receipts"
          value={formatNumber(dashData?.my_receipts_today ?? '—')}
          subtitle="Inward entries logged"
          icon={ArrowDownLeft}
          color="teal"
          loading={isLoading}
        />
        <KPICard
          title="Today's Issues"
          value={formatNumber(dashData?.my_issues_today ?? '—')}
          subtitle="Dispatched to departments"
          icon={ArrowUpRight}
          color="purple"
          loading={isLoading}
        />
        <KPICard
          title="Pending Queue"
          value={formatNumber(dashData?.tasks_pending_action ?? '—')}
          subtitle="Draft vouchers & returns"
          icon={AlertCircle}
          color="amber"
          loading={isLoading}
        />
      </div>

      {/* Quick Action Matrix */}
      <GlassCard level={1} className="p-6">
        <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50 mb-4">
          Quick Operational Handover Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            to={ROUTES.INVENTORY_NEW}
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10 hover:border-forest-500/30 hover:bg-forest-500/10 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-forest-500/15 text-forest-700 dark:text-forest-300 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
              <PlusCircle size={20} />
            </div>
            <span className="text-xs font-bold text-forest-950 dark:text-forest-50">New Item</span>
            <span className="text-[10px] text-forest-600 dark:text-forest-400 mt-0.5">Asset or Stock</span>
          </Link>

          <Link
            to={ROUTES.RECEIPTS_NEW}
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10 hover:border-forest-500/30 hover:bg-forest-500/10 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
              <ArrowDownLeft size={20} />
            </div>
            <span className="text-xs font-bold text-forest-950 dark:text-forest-50">Inward Receipt</span>
            <span className="text-[10px] text-forest-600 dark:text-forest-400 mt-0.5">Receive delivery</span>
          </Link>

          <Link
            to={ROUTES.ISSUES_NEW}
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10 hover:border-forest-500/30 hover:bg-forest-500/10 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-700 dark:text-purple-300 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
              <ArrowUpRight size={20} />
            </div>
            <span className="text-xs font-bold text-forest-950 dark:text-forest-50">Stock Issue</span>
            <span className="text-[10px] text-forest-600 dark:text-forest-400 mt-0.5">To branch / officer</span>
          </Link>

          <Link
            to={ROUTES.RETURNS_NEW}
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10 hover:border-forest-500/30 hover:bg-forest-500/10 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
              <RotateCcw size={20} />
            </div>
            <span className="text-xs font-bold text-forest-950 dark:text-forest-50">Stock Return</span>
            <span className="text-[10px] text-forest-600 dark:text-forest-400 mt-0.5">Department return</span>
          </Link>

          <Link
            to={ROUTES.BARCODE_LOOKUP}
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10 hover:border-forest-500/30 hover:bg-forest-500/10 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-500/15 text-slate-700 dark:text-slate-300 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
              <QrCode size={20} />
            </div>
            <span className="text-xs font-bold text-forest-950 dark:text-forest-50">Scan Code</span>
            <span className="text-[10px] text-forest-600 dark:text-forest-400 mt-0.5">Lookup serial</span>
          </Link>

          <Link
            to={ROUTES.CONDEMNATIONS}
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10 hover:border-forest-500/30 hover:bg-forest-500/10 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-700 dark:text-rose-300 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
              <TrendingDown size={20} />
            </div>
            <span className="text-xs font-bold text-forest-950 dark:text-forest-50">Condemnation</span>
            <span className="text-[10px] text-forest-600 dark:text-forest-400 mt-0.5">Submit proposal</span>
          </Link>
        </div>
      </GlassCard>

      {/* Operational Tasks & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions Created by User */}
        <GlassCard level={1} className="overflow-hidden">
          <div className="px-6 py-4 border-b border-forest-500/10 dark:border-forest-300/10 flex items-center justify-between">
            <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50">
              My Recent Handled Transactions
            </h2>
            <Link to={ROUTES.TRANSACTIONS} className="text-xs font-semibold text-forest-600 dark:text-forest-300 hover:underline">
              View All
            </Link>
          </div>

          {dashData?.my_recent_transactions?.length > 0 ? (
            <div className="divide-y divide-forest-500/5 dark:divide-forest-300/5">
              {dashData.my_recent_transactions.map((tx, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between hover:bg-forest-500/5 transition-colors">
                  <div>
                    <p className="text-xs font-bold text-forest-950 dark:text-forest-50 font-mono">
                      {tx.voucher_number || tx.reference_number}
                    </p>
                    <p className="text-xs text-forest-600 dark:text-forest-400 mt-0.5">
                      {tx.type} · {tx.item_count || 1} items · {formatDateTime(tx.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={tx.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-forest-400">
              No recent transactions recorded today
            </div>
          )}
        </GlassCard>

        {/* Operational Tasks Requiring Attention */}
        <GlassCard level={1} className="overflow-hidden">
          <div className="px-6 py-4 border-b border-forest-500/10 dark:border-forest-300/10 flex items-center justify-between">
            <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50">
              Operational Task Queue
            </h2>
            <span className="text-xs text-forest-500 font-medium">Pending store tasks</span>
          </div>

          <div className="p-4 space-y-3">
            {dashData?.action_queue?.length > 0 ? (
              dashData.action_queue.map((task, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10"
                >
                  <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-forest-950 dark:text-forest-50">{task.title}</p>
                    <p className="text-[11px] text-forest-600 dark:text-forest-400 mt-0.5">{task.description}</p>
                  </div>
                  {task.action_url && (
                    <Link
                      to={task.action_url}
                      className="text-xs font-semibold text-forest-600 dark:text-forest-300 hover:underline shrink-0"
                    >
                      Open
                    </Link>
                  )}
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-xs text-forest-400 flex flex-col items-center justify-center">
                <CheckCircle size={24} className="text-emerald-500 mb-1" />
                <span>All daily store tasks are completed!</span>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </motion.div>
  )
}

export default StaffDashboard
