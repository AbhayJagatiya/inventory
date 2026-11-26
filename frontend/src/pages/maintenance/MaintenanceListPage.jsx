import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wrench, Plus, Search, RotateCcw, Clock, AlertTriangle,
  DollarSign, TrendingUp, Activity, Eye, ArrowRight, Upload
} from 'lucide-react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, Legend
} from 'recharts'
import {
  getMaintenanceSummary,
  getMaintenanceRecords,
  createMaintenanceRecord,
  updateMaintenanceRecord,
} from '../../api/maintenance.api'
import { getItems, getCategories } from '../../api/inventory.api'
import { getOffices, uploadDocument } from '../../api/administration.api'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import Modal from '../../components/common/Modal'
import StatusBadge from '../../components/common/StatusBadge'
import { DataTable } from '../../components/tables/DataTable'
import ErrorState from '../../components/feedback/ErrorState'
import { formatCurrency, formatNumber, formatDate, truncate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { ROLES, MAINTENANCE_STATUSES } from '../../constants/enums'
import { PERMISSIONS } from '../../constants/permissions'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../i18n'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  REPORTED: '#f43f5e',
  UNDER_REVIEW: '#3b82f6',
  APPROVED: '#14b8a6',
  IN_REPAIR: '#f59e0b',
  COMPLETED: '#10b981',
  CANCELLED: '#64748b',
}

const NEXT_STATUS_ACTION = {
  REPORTED: { next: 'UNDER_REVIEW', label: 'Review' },
  UNDER_REVIEW: { next: 'APPROVED', label: 'Approve' },
  APPROVED: { next: 'IN_REPAIR', label: 'Start Repair' },
}

