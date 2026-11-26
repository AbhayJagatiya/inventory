import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BellRing,
  AlertOctagon,
  AlertTriangle,
  Info,
  Clock,
  CheckCircle2,
  EyeOff,
  Search,
  RotateCcw,
  RefreshCw,
  Check,
  AlarmClock,
  ShieldCheck,
  Wrench,
  PackageX,
  Activity,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getAlertsSummary,
  getAlerts,
  runAlertCheck,
  acknowledgeAlert,
  snoozeAlert,
  resolveAlert,
} from '../../api/alerts.api'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import Modal from '../../components/common/Modal'
import StatusBadge from '../../components/common/StatusBadge'
import { DataTable } from '../../components/tables/DataTable'
import ErrorState from '../../components/feedback/ErrorState'
import { formatDate, formatDateTime, formatNumber } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import { useLanguage } from '../../i18n'
import { translateEnum } from '../../i18n/enumLabels'

const ALERT_TYPE_OPTIONS = [
  'NON_MOVING_INACTIVITY',
  'WARRANTY_EXPIRING',
  'MAINTENANCE_DUE',
  'LOW_STOCK',
]

const PRIORITY_OPTIONS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

const STATUS_OPTIONS = ['ACTIVE', 'ACKNOWLEDGED', 'SNOOZED', 'RESOLVED']

const SNOOZE_PRESETS = [7, 14, 30]

const ALERT_TYPE_META = {
  NON_MOVING_INACTIVITY: {
    icon: Activity,
    colorClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/20',
  },
  WARRANTY_EXPIRING: {
    icon: ShieldCheck,
    colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20',
  },
  MAINTENANCE_DUE: {
    icon: Wrench,
    colorClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20',
  },
  LOW_STOCK: {
    icon: PackageX,
    colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/20',
  },
}

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.detail ||
    err?.message ||
    fallback
  )
}

