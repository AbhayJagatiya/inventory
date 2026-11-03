import { useQuery } from '@tanstack/react-query'
import {
  Package, AlertTriangle, CheckCircle2, TrendingDown,
  Users, Building2, RefreshCw, ClipboardCheck, Clock
} from 'lucide-react'
import { getDashboardAdmin, getDashboardAlertsSummary } from '../../api/dashboard.api'
import { runClassificationEngine } from '../../api/disposal.api'
import PageHeader from '../../components/layout/PageHeader'
import { CardSkeleton } from '../../components/feedback/LoadingSkeleton'
import ErrorState from '../../components/feedback/ErrorState'
import Button from '../../components/common/Button'
import { formatCurrency, formatNumber, formatDateTime } from '../../utils/formatters'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'

const KPI_COLORS = ['#1d4ed8', '#d97706', '#2563eb', '#dc2626']

function KPICard({ title, value, subtitle, icon: Icon, color = 'blue', loading }) {
  const colorMap = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: 'text-blue-500' },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  icon: 'text-amber-500' },
    green:  { bg: 'bg-green-50',  text: 'text-green-700',  icon: 'text-green-500' },
    red:    { bg: 'bg-red-50',    text: 'text-red-700',    icon: 'text-red-500' },
    slate:  { bg: 'bg-slate-50',  text: 'text-slate-700',  icon: 'text-slate-500' },
  }
  const c = colorMap[color] || colorMap.blue

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-5 animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-slate-200 rounded w-32" />
          <div className="h-9 w-9 bg-slate-200 rounded-lg" />
        </div>
        <div className="h-8 bg-slate-200 rounded w-20 mb-2" />
        <div className="h-3 bg-slate-100 rounded w-28" />
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

function AdminDashboard() {
  const { user } = useAuth()

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
      toast.success('Classification engine triggered successfully')
      refetch()
    } catch {
      toast.error('Failed to trigger classification engine')
    }
  }

  const classificationChartData = dashData?.classification_breakdown
    ? Object.entries(dashData.classification_breakdown).map(([name, value]) => ({ name, value }))
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Dashboard"
        subtitle={`System Administration Overview · ${formatDateTime(new Date().toISOString())}`}
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw size={14} />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        }
      />

      {/* Mock data notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-2.5 text-xs text-amber-700 flex items-center gap-2">
        <AlertTriangle size={14} />
        <span>
          <strong>Development mode:</strong> KPI values will be populated from the backend API
          (<code className="font-mono">GET /api/v1/dashboard/admin</code>).
        </span>
      </div>

      {isError && (
        <ErrorState
          message={error?.response?.data?.error?.message || 'Failed to load dashboard data.'}
          onRetry={refetch}
        />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Registered Items"
          value={formatNumber(dashData?.total_items ?? '—')}
          subtitle="All categories"
          icon={Package}
          color="blue"
          loading={isLoading}
        />
        <KPICard
          title="Active Inventory Value"
          value={dashData?.active_inventory_value != null ? formatCurrency(dashData.active_inventory_value) : '—'}
          subtitle="At purchase cost"
          icon={CheckCircle2}
          color="green"
          loading={isLoading}
        />
        <KPICard
          title="Dead Stock Items"
          value={formatNumber(dashData?.dead_stock_count ?? '—')}
          subtitle={dashData?.dead_stock_value != null ? `Value: ${formatCurrency(dashData.dead_stock_value)}` : 'Non-moving + Obsolete'}
          icon={TrendingDown}
          color="amber"
          loading={isLoading}
        />
        <KPICard
          title="Pending Approvals"
          value={formatNumber(dashData?.pending_approvals ?? '—')}
          subtitle="Condemnations + Transfers"
          icon={ClipboardCheck}
          color="red"
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Classification Breakdown Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Inventory Classification Breakdown</h2>
            <Button variant="secondary" size="xs" onClick={handleRunClassification}>
              Run Classification
            </Button>
          </div>
          {isLoading ? (
            <div className="h-48 bg-slate-50 rounded animate-pulse" />
          ) : classificationChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={classificationChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {classificationChartData.map((_, i) => (
                    <Cell key={i} fill={KPI_COLORS[i % KPI_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatNumber(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-slate-400">
              No classification data available
            </div>
          )}
        </div>

        {/* Alerts Summary */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Alert Summary</h2>
          {alertsData ? (
            <div className="space-y-3">
              {Object.entries(alertsData?.by_type || {}).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-600 capitalize">{type.toLowerCase().replace('_', ' ')}</span>
                  <span className="text-sm font-semibold text-slate-800">{count}</span>
                </div>
              ))}
              {(!alertsData?.by_type || Object.keys(alertsData.by_type).length === 0) && (
                <p className="text-sm text-slate-400 py-4 text-center">No active alerts</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Audit Events */}
      {dashData?.recent_audit_events?.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Recent Audit Events</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {dashData.recent_audit_events.map((event, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                <div>
                  <p className="text-sm text-slate-700">{event.description || event.action}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(event.created_at)} · {event.actor_name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard

