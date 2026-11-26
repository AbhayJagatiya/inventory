import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Wrench, CheckCircle2, XCircle, Clock, DollarSign,
  FileText, Download, Upload, History, ShieldAlert, Package, ExternalLink
} from 'lucide-react'
import {
  getMaintenanceRecord,
  updateMaintenanceRecord,
  completeMaintenanceRecord,
} from '../../api/maintenance.api'
import { uploadDocument, downloadDocument } from '../../api/administration.api'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import StatusBadge from '../../components/common/StatusBadge'
import ErrorState from '../../components/feedback/ErrorState'
import { CardSkeleton } from '../../components/feedback/LoadingSkeleton'
import { formatCurrency, formatDate, formatDateTime, formatFileSize } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { PERMISSIONS } from '../../constants/permissions'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../i18n'
import toast from 'react-hot-toast'

const LIFECYCLE_STEPS = [
  { key: 'REPORTED', label: 'Reported' },
  { key: 'UNDER_REVIEW', label: 'Under Review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'IN_REPAIR', label: 'In Repair' },
  { key: 'COMPLETED', label: 'Completed' },
]

export default function MaintenanceDetailPage() {
  const { id } = useParams()
  const { hasPermission } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  // Cancel Confirm Dialog
  const [isCancelOpen, setIsCancelOpen] = useState(false)

  // Complete Maintenance Modal
  const [isCompleteOpen, setIsCompleteOpen] = useState(false)
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0])
  const [actualCost, setActualCost] = useState('')
  const [workPerformed, setWorkPerformed] = useState('')
  const [invoiceReference, setInvoiceReference] = useState('')
  const [resultingCondition, setResultingCondition] = useState('GOOD')
  const [completionRemarks, setCompletionRemarks] = useState('')
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [isCompleting, setIsCompleting] = useState(false)

  const {
    data: recordRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['maintenance-detail', id],
    queryFn: () => getMaintenanceRecord(id),
    enabled: Boolean(id),
  })

  const record = recordRes?.data || recordRes

  const updateMutation = useMutation({
    mutationFn: (payload) => updateMaintenanceRecord(id, payload),
    onSuccess: (res) => {
      const updated = res?.data || res
      queryClient.invalidateQueries({ queryKey: ['maintenance-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-summary'] })
      toast.success(`Ticket moved to ${updated?.status?.replace(/_/g, ' ') || 'updated status'}`)
      setIsCancelOpen(false)
    },
    onError: (err) => {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        'Failed to update maintenance ticket'
      toast.error(msg)
    },
  })

  const handleCompleteSubmit = async (e) => {
    e.preventDefault()
    if (isCompleting) return

    const costVal = Number(actualCost)
    if (actualCost === '' || isNaN(costVal) || costVal < 0) {
      toast.error('Please enter a valid actual cost (0 or greater)')
      return
    }
    if (!workPerformed.trim() || workPerformed.trim().length < 3) {
      toast.error('Work performed must be at least 3 characters')
      return
    }

    setIsCompleting(true)
    try {
      const payload = {
        completion_date: completionDate,
        actual_cost: costVal,
        work_performed: workPerformed.trim(),
        resulting_condition: resultingCondition,
      }
      if (invoiceReference.trim()) payload.invoice_reference = invoiceReference.trim()
      if (completionRemarks.trim()) payload.completion_remarks = completionRemarks.trim()

      await completeMaintenanceRecord(id, payload)

      if (invoiceFile && record?.id) {
        try {
          const fd = new FormData()
          fd.append('file', invoiceFile)
          fd.append('related_entity_type', 'MAINTENANCE')
          fd.append('related_entity_id', record.id)
          fd.append('document_category', 'INVOICE')
          if (record.item_id) fd.append('item_id', record.item_id)
          await uploadDocument(fd)
        } catch {
          toast.error('Maintenance completed, but invoice upload failed')
        }
      }

      toast.success('Maintenance ticket completed and asset updated')
      queryClient.invalidateQueries({ queryKey: ['maintenance-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-summary'] })
      setIsCompleteOpen(false)
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        'Failed to complete maintenance ticket'
      toast.error(msg)
    } finally {
      setIsCompleting(false)
    }
  }

  const handleDownloadDoc = async (doc) => {
    try {
      const response = await downloadDocument(doc.id)
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = blobUrl
      link.setAttribute('download', doc.file_name || `document-${doc.id}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch {
      toast.error('Failed to download document')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  if (isError || !record) {
    return (
      <ErrorState
        title="Unable to load maintenance ticket"
        message={
          error?.response?.data?.error?.message ||
          error?.response?.data?.detail ||
          'Ticket not found or access denied.'
        }
        onRetry={refetch}
      />
    )
  }

  const canUpdate = hasPermission(PERMISSIONS.MAINTENANCE_UPDATE)
  const isTerminal = record.status === 'COMPLETED' || record.status === 'CANCELLED'
  const currentStepIdx = LIFECYCLE_STEPS.findIndex((s) => s.key === record.status)

  const purchaseCost = Number(record.item_purchase_cost || 0)
  const cumulativeCost = Number(record.cumulative_repair_cost || 0)
  const repairRatio = purchaseCost > 0 ? (cumulativeCost / purchaseCost) * 100 : 0

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={record.ticket_reference || `MNT-${String(record.id).slice(0, 8).toUpperCase()}`}
        subtitle={`${record.item_code || ''} — ${record.item_name || 'Asset Maintenance Ticket'}`}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Link to={ROUTES.MAINTENANCE}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                Back to Maintenance
              </Button>
            </Link>

            {canUpdate && !isTerminal && (
              <>
                {record.status === 'REPORTED' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({ status: 'UNDER_REVIEW' })}
                  >
                    Move to Under Review
                  </Button>
                )}
                {(record.status === 'REPORTED' || record.status === 'UNDER_REVIEW') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({ status: 'APPROVED' })}
                  >
                    Approve
                  </Button>
                )}
                {(record.status === 'REPORTED' ||
                  record.status === 'UNDER_REVIEW' ||
                  record.status === 'APPROVED') && (
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({ status: 'IN_REPAIR' })}
                  >
                    Start Repair
                  </Button>
                )}
                {record.status === 'IN_REPAIR' && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<CheckCircle2 size={14} />}
                    onClick={() => {
                      setActualCost(String(record.estimated_cost ?? 0))
                      setIsCompleteOpen(true)
                    }}
                  >
                    Complete Maintenance
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<XCircle size={14} />}
                  onClick={() => setIsCancelOpen(true)}
                >
                  Cancel Ticket
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Status Timeline */}
      <GlassCard level={1} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Clock size={16} className="text-emerald-600 dark:text-emerald-400" />
            Ticket Lifecycle
          </h3>
          <StatusBadge status={record.status} />
        </div>

        {record.status === 'CANCELLED' ? (
          <div className="p-3.5 rounded-xl bg-slate-500/10 border border-slate-500/20 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <XCircle size={16} className="text-rose-500 shrink-0" />
            <span>This maintenance ticket was cancelled and closed without repair completion.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {LIFECYCLE_STEPS.map((step, idx) => {
              const isDone = currentStepIdx >= idx
              const isCurrent = currentStepIdx === idx
              return (
                <div
                  key={step.key}
                  className={`p-3 rounded-xl border text-center transition-colors ${
                    isCurrent
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-200 font-bold'
                      : isDone
                        ? 'bg-forest-500/10 border-forest-500/25 text-forest-800 dark:text-forest-200'
                        : 'bg-slate-50/60 dark:bg-[#0A1513] border-slate-200 dark:border-emerald-500/10 text-slate-400'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider mb-0.5">
                    Step {idx + 1}
                  </div>
                  <div className="text-xs">{step.label}</div>
                </div>
              )
            })}
          </div>
        )}
      </GlassCard>

      {/* Asset Info + Ticket Info + Cost Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Asset Info */}
        <GlassCard level={1} className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package size={16} className="text-emerald-600 dark:text-emerald-400" />
              Asset Information
            </h3>
            <Link
              to={ROUTES.INVENTORY_DETAIL(record.item_id)}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 font-medium"
            >
              View Asset <ExternalLink size={12} />
            </Link>
          </div>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Item Code</dt>
              <dd className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {record.item_code || '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Item Name</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100 text-right">
                {record.item_name || '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Category</dt>
              <dd className="text-slate-800 dark:text-slate-200">{record.category_name || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Office</dt>
              <dd className="text-slate-800 dark:text-slate-200">{record.office_name || '—'}</dd>
            </div>
            <div className="flex justify-between items-center gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Operational Status</dt>
              <dd>
                {record.item_operational_status ? (
                  <StatusBadge status={record.item_operational_status} size="xs" />
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="flex justify-between items-center gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Condition</dt>
              <dd>
                {record.item_condition ? (
                  <StatusBadge status={record.item_condition} size="xs" />
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>
        </GlassCard>

        {/* Ticket Info */}
        <GlassCard level={1} className="p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Wrench size={16} className="text-emerald-600 dark:text-emerald-400" />
            Ticket Details
          </h3>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Reported Date</dt>
              <dd className="text-slate-900 dark:text-slate-100">{formatDate(record.reported_date)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Reported By</dt>
              <dd className="text-slate-900 dark:text-slate-100">{record.reporter_name || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Service Provider</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {record.service_provider || '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Completion Date</dt>
              <dd className="text-slate-900 dark:text-slate-100">
                {record.completion_date ? formatDate(record.completion_date) : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Invoice Ref</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-100">
                {record.invoice_reference || '—'}
              </dd>
            </div>
          </dl>
          <div className="pt-2 border-t border-slate-100 dark:border-emerald-500/15 text-xs">
            <p className="font-semibold text-slate-600 dark:text-slate-400 mb-1">Issue Description</p>
            <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
              {record.issue_description}
            </p>
          </div>
          {record.work_performed && (
            <div className="pt-2 border-t border-slate-100 dark:border-emerald-500/15 text-xs">
              <p className="font-semibold text-slate-600 dark:text-slate-400 mb-1">Work Performed</p>
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                {record.work_performed}
              </p>
            </div>
          )}
        </GlassCard>

        {/* Cost Summary */}
        <GlassCard level={1} className="p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-600 dark:text-emerald-400" />
            Cost Summary
          </h3>
          <dl className="space-y-2.5 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Estimated Cost</dt>
              <dd className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(record.estimated_cost)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Actual Cost (This Ticket)</dt>
              <dd className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                {formatCurrency(record.actual_cost)}
              </dd>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-emerald-500/15 flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Cumulative Repair Cost</dt>
              <dd className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {formatCurrency(cumulativeCost)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Asset Purchase Cost</dt>
              <dd className="font-mono text-slate-700 dark:text-slate-300">
                {purchaseCost > 0 ? formatCurrency(purchaseCost) : '—'}
              </dd>
            </div>
          </dl>

          {purchaseCost > 0 && (
            <div className="pt-2">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-500 dark:text-slate-400">Repair vs Purchase Ratio</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {repairRatio.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-forest-900 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    repairRatio >= 50 ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, repairRatio)}%` }}
                />
              </div>
              {repairRatio >= 50 && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-2 flex items-center gap-1">
                  <ShieldAlert size={13} />
                  Cumulative repairs exceed 50% of purchase cost. Consider condemnation review.
                </p>
              )}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Attached Documents & Previous Maintenance History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GlassCard level={1} className="p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <FileText size={16} className="text-emerald-600 dark:text-emerald-400" />
            Attached Documents ({record.documents?.length || 0})
          </h3>
          {!record.documents || record.documents.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No service reports or invoices attached to this ticket.
            </p>
          ) : (
            <div className="space-y-2">
              {record.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {doc.file_name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {doc.document_category} • {formatFileSize(doc.file_size)} •{' '}
                      {formatDateTime(doc.uploaded_at)}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="xs"
                    leftIcon={<Download size={13} />}
                    onClick={() => handleDownloadDoc(doc)}
                  >
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard level={1} className="p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <History size={16} className="text-emerald-600 dark:text-emerald-400" />
            Previous Maintenance History ({record.item_history?.length || 0})
          </h3>
          {!record.item_history || record.item_history.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No prior maintenance tickets recorded for this asset.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
              {record.item_history.map((h) => (
                <Link
                  key={h.id}
                  to={ROUTES.MAINTENANCE_DETAIL(h.id)}
                  className="block p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15 hover:border-emerald-500/40 transition-colors text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-forest-700 dark:text-emerald-400">
                      {h.ticket_reference}
                    </span>
                    <StatusBadge status={h.status} size="xs" />
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 truncate">{h.issue_description}</p>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>
                      {h.service_provider} • {formatDate(h.reported_date)}
                    </span>
                    <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                      {formatCurrency(h.actual_cost)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Audit Logs */}
      <GlassCard level={1} className="p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
          Audit Trail ({record.audit_logs?.length || 0})
        </h3>
        {!record.audit_logs || record.audit_logs.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">No audit entries recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {record.audit_logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {log.action}
                    </td>
                    <td>{log.username || '—'}</td>
                    <td>{log.role_name || '—'}</td>
                    <td>
                      <StatusBadge status={log.outcome === 'SUCCESS' ? 'ACTIVE' : 'EXPIRED'} label={log.outcome} size="xs" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Cancel Confirm Dialog */}
      <ConfirmDialog
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        onConfirm={() => updateMutation.mutate({ status: 'CANCELLED' })}
        title="Cancel Maintenance Ticket"
        message="Are you sure you want to cancel this maintenance ticket? The asset will be restored from Under Maintenance if no other open tickets exist."
        confirmLabel="Cancel Ticket"
        variant="danger"
        isLoading={updateMutation.isPending}
      />

      {/* Complete Maintenance Modal */}
      {isCompleteOpen && (
        <Modal
          isOpen={isCompleteOpen}
          onClose={() => !isCompleting && setIsCompleteOpen(false)}
          title="Complete Maintenance & Restore Asset"
          size="lg"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={isCompleting}
                onClick={() => setIsCompleteOpen(false)}
              >
                {t('actions.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isCompleting}
                onClick={handleCompleteSubmit}
              >
                Complete Repair
              </Button>
            </>
          }
        >
          <form onSubmit={handleCompleteSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Completion Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Actual Cost (INR) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={actualCost}
                  onChange={(e) => setActualCost(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl font-mono bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Resulting Condition <span className="text-red-500">*</span>
                </label>
                <select
                  value={resultingCondition}
                  onChange={(e) => setResultingCondition(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="GOOD">GOOD</option>
                  <option value="FAIR">FAIR</option>
                  <option value="SCRAP">SCRAP</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Work Performed <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={workPerformed}
                onChange={(e) => setWorkPerformed(e.target.value)}
                placeholder="Describe parts replaced, calibration, or repair work completed..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Invoice Reference (Optional)
                </label>
                <input
                  type="text"
                  value={invoiceReference}
                  onChange={(e) => setInvoiceReference(e.target.value)}
                  placeholder="e.g., INV-2026-0412"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl font-mono bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Completion Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={completionRemarks}
                  onChange={(e) => setCompletionRemarks(e.target.value)}
                  placeholder="Inspection notes..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Service Invoice / Certificate (Optional)
              </label>
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 dark:border-emerald-500/30 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-forest-900/40">
                <Upload size={15} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-slate-600 dark:text-slate-300">
                  {invoiceFile ? invoiceFile.name : 'Upload service invoice (PDF, JPG, PNG)...'}
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