export default function MaintenanceListPage() {
  const { user, hasPermission } = useAuth()
  const { isDark } = useTheme()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const isSystemAdmin =
    user?.role === ROLES.SYSTEM_ADMIN ||
    (Array.isArray(user?.roles) && user.roles.includes(ROLES.SYSTEM_ADMIN))

  // Filters & Table State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [officeFilter, setOfficeFilter] = useState('')
  const [serviceProviderFilter, setServiceProviderFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // Create Ticket Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [itemId, setItemId] = useState('')
  const [ticketOfficeId, setTicketOfficeId] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [reportedDate, setReportedDate] = useState(new Date().toISOString().split('T')[0])
  const [serviceProvider, setServiceProvider] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('0')
  const [remarks, setRemarks] = useState('')
  const [supportFile, setSupportFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Summary KPIs & Charts
  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ['maintenance-summary', officeFilter],
    queryFn: () => getMaintenanceSummary(),
  })
  const summary = summaryRes?.data || summaryRes || {}

  // List Query
  const {
    data: listRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'maintenance-records',
      officeFilter,
      statusFilter,
      categoryFilter,
      serviceProviderFilter,
      searchQuery,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
      page,
      limit,
    ],
    queryFn: () => {
      const params = {
        page,
        limit,
        sort_by: sortBy,
        sort_dir: sortOrder,
      }
      if (officeFilter) params.office_id = officeFilter
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (categoryFilter) params.category_id = categoryFilter
      if (serviceProviderFilter.trim()) params.service_provider = serviceProviderFilter.trim()
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      return getMaintenanceRecords(params)
    },
  })

  const records = listRes?.data || []
  const totalRecords = listRes?.meta?.total ?? records.length
  const totalPages = listRes?.meta?.total_pages ?? Math.max(1, Math.ceil(totalRecords / limit))

  // Supporting Dropdowns
  const { data: categoriesRes } = useQuery({
    queryKey: ['categories-list'],
    queryFn: () => getCategories({ limit: 100 }),
  })
  const categories = categoriesRes?.data || []

  const { data: officesRes } = useQuery({
    queryKey: ['offices-list'],
    queryFn: () => getOffices({ limit: 100 }),
    enabled: isSystemAdmin,
  })
  const offices = officesRes?.data || []

  const { data: itemsRes } = useQuery({
    queryKey: ['items-for-maintenance'],
    queryFn: () => getItems({ limit: 100 }),
    enabled: isCreateOpen,
  })
  const items = itemsRes?.data || []

  // Quick Transition Mutation
  const transitionMutation = useMutation({
    mutationFn: ({ id, status }) => updateMaintenanceRecord(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-summary'] })
      toast.success('Ticket status updated')
    },
    onError: (err) => {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        'Failed to update ticket status'
      toast.error(msg)
    },
  })

  const resetCreateForm = () => {
    setItemId('')
    setTicketOfficeId('')
    setIssueDescription('')
    setReportedDate(new Date().toISOString().split('T')[0])
    setServiceProvider('')
    setEstimatedCost('0')
    setRemarks('')
    setSupportFile(null)
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!itemId) {
      toast.error('Please select an asset')
      return
    }
    if (!issueDescription.trim() || issueDescription.trim().length < 3) {
      toast.error('Issue description must be at least 3 characters')
      return
    }
    if (!serviceProvider.trim() || serviceProvider.trim().length < 2) {
      toast.error('Service provider must be at least 2 characters')
      return
    }
    const costVal = Number(estimatedCost)
    if (isNaN(costVal) || costVal < 0) {
      toast.error('Estimated cost must be 0 or greater')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        item_id: itemId,
        issue_description: issueDescription.trim(),
        service_provider: serviceProvider.trim(),
        reported_date: reportedDate,
        estimated_cost: costVal,
      }
      if (ticketOfficeId) payload.office_id = ticketOfficeId
      if (remarks.trim()) payload.remarks = remarks.trim()

      const res = await createMaintenanceRecord(payload)
      const created = res?.data || res

      if (supportFile && created?.id) {
        try {
          const fd = new FormData()
          fd.append('file', supportFile)
          fd.append('related_entity_type', 'MAINTENANCE')
          fd.append('related_entity_id', created.id)
          fd.append('document_category', 'SERVICE_REPORT')
          fd.append('item_id', created.item_id || itemId)
          await uploadDocument(fd)
        } catch {
          toast.error('Ticket created, but supporting document upload failed')
        }
      }

      toast.success(`Maintenance ticket ${created?.ticket_reference || ''} created`)
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-summary'] })
      setIsCreateOpen(false)
      resetCreateForm()
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        'Failed to create maintenance ticket'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setStatusFilter('ALL')
    setCategoryFilter('')
    setOfficeFilter('')
    setServiceProviderFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const activeOpenCount =
    (summary.reported_count || 0) +
    (summary.under_review_count || 0) +
    (summary.approved_count || 0) +
    (summary.in_repair_count || 0)

  const statusChartData = useMemo(
    () => (summary.by_status || []).filter((s) => s.count > 0),
    [summary.by_status]
  )
  const categoryChartData = useMemo(
    () => (summary.by_category || []).slice(0, 8),
    [summary.by_category]
  )
  const monthlyChartData = useMemo(
    () => summary.cost_over_time || summary.monthly_activity || [],
    [summary.cost_over_time, summary.monthly_activity]
  )

  const axisColor = isDark ? '#94a3b8' : '#64748b'
  const gridColor = isDark ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.2)'

  const canUpdate = hasPermission(PERMISSIONS.MAINTENANCE_UPDATE)

  const columns = [
    {
      key: 'ticket_reference',
      header: 'Ticket Ref',
      render: (_, row) => (
        <Link
          to={ROUTES.MAINTENANCE_DETAIL(row.id)}
          className="font-mono font-bold text-forest-700 dark:text-emerald-400 hover:underline"
        >
          {row.ticket_reference || `MNT-${String(row.id).slice(0, 8).toUpperCase()}`}
        </Link>
      ),
    },
    {
      key: 'item_name',
      header: 'Asset',
      render: (_, row) => (
        <div className="max-w-[180px]">
          <Link
            to={ROUTES.INVENTORY_DETAIL(row.item_id)}
            className="font-semibold text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 truncate block"
          >
            {row.item_name || '—'}
          </Link>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {row.item_code || ''}
          </span>
        </div>
      ),
    },
    {
      key: 'category_name',
      header: 'Category',
      render: (_, row) => (
        <span className="text-xs text-slate-700 dark:text-slate-300">
          {row.category_name || '—'}
        </span>
      ),
    },
    {
      key: 'office_name',
      header: 'Office',
      render: (_, row) => (
        <span className="text-xs text-slate-700 dark:text-slate-300">
          {row.office_name || '—'}
        </span>
      ),
    },
    {
      key: 'issue_description',
      header: 'Issue',
      render: (_, row) => (
        <span className="text-xs text-slate-700 dark:text-slate-300" title={row.issue_description}>
          {truncate(row.issue_description, 40)}
        </span>
      ),
    },
    {
      key: 'reported_date',
      header: 'Reported',
      sortable: true,
      render: (_, row) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
          {formatDate(row.reported_date)}
        </span>
      ),
    },
    {
      key: 'reporter_name',
      header: 'Reporter',
      render: (_, row) => (
        <span className="text-xs text-slate-700 dark:text-slate-300">
          {row.reporter_name || '—'}
        </span>
      ),
    },
    {
      key: 'service_provider',
      header: 'Service Provider',
      render: (_, row) => (
        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
          {row.service_provider || '—'}
        </span>
      ),
    },
    {
      key: 'estimated_cost',
      header: 'Est. Cost',
      align: 'right',
      sortable: true,
      render: (_, row) => (
        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
          {formatCurrency(row.estimated_cost)}
        </span>
      ),
    },
    {
      key: 'actual_cost',
      header: 'Actual Cost',
      align: 'right',
      sortable: true,
      render: (_, row) => (
        <span className="font-mono font-semibold text-xs text-emerald-700 dark:text-emerald-300">
          {formatCurrency(row.actual_cost)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (_, row) => <StatusBadge status={row.status} size="xs" />,
    },
    {
      key: 'completion_date',
      header: 'Completed',
      sortable: true,
      render: (_, row) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
          {row.completion_date ? formatDate(row.completion_date) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) => {
        const nextAction = NEXT_STATUS_ACTION[row.status]
        return (
          <div className="flex items-center justify-end gap-1.5">
            {canUpdate && nextAction && (
              <Button
                variant="secondary"
                size="xs"
                isLoading={transitionMutation.isPending && transitionMutation.variables?.id === row.id}
                onClick={(e) => {
                  e.stopPropagation()
                  transitionMutation.mutate({ id: row.id, status: nextAction.next })
                }}
                rightIcon={<ArrowRight size={12} />}
              >
                {nextAction.label}
              </Button>
            )}
            <Link to={ROUTES.MAINTENANCE_DETAIL(row.id)}>
              <Button variant="ghost" size="xs" leftIcon={<Eye size={13} />}>
                View
              </Button>
            </Link>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Asset Maintenance & Repair Log"
        subtitle="Track breakdown tickets, authorized repair providers, service costs, and asset restoration"
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.WARRANTIES}>
              <Button variant="secondary" size="sm">
                Warranty Watch
              </Button>
            </Link>
            {hasPermission(PERMISSIONS.MAINTENANCE_LOG) && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => setIsCreateOpen(true)}
              >
                Log Maintenance Ticket
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Tickets
            </p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              {summaryLoading ? '—' : formatNumber(summary.total_tickets ?? 0)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-forest-500/10 text-forest-600 dark:text-forest-300 border border-forest-500/20 flex items-center justify-center">
            <Wrench size={18} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Active / Open
            </p>
            <p className="text-2xl font-extrabold text-amber-800 dark:text-amber-200 mt-1">
              {summaryLoading ? '—' : formatNumber(activeOpenCount)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 flex items-center justify-center">
            <Clock size={18} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Overdue (&gt;14d)
            </p>
            <p className="text-2xl font-extrabold text-rose-700 dark:text-rose-300 mt-1">
              {summaryLoading ? '—' : formatNumber(summary.overdue_count ?? 0)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/20 flex items-center justify-center">
            <AlertTriangle size={18} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Total Actual Cost
            </p>
            <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
              {summaryLoading ? '—' : formatCurrency(summary.total_actual_cost ?? 0)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 flex items-center justify-center">
            <DollarSign size={18} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Avg Repair Cost
            </p>
            <p className="text-xl font-extrabold text-sky-800 dark:text-sky-200 mt-1 font-mono">
              {summaryLoading ? '—' : formatCurrency(summary.avg_repair_cost ?? 0)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/20 flex items-center justify-center">
            <TrendingUp size={18} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Under Maint.
            </p>
            <p className="text-2xl font-extrabold text-purple-800 dark:text-purple-200 mt-1">
              {summaryLoading ? '—' : formatNumber(summary.assets_under_maintenance ?? 0)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 flex items-center justify-center">
            <Activity size={18} />
          </div>
        </GlassCard>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard level={1} className="p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
            Tickets by Status
          </h3>
          {statusChartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-400">
              No ticket status data yet
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {statusChartData.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] || '#10b981'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value, name.replace(/_/g, ' ')]}
                  />
                  <Legend
                    formatter={(val) => val.replace(/_/g, ' ')}
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>

        <GlassCard level={1} className="p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
            Cost Over Time &amp; Monthly Activity
          </h3>
          {monthlyChartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-400">
              No monthly activity data yet
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} />
                  <YAxis tick={{ fontSize: 11, fill: axisColor }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    name="Actual Cost (INR)"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.2}
                  />
                  <Area
                    type="monotone"
                    dataKey="tickets"
                    name="Tickets"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.15}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>

        <GlassCard level={1} className="p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
            Repairs by Category
          </h3>
          {categoryChartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-400">
              No category repair data yet
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={95}
                    tick={{ fontSize: 11, fill: axisColor }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" name="Tickets" fill="#087B61" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Filter Bar */}
      <GlassCard level={1} className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Search ticket ref, asset code/name, provider, issue..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            {Object.values(MAINTENANCE_STATUSES).map((st) => (
              <option key={st} value={st}>
                {st.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setPage(1)
            }}
            className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {isSystemAdmin && (
            <select
              value={officeFilter}
              onChange={(e) => {
                setOfficeFilter(e.target.value)
                setPage(1)
              }}
              className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">All Offices</option>
              {offices.map((off) => (
                <option key={off.id} value={off.id}>
                  {off.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <input
            type="text"
            value={serviceProviderFilter}
            onChange={(e) => {
              setServiceProviderFilter(e.target.value)
              setPage(1)
            }}
            placeholder="Filter by service provider..."
            className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
              className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw size={13} />}
            onClick={handleResetFilters}
          >
            {t('actions.reset')}
          </Button>
        </div>
      </GlassCard>

      {/* Main Table */}
      {isError ? (
        <ErrorState
          title="Unable to load maintenance records"
          message={
            error?.response?.data?.error?.message ||
            error?.response?.data?.detail ||
            'An error occurred while fetching maintenance tickets.'
          }
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={records}
          isLoading={isLoading}
          page={page}
          limit={limit}
          total={totalRecords}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={(newLimit) => {
            setLimit(newLimit)
            setPage(1)
          }}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={(key, order) => {
            setSortBy(key)
            setSortOrder(order)
            setPage(1)
          }}
          emptyTitle="No maintenance tickets found"
          emptyDescription="Log a maintenance ticket or adjust your search filters."
        />
      )}

      {/* Create Maintenance Ticket Modal */}
      {isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => !isSubmitting && setIsCreateOpen(false)}
          title="Log Maintenance Ticket"
          size="lg"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={isSubmitting}
                onClick={() => setIsCreateOpen(false)}
              >
                {t('actions.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                onClick={handleCreateSubmit}
              >
                Create Ticket
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Asset <span className="text-red-500">*</span>
                </label>
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                >
                  <option value="">Select an asset...</option>
                  {items.map((itm) => (
                    <option key={itm.id} value={itm.id}>
                      {itm.item_code} — {itm.item_name}
                    </option>
                  ))}
                </select>
              </div>

              {isSystemAdmin && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Office (Optional)
                  </label>
                  <select
                    value={ticketOfficeId}
                    onChange={(e) => setTicketOfficeId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">Default (Asset&apos;s Office)</option>
                    {offices.map((off) => (
                      <option key={off.id} value={off.id}>
                        {off.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Issue Description <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="Describe the defect, breakdown, or repair requirement..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reported Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={reportedDate}
                  onChange={(e) => setReportedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Service Provider <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={serviceProvider}
                  onChange={(e) => setServiceProvider(e.target.value)}
                  placeholder="e.g., Authorized Tech Care"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Estimated Cost (INR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl font-mono bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Remarks (Optional)
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Additional notes or context..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Supporting Document (Optional)
              </label>
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 dark:border-emerald-500/30 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-forest-900/40">
                <Upload size={15} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-slate-600 dark:text-slate-300">
                  {supportFile ? supportFile.name : 'Choose service report / photo (PDF, JPG, PNG)...'}
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setSupportFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
