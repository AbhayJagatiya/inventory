import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Package, ArrowDownLeft, ArrowUpRight, RotateCcw,
  QrCode, PlusCircle, AlertCircle, RefreshCw, ArrowRight,
  TrendingDown
} from 'lucide-react'
import { getDashboardStaff } from '../../api/dashboard.api'
import PageHeader from '../../components/layout/PageHeader'
import ErrorState from '../../components/feedback/ErrorState'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { formatNumber, formatDateTime } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'

function KPICard({ title, value, subtitle, icon: Icon, color = 'blue', loading }) {
  const colorMap = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: 'text-blue-500' },
    green:  { bg: 'bg-green-50',  text: 'text-green-700',  icon: 'text-green-500' },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  icon: 'text-amber-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-500' },
  }
  const c = colorMap[color] || colorMap.blue

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-5 animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-slate-200 rounded w-24" />
          <div className="h-9 w-9 bg-slate-200 rounded-lg" />
        </div>
        <div className="h-8 bg-slate-200 rounded w-16 mb-2" />
        <div className="h-3 bg-slate-100 rounded w-20" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon size={18} className={c.icon} />
        </div>
      </div>
      <div className={`text-2xl font-bold ${c.text} mb-1`}>{value}</div>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
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
    <div className="space-y-6">
      <PageHeader
        title="Store Staff Operations Dashboard"
        subtitle={`Daily Store Operations · Assigned Office: ${officeName || 'Veraval Office'}`}
        actions={
          <div className="flex items-center gap-2">
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

      {/* Operational Counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Available Stock Items"
          value={formatNumber(dashData?.available_stock_count ?? '—')}
          subtitle="Ready for issue"
          icon={Package}
          color="green"
          loading={isLoading}
        />
        <KPICard
          title="My Inward Receipts"
          value={formatNumber(dashData?.my_receipts_today ?? '—')}
          subtitle="Entered today"
          icon={ArrowDownLeft}
          color="blue"
          loading={isLoading}
        />
        <KPICard
          title="My Stock Issues"
          value={formatNumber(dashData?.my_issues_today ?? '—')}
          subtitle="Dispatched today"
          icon={ArrowUpRight}
          color="purple"
          loading={isLoading}
        />
        <KPICard
          title="Pending Action"
          value={formatNumber(dashData?.tasks_pending_action ?? '—')}
          subtitle="Drafts & pending returns"
          icon={AlertCircle}
          color="amber"
          loading={isLoading}
        />
      </div>

      {/* Quick Action Matrix */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Quick Store Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            to={ROUTES.INVENTORY_NEW}
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <PlusCircle size={20} />
            </div>
            <span className="text-xs font-semibold text-slate-800">New Item</span>
            <span className="text-[10px] text-slate-500 mt-0.5">Asset or Stock</span>
          </Link>

          <Link
            to={ROUTES.RECEIPTS_NEW}
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <ArrowDownLeft size={20} />
            </div>
            <span className="text-xs font-semibold text-slate-800">Inward Receipt</span>
            <span className="text-[10px] text-slate-500 mt-0.5">Receive delivery</span>
          </Link>

          <Link
            to={ROUTES.ISSUES_NEW}
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <ArrowUpRight size={20} />
            </div>
            <span className="text-xs font-semibold text-slate-800">Stock Issue</span>
            <span className="text-[10px] text-slate-500 mt-0.5">To branch/staff</span>
          </Link>

          <Link
            to={ROUTES.RETURNS_NEW}
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <RotateCcw size={20} />
            </div>
            <span className="text-xs font-semibold text-slate-800">Stock Return</span>
            <span className="text-[10px] text-slate-500 mt-0.5">Linked return</span>
          </Link>

          <Link
            to={ROUTES.BARCODE_LOOKUP}
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <QrCode size={20} />
            </div>
            <span className="text-xs font-semibold text-slate-800">Scan Code</span>
            <span className="text-[10px] text-slate-500 mt-0.5">Instant identity</span>
          </Link>

          <Link
            to={ROUTES.CONDEMNATIONS}
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-center transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <TrendingDown size={20} />
            </div>
            <span className="text-xs font-semibold text-slate-800">Condemnation</span>
            <span className="text-[10px] text-slate-500 mt-0.5">Submit proposal</span>
          </Link>
        </div>
      </div>

      {/* Operational Tasks & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions Created by User */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">My Recent Transactions</h2>
            <Link to={ROUTES.RECEIPTS} className="text-xs font-medium text-blue-700 hover:underline">
              View All
            </Link>
          </div>

          {dashData?.my_recent_transactions?.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {dashData.my_recent_transactions.map((tx, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{tx.voucher_number || tx.reference_number}</p>
                    <p className="text-xs text-slate-500">
                      {tx.type} · {tx.item_count || 1} items · {formatDateTime(tx.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={tx.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-400">
              No recent transactions recorded today
            </div>
          )}
        </div>

        {/* Operational Tasks Requiring Attention */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Action Queue</h2>
            <span className="text-xs text-slate-500 font-medium">Pending operational tasks</span>
          </div>

          <div className="p-4 space-y-3">
            {dashData?.action_queue?.length > 0 ? (
              dashData.action_queue.map((task, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{task.title}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">{task.description}</p>
                  </div>
                  {task.action_url && (
                    <Link to={task.action_url} className="text-xs font-medium text-blue-700 hover:underline shrink-0">
                      Open
                    </Link>
                  )}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-slate-400">
                All daily store tasks up to date!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default StaffDashboard

