import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Package, AlertTriangle, CheckCircle2, TrendingDown,
  RefreshCw, ClipboardCheck, ArrowRight, ShieldAlert,
  Search, FileText
} from 'lucide-react'
import { getDashboardOfficer, getDashboardAlertsSummary } from '../../api/dashboard.api'
import PageHeader from '../../components/layout/PageHeader'
import ErrorState from '../../components/feedback/ErrorState'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { formatNumber, formatCurrency, formatDateTime } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'

function KPICard({ title, value, subtitle, icon: Icon, color = 'blue', loading }) {
  const colorMap = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: 'text-blue-500' },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  icon: 'text-amber-500' },
    green:  { bg: 'bg-green-50',  text: 'text-green-700',  icon: 'text-green-500' },
    red:    { bg: 'bg-red-50',    text: 'text-red-700',    icon: 'text-red-500' },
  }
  const c = colorMap[color] || colorMap.blue

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-5 animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-slate-200 rounded w-28" />
          <div className="h-9 w-9 bg-slate-200 rounded-lg" />
        </div>
        <div className="h-8 bg-slate-200 rounded w-16 mb-2" />
        <div className="h-3 bg-slate-100 rounded w-24" />
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

function OfficerDashboard() {
  const { user, officeName } = useAuth()

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store Officer Supervisory Dashboard"
        subtitle={`Supervisory Operations · Assigned Office: ${officeName || 'Veraval Office'}`}
        actions={
          <div className="flex items-center gap-2">
            <Link to={ROUTES.BARCODE_LOOKUP}>
              <Button variant="secondary" size="sm" leftIcon={<Search size={14} />}>
                Scan / Lookup
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Office Stock Items"
          value={formatNumber(dashData?.total_office_items ?? '—')}
          subtitle="Registered in office"
          icon={Package}
          color="blue"
          loading={isLoading}
        />
        <KPICard
          title="Pending Condemnation"
          value={formatNumber(dashData?.pending_condemnations ?? '—')}
          subtitle="Awaiting review / sanction"
          icon={TrendingDown}
          color="amber"
          loading={isLoading}
        />
        <KPICard
          title="Transfer Requests"
          value={formatNumber(dashData?.pending_transfers ?? '—')}
          subtitle="Inbound & Outbound"
          icon={ClipboardCheck}
          color="blue"
          loading={isLoading}
        />
        <KPICard
          title="Audit Discrepancies"
          value={formatNumber(dashData?.verification_discrepancies ?? '—')}
          subtitle="Requires reconciliation"
          icon={ShieldAlert}
          color="red"
          loading={isLoading}
        />
      </div>

      {/* Main Grid: Status Distribution & Action Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Operational Status Distribution</h2>
              <p className="text-xs text-slate-500">Breakdown of assets across operational states</p>
            </div>
            <Link to={ROUTES.INVENTORY} className="text-xs font-medium text-blue-700 hover:underline flex items-center gap-1">
              View Register <ArrowRight size={12} />
            </Link>
          </div>

          {isLoading ? (
            <div className="h-56 bg-slate-50 rounded animate-pulse" />
          ) : statusDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="status" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(value) => [formatNumber(value), 'Count']} />
                <Bar dataKey="count" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex items-center justify-center text-sm text-slate-400">
              No status distribution data available
            </div>
          )}
        </div>

        {/* Quick Actions & Supervisory Focus */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Supervisory Quick Actions</h2>
            <div className="space-y-2">
              <Link
                to={ROUTES.CONDEMNATIONS}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 text-amber-700 rounded-md">
                    <TrendingDown size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Condemnation Proposals</p>
                    <p className="text-[11px] text-slate-500">Review items for disposal</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400" />
              </Link>

              <Link
                to={ROUTES.VERIFICATION_SESSIONS}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-700 rounded-md">
                    <ClipboardCheck size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Physical Stock Verification</p>
                    <p className="text-[11px] text-slate-500">Conduct audit sessions</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400" />
              </Link>

              <Link
                to={ROUTES.DEAD_STOCK_REGISTER}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 text-slate-700 rounded-md">
                    <Package size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Dead Stock Register</p>
                    <p className="text-[11px] text-slate-500">Non-moving & obsolete stock</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400" />
              </Link>

              <Link
                to={ROUTES.REPORTS}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-md">
                    <FileText size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Department Reports</p>
                    <p className="text-[11px] text-slate-500">Registers, movements & valuation</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400" />
              </Link>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Critical alerts pending:</span>
            <span className="font-semibold text-red-600">
              {alertsData?.critical_count ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Movements within Office */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Recent Movements & Requests</h2>
          <Link to={ROUTES.RECEIPTS} className="text-xs font-medium text-blue-700 hover:underline">
            View All Transactions
          </Link>
        </div>

        {dashData?.recent_movements?.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {dashData.recent_movements.map((tx, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-700">
                    {tx.transaction_type?.substring(0, 2) || 'TX'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{tx.reference_number || tx.voucher_number || 'Transaction'}</p>
                    <p className="text-xs text-slate-500">
                      {tx.item_name} · Qty: {tx.quantity} · {formatDateTime(tx.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={tx.status} />
                  <span className="text-xs text-slate-500">{tx.created_by_name}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-400">
            No recent store movements recorded
          </div>
        )}
      </div>
    </div>
  )
}

export default OfficerDashboard

