import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  CheckCheck,
  Check,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../api/alerts.api'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import StatusBadge from '../../components/common/StatusBadge'
import ErrorState from '../../components/feedback/ErrorState'
import EmptyState from '../../components/feedback/EmptyState'
import { TableSkeleton } from '../../components/feedback/LoadingSkeleton'
import { formatDateTime, formatRelativeTime } from '../../utils/formatters'
import { useLanguage } from '../../i18n'

const NOTIFICATION_TYPE_OPTIONS = [
  { value: 'SYSTEM_ALERT', label: 'System Alert' },
  { value: 'APPROVAL_PENDING', label: 'Approval Pending' },
  { value: 'TRANSFER_REQUEST', label: 'Transfer Request' },
  { value: 'VERIFICATION_ASSIGNED', label: 'Verification Assigned' },
  { value: 'MAINTENANCE_UPDATE', label: 'Maintenance Update' },
  { value: 'STOCK_LOW', label: 'Low Stock' },
]

const NOTIFICATION_TYPE_LABELS = Object.fromEntries(
  NOTIFICATION_TYPE_OPTIONS.map((o) => [o.value, o.label])
)

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.detail ||
    err?.message ||
    fallback
  )
}

export default function NotificationCenterPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Filters & Pagination
  const [readFilter, setReadFilter] = useState('ALL') // 'ALL' | 'UNREAD' | 'READ'
  const [notificationType, setNotificationType] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [markingId, setMarkingId] = useState(null)

  const invalidateNotificationQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    queryClient.invalidateQueries({ queryKey: ['unread-notifications'] })
  }

  // Unread Count Query
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-notifications'],
    queryFn: getUnreadNotificationCount,
    select: (res) => res?.data?.unread_count ?? 0,
  })

  // Notifications List Query
  const isReadParam =
    readFilter === 'UNREAD' ? false : readFilter === 'READ' ? true : undefined

  const queryParams = {
    page,
    limit,
    ...(isReadParam !== undefined ? { is_read: isReadParam } : {}),
    ...(notificationType ? { notification_type: notificationType } : {}),
  }

  const {
    data: notificationsRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['notifications', queryParams],
    queryFn: () => getNotifications(queryParams),
  })

  const notifications = notificationsRes?.data || []
  const totalRecords = notificationsRes?.meta?.total ?? notifications.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / limit))

  // Mark Single Read Mutation
  const markReadMutation = useMutation({
    mutationFn: (id) => markNotificationRead(id),
    onMutate: (id) => setMarkingId(id),
    onSettled: () => setMarkingId(null),
    onSuccess: () => {
      invalidateNotificationQueries()
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to mark notification as read'))
    },
  })

  // Mark All Read Mutation
  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      invalidateNotificationQueries()
      toast.success('All notifications marked as read')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to mark all notifications as read'))
    },
  })

  const handleNotificationClick = (item) => {
    if (!item.is_read && !markReadMutation.isPending) {
      markReadMutation.mutate(item.id)
    }
    if (item.action_url) {
      navigate(item.action_url)
    }
  }

  const filterTabs = [
    { key: 'ALL', label: t('alerts.notifications.all') },
    { key: 'UNREAD', label: t('alerts.notifications.unread') },
    { key: 'READ', label: 'Read' },
  ]

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            <span>{t('alerts.notifications.title')}</span>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                {t('alerts.notifications.unreadCount', { count: unreadCount })}
              </span>
            )}
          </span>
        }
        subtitle="Personal alerts, workflow approvals, transfers, and verification updates"
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<CheckCheck size={14} />}
            disabled={unreadCount === 0}
            isLoading={markAllMutation.isPending}
            onClick={() => markAllMutation.mutate()}
          >
            {t('alerts.notifications.markAllRead')}
          </Button>
        }
      />

      {/* Filter Bar */}
      <GlassCard level={1} className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#0A1513] p-1 rounded-xl border border-slate-200 dark:border-emerald-500/15">
          {filterTabs.map((tab) => {
            const active = readFilter === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setReadFilter(tab.key)
                  setPage(1)
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  active
                    ? 'bg-white dark:bg-forest-800 text-forest-900 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="font-semibold text-slate-600 dark:text-slate-400">
            {t('labels.type')}:
          </label>
          <select
            value={notificationType}
            onChange={(e) => {
              setNotificationType(e.target.value)
              setPage(1)
            }}
            className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">{t('alerts.filters.allTypes')}</option>
            {NOTIFICATION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </GlassCard>

      {/* Notification Stream */}
      {isError ? (
        <ErrorState
          title="Failed to load notifications"
          message={getErrorMessage(error, 'Unable to fetch notifications at this time.')}
          onRetry={refetch}
        />
      ) : (
        <GlassCard level={1} className="overflow-hidden">
          {isLoading ? (
            <TableSkeleton rows={6} cols={3} />
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={t('alerts.notifications.noNotifications')}
              description="You are all caught up. New notifications will appear here."
            />
          ) : (
            <div className="divide-y divide-slate-200/80 dark:divide-emerald-500/10">
              {notifications.map((item) => {
                const isMarkingThis = markReadMutation.isPending && markingId === item.id
                const typeLabel =
                  NOTIFICATION_TYPE_LABELS[item.notification_type] || item.notification_type

                return (
                  <div
                    key={item.id}
                    className={`p-4 sm:px-5 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                      !item.is_read
                        ? 'bg-emerald-500/[0.04] dark:bg-emerald-400/[0.05]'
                        : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    <div
                      onClick={() => item.action_url && handleNotificationClick(item)}
                      className={`flex items-start gap-3.5 flex-1 min-w-0 ${
                        item.action_url ? 'cursor-pointer' : ''
                      }`}
                    >
                      {/* Unread indicator dot */}
                      <div className="mt-1.5 shrink-0">
                        {!item.is_read ? (
                          <span
                            className="block w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"
                            title="Unread"
                          />
                        ) : (
                          <span
                            className="block w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600"
                            title="Read"
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.priority && <StatusBadge status={item.priority} size="xs" />}
                          {typeLabel && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                              <Bell size={11} />
                              {typeLabel}
                            </span>
                          )}
                          <span
                            className="text-[11px] text-slate-500 dark:text-slate-400"
                            title={formatDateTime(item.created_at)}
                          >
                            {formatRelativeTime(item.created_at)}
                          </span>
                        </div>

                        <h4
                          className={`text-sm ${
                            !item.is_read
                              ? 'font-bold text-slate-900 dark:text-slate-50'
                              : 'font-medium text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.title}
                        </h4>

                        {item.message && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {item.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 sm:pt-1">
                      {!item.is_read && (
                        <Button
                          variant="secondary"
                          size="xs"
                          leftIcon={<Check size={12} />}
                          isLoading={isMarkingThis}
                          disabled={markReadMutation.isPending}
                          onClick={() => markReadMutation.mutate(item.id)}
                        >
                          {t('alerts.notifications.markRead')}
                        </Button>
                      )}
                      {item.action_url && (
                        <Button
                          variant="ghost"
                          size="xs"
                          rightIcon={<ExternalLink size={12} />}
                          onClick={() => handleNotificationClick(item)}
                        >
                          {t('actions.view')}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination Footer */}
          {totalRecords > 0 && (
            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-emerald-500/15 bg-slate-50/70 dark:bg-[#0A1513] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span>{t('ui.table.rowsPerPage')}:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value))
                    setPage(1)
                  }}
                  className="bg-white dark:bg-[#12221E] border border-slate-300 dark:border-emerald-500/20 text-slate-900 dark:text-slate-100 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  {[10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span>
                  {t('ui.table.showing', {
                    from: Math.min((page - 1) * limit + 1, totalRecords),
                    to: Math.min(page * limit, totalRecords),
                    total: totalRecords,
                  })}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  leftIcon={<ChevronLeft size={13} />}
                >
                  {t('actions.previous')}
                </Button>
                <span className="px-2.5 font-medium">
                  {t('labels.page')} {page} {t('labels.of')} {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  rightIcon={<ChevronRight size={13} />}
                >
                  {t('actions.next')}
                </Button>
              </div>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  )
}