export default function AlertCenterPage() {
  const { hasPermission } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const canRunCheck = hasPermission(PERMISSIONS.SETTINGS_MANAGE)
  const canResolveAlerts = hasPermission(PERMISSIONS.ALERTS_RESOLVE)

  // Filters & Pagination
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [alertType, setAlertType] = useState('')
  const [priority, setPriority] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // Action tracking & Modals
  const [acknowledgingId, setAcknowledgingId] = useState(null)
  const [snoozeTarget, setSnoozeTarget] = useState(null)
  const [snoozeDays, setSnoozeDays] = useState(7)
  const [resolveTarget, setResolveTarget] = useState(null)
  const [resolutionRemarks, setResolutionRemarks] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const invalidateAlertQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['alerts'] })
    queryClient.invalidateQueries({ queryKey: ['alerts-summary'] })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    queryClient.invalidateQueries({ queryKey: ['unread-notifications'] })
  }

  // Summary Query
  const { data: summaryRes } = useQuery({
    queryKey: ['alerts-summary'],
    queryFn: getAlertsSummary,
  })
  const summary = summaryRes?.data || {}

  // Alerts List Query
  const queryParams = {
    page,
    limit,
    sort_by: sortBy,
    sort_dir: sortDir,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(alertType ? { alert_type: alertType } : {}),
    ...(priority ? { priority } : {}),
    ...(status ? { status } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
  }

  const {
    data: alertsRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['alerts', queryParams],
    queryFn: () => getAlerts(queryParams),
  })

  const alerts = alertsRes?.data || []
  const totalRecords = alertsRes?.meta?.total ?? alerts.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / limit))

  // Run Alert Check Mutation
  const runCheckMutation = useMutation({
    mutationFn: runAlertCheck,
    onSuccess: (res) => {
      invalidateAlertQueries()
      const created = res?.data?.alerts_created ?? res?.data?.created_count
      toast.success(
        created != null
          ? `Alert check completed (${created} new alerts)`
          : 'Alert check completed successfully'
      )
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to run alert check'))
    },
  })

  // Acknowledge Mutation
  const acknowledgeMutation = useMutation({
    mutationFn: (id) => acknowledgeAlert(id),
    onMutate: (id) => setAcknowledgingId(id),
    onSettled: () => setAcknowledgingId(null),
    onSuccess: () => {
      invalidateAlertQueries()
      toast.success(t('alerts.messages.acknowledged'))
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to acknowledge alert'))
    },
  })

  // Snooze Mutation
  const snoozeMutation = useMutation({
    mutationFn: ({ id, snooze_days }) => snoozeAlert(id, { snooze_days }),
    onSuccess: () => {
      invalidateAlertQueries()
      toast.success(t('alerts.messages.snoozed'))
      setSnoozeTarget(null)
      setSnoozeDays(7)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to snooze alert'))
    },
  })

  // Resolve Mutation
  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution_remarks }) => resolveAlert(id, { resolution_remarks }),
    onSuccess: () => {
      invalidateAlertQueries()
      toast.success(t('alerts.messages.resolved'))
      setResolveTarget(null)
      setResolutionRemarks('')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to resolve alert'))
    },
  })

  const handleSort = (key, order) => {
    setSortBy(key)
    setSortDir(order)
    setPage(1)
  }

  const handleResetFilters = () => {
    setSearchInput('')
    setDebouncedSearch('')
    setAlertType('')
    setPriority('')
    setStatus('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const handleSnoozeSubmit = (e) => {
    e.preventDefault()
    if (!snoozeTarget || snoozeMutation.isPending) return
    const days = Number(snoozeDays)
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      toast.error('Snooze duration must be between 1 and 90 days')
      return
    }
    snoozeMutation.mutate({ id: snoozeTarget.id, snooze_days: days })
  }

  const handleResolveSubmit = (e) => {
    e.preventDefault()
    if (!resolveTarget || resolveMutation.isPending) return
    const trimmed = resolutionRemarks.trim()
    if (trimmed.length < 3) {
      toast.error('Resolution remarks must be at least 3 characters')
      return
    }
    resolveMutation.mutate({ id: resolveTarget.id, resolution_remarks: trimmed })
  }

  const columns = [
    {
      key: 'alert_reference',
      header: 'Alert Ref',
      sortable: true,
      render: (_, row) => (
        <span className="font-mono font-bold text-slate-900 dark:text-emerald-400 whitespace-nowrap">
          {row.alert_reference || '—'}
        </span>
      ),
    },
    {
      key: 'alert_type',
      header: t('alerts.table.type'),
      sortable: true,
      render: (_, row) => (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
          {translateEnum(t, row.alert_type)}
        </span>
      ),
    },
    {
      key: 'priority',
      header: t('alerts.table.priority'),
      sortable: true,
      render: (_, row) => <StatusBadge status={row.priority} size="xs" />,
    },
    {
      key: 'item_name',
      header: t('alerts.table.asset'),
      render: (_, row) =>
        row.item_id ? (
          <Link
            to={ROUTES.INVENTORY_DETAIL(row.item_id)}
            className="group block max-w-[190px]"
          >
            <div className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 group-hover:underline truncate">
              {row.item_code || 'View Item'}
            </div>
            {row.item_name && (
              <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                {row.item_name}
              </div>
            )}
          </Link>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: 'office_name',
      header: t('labels.office'),
      render: (_, row) => (
        <span className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {row.office_name || '—'}
        </span>
      ),
    },
    {
      key: 'title',
      header: t('alerts.table.description'),
      render: (_, row) => (
        <div className="max-w-xs">
          <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate" title={row.title}>
            {row.title}
          </p>
          {row.message && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2" title={row.message}>
              {row.message}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: t('alerts.table.createdAt'),
      sortable: true,
      render: (_, row) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap" title={formatDateTime(row.created_at)}>
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('alerts.table.status'),
      sortable: true,
      render: (_, row) => (
        <div className="space-y-1">
          <StatusBadge status={row.status} size="xs" />
          {row.status === 'SNOOZED' && row.snoozed_until && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Until {formatDate(row.snoozed_until)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'resolver_name',
      header: 'Resolved By',
      render: (_, row) => (
        <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {row.resolver_name ? (
            <>
              <div className="font-medium">{row.resolver_name}</div>
              {row.resolved_at && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatDate(row.resolved_at)}
                </div>
              )}
            </>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </div>
      ),
    },
    ...(canResolveAlerts
      ? [
          {
            key: 'actions',
            header: t('alerts.table.actions'),
            align: 'right',
            render: (_, row) => {
              const isAckLoading = acknowledgeMutation.isPending && acknowledgingId === row.id
              const canAck = row.status === 'ACTIVE'
              const canSnooze = row.status === 'ACTIVE' || row.status === 'ACKNOWLEDGED'
              const canResolve =
                row.status === 'ACTIVE' ||
                row.status === 'ACKNOWLEDGED' ||
                row.status === 'SNOOZED'

              if (!canAck && !canSnooze && !canResolve) {
                return <span className="text-xs text-slate-400">—</span>
              }

              return (
                <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                  {canAck && (
                    <Button
                      variant="secondary"
                      size="xs"
                      leftIcon={<Check size={12} />}
                      isLoading={isAckLoading}
                      disabled={acknowledgeMutation.isPending}
                      onClick={() => acknowledgeMutation.mutate(row.id)}
                    >
                      {t('alerts.actions.acknowledge')}
                    </Button>
                  )}
                  {canSnooze && (
                    <Button
                      variant="ghost"
                      size="xs"
                      leftIcon={<AlarmClock size={12} />}
                      onClick={() => {
                        setSnoozeTarget(row)
                        setSnoozeDays(7)
                      }}
                    >
                      {t('alerts.actions.snooze')}
                    </Button>
                  )}
                  {canResolve && (
                    <Button
                      variant="primary"
                      size="xs"
                      leftIcon={<CheckCircle2 size={12} />}
                      onClick={() => {
                        setResolveTarget(row)
                        setResolutionRemarks('')
                      }}
                    >
                      {t('alerts.actions.resolve')}
                    </Button>
                  )}
                </div>
              )
            },
          },
        ]
      : []),
  ]

  const mediumLowCount = (summary.medium_count ?? 0) + (summary.low_count ?? 0)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={t('alerts.title')}
        subtitle="System-generated operational, warranty, maintenance, and stock level alerts"
        actions={
          canRunCheck && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              isLoading={runCheckMutation.isPending}
              onClick={() => runCheckMutation.mutate()}
            >
              Run Alert Check
            </Button>
          )
        }
      />

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Active
            </p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              {formatNumber(summary.total_active ?? 0)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-forest-500/10 text-forest-600 dark:text-forest-300 border border-forest-500/20 flex items-center justify-center shrink-0">
            <BellRing size={18} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Critical
            </p>
            <p className="text-2xl font-extrabold text-rose-700 dark:text-rose-300 mt-1">
              {formatNumber(summary.critical_count ?? 0)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/20 flex items-center justify-center shrink-0">
            <AlertOctagon size={18} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
              High
            </p>
            <p className="text-2xl font-extrabold text-orange-700 dark:text-orange-300 mt-1">
              {formatNumber(summary.high_count ?? 0)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-300 border border-orange-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Medium / Low
            </p>
            <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">
              {formatNumber(mediumLowCount)}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              M: {summary.medium_count ?? 0} · L: {summary.low_count ?? 0}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Info size={18} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Unacknowledged
            </p>
            <p className="text-2xl font-extrabold text-sky-700 dark:text-sky-300 mt-1">
              {formatNumber(summary.unacknowledged_count ?? 0)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/20 flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Snoozed
            </p>
            <p className="text-2xl font-extrabold text-slate-700 dark:text-slate-200 mt-1">
              {formatNumber(summary.snoozed_count ?? 0)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20 flex items-center justify-center shrink-0">
            <EyeOff size={18} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Resolved
            </p>
            <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
              {formatNumber(summary.resolved_count ?? 0)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
        </GlassCard>
      </div>

      {/* Alert Type Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ALERT_TYPE_OPTIONS.map((typeKey) => {
          const meta = ALERT_TYPE_META[typeKey]
          const Icon = meta.icon
          const count = summary.by_type?.[typeKey] ?? 0
          const isSelected = alertType === typeKey

          return (
            <button
              key={typeKey}
              type="button"
              onClick={() => {
                setAlertType(isSelected ? '' : typeKey)
                setPage(1)
              }}
              className="text-left"
            >
              <GlassCard
                level={1}
                className={`p-4 flex items-center justify-between transition-all ${
                  isSelected
                    ? 'ring-2 ring-emerald-500 border-emerald-500/40'
                    : 'hover:border-emerald-500/30'
                }`}
              >
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {translateEnum(t, typeKey)}
                  </p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {formatNumber(count)}
                  </p>
                </div>
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${meta.colorClass}`}>
                  <Icon size={18} />
                </div>
              </GlassCard>
            </button>
          )
        })}
      </div>

      {/* Filter Bar */}
      <GlassCard level={1} className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search alert ref, asset, title..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <select
          value={alertType}
          onChange={(e) => {
            setAlertType(e.target.value)
            setPage(1)
          }}
          className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">{t('alerts.filters.allTypes')}</option>
          {ALERT_TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {translateEnum(t, opt)}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value)
            setPage(1)
          }}
          className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">{t('alerts.filters.allPriorities')}</option>
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {translateEnum(t, opt)}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">{t('alerts.filters.allStatuses')}</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {translateEnum(t, opt)}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">{t('labels.from')}</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(1)
            }}
            className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <span className="text-slate-500 dark:text-slate-400 font-medium">{t('labels.to')}</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(1)
            }}
            className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
      </GlassCard>

      {/* Alerts DataTable */}
      {isError ? (
        <ErrorState
          title="Failed to load alerts"
          message={getErrorMessage(error, 'Unable to fetch alerts at this time.')}
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={alerts}
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
          sortOrder={sortDir}
          onSort={handleSort}
          emptyTitle={t('alerts.emptyState.title')}
          emptyDescription={t('alerts.emptyState.description')}
        />
      )}

      {/* Snooze Modal */}
      <Modal
        isOpen={Boolean(snoozeTarget)}
        onClose={() => !snoozeMutation.isPending && setSnoozeTarget(null)}
        title={`Snooze Alert ${snoozeTarget?.alert_reference || ''}`}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={snoozeMutation.isPending}
              onClick={() => setSnoozeTarget(null)}
            >
              {t('actions.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={snoozeMutation.isPending}
              onClick={handleSnoozeSubmit}
            >
              {t('alerts.actions.snooze')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSnoozeSubmit} className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Temporarily suppress <strong>{snoozeTarget?.title}</strong> for a selected number of days.
          </p>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Quick Presets
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SNOOZE_PRESETS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setSnoozeDays(days)}
                  className={`py-2 px-3 rounded-xl border font-semibold transition-colors ${
                    Number(snoozeDays) === days
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                      : 'bg-white dark:bg-[#0A1513] border-slate-300 dark:border-emerald-500/20 text-slate-700 dark:text-slate-300 hover:border-emerald-500/40'
                  }`}
                >
                  {days} days
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Custom Duration (1–90 days) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={90}
              value={snoozeDays}
              onChange={(e) => setSnoozeDays(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
        </form>
      </Modal>

      {/* Resolve Modal */}
      <Modal
        isOpen={Boolean(resolveTarget)}
        onClose={() => !resolveMutation.isPending && setResolveTarget(null)}
        title={`Resolve Alert ${resolveTarget?.alert_reference || ''}`}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={resolveMutation.isPending}
              onClick={() => setResolveTarget(null)}
            >
              {t('actions.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={resolveMutation.isPending}
              disabled={resolutionRemarks.trim().length < 3}
              onClick={handleResolveSubmit}
            >
              {t('alerts.actions.resolve')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleResolveSubmit} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-emerald-500/15">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {resolveTarget?.title}
            </p>
            {resolveTarget?.message && (
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                {resolveTarget.message}
              </p>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Resolution Remarks (min 3 characters) <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={resolutionRemarks}
              onChange={(e) => setResolutionRemarks(e.target.value)}
              placeholder="Describe the corrective action taken to resolve this alert..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {resolutionRemarks.trim().length}/3 minimum characters
            </p>
          </div>
        </form>
      </Modal>
    </div>
  )
}
