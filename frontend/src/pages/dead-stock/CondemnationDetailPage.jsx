import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldAlert, ArrowLeft, CheckCircle, AlertTriangle, ShieldCheck,
  Clock, FileText, UserCheck, XCircle, ArrowRight, ExternalLink,
  DollarSign, Check, X
} from 'lucide-react'
import {
  getCondemnation,
  reviewCondemnation,
  decideCondemnation
} from '../../api/disposal.api'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import Modal from '../../components/common/Modal'
import ErrorState from '../../components/feedback/ErrorState'
import { CardSkeleton } from '../../components/feedback/LoadingSkeleton'
import { formatCurrency, formatNumber, formatDate, formatDateTime } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import toast from 'react-hot-toast'

export default function CondemnationDetailPage() {
  const { id } = useParams()
  const { user, hasPermission } = useAuth()
  const queryClient = useQueryClient()

  // Modals state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [reviewRemarks, setReviewRemarks] = useState('')

  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false)
  const [decisionAction, setDecisionAction] = useState('APPROVE')
  const [sanctionOrderNumber, setSanctionOrderNumber] = useState('')
  const [decisionRemarks, setDecisionRemarks] = useState('')

  // Fetch real condemnation request details
  const {
    data: requestRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['condemnation-detail', id],
    queryFn: () => getCondemnation(id),
    enabled: Boolean(id),
  })

  const request = requestRes?.data || requestRes

  // Review Mutation
  const reviewMutation = useMutation({
    mutationFn: (payload) => reviewCondemnation(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['condemnation-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['condemnations'] })
      toast.success('Condemnation proposal status updated to UNDER_REVIEW.')
      setIsReviewModalOpen(false)
      setReviewRemarks('')
    },
    onError: (err) => {
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || 'Review submission failed.'
      toast.error(msg)
    },
  })

  // Decision Mutation
  const decisionMutation = useMutation({
    mutationFn: (payload) => decideCondemnation(id, payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['condemnation-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['condemnations'] })
      queryClient.invalidateQueries({ queryKey: ['dead-stock-register'] })
      queryClient.invalidateQueries({ queryKey: ['disposals'] })
      const updated = res?.data || res
      toast.success(`Sanction decision recorded: ${updated.status}`)
      setIsDecisionModalOpen(false)
      setDecisionRemarks('')
      setSanctionOrderNumber('')
    },
    onError: (err) => {
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || 'Decision recording failed.'
      toast.error(msg)
    },
  })

  const handleReviewSubmit = (e) => {
    e.preventDefault()
    if (!reviewRemarks.trim() || reviewRemarks.trim().length < 3) {
      toast.error('Please enter review remarks of at least 3 characters.')
      return
    }
    reviewMutation.mutate({
      action: 'REVIEW',
      remarks: reviewRemarks.trim(),
    })
  }

  const handleDecisionSubmit = (e) => {
    e.preventDefault()
    if (decisionAction === 'APPROVE' && !sanctionOrderNumber.trim()) {
      toast.error('Official Sanction Order Number is mandatory for approval.')
      return
    }
    if (!decisionRemarks.trim() || decisionRemarks.trim().length < 3) {
      toast.error('Please provide formal decision remarks.')
      return
    }

    decisionMutation.mutate({
      action: decisionAction,
      order_number: sanctionOrderNumber.trim() || null,
      remarks: decisionRemarks.trim(),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <PageHeader title="Loading Condemnation Dossier..." />
        <CardSkeleton />
      </div>
    )
  }

  if (isError || !request) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <PageHeader title="Condemnation Proposal Dossier" />
        <ErrorState
          title="Proposal Not Found"
          message={
            error?.response?.data?.error?.message ||
            error?.response?.data?.detail ||
            'Unable to load the requested condemnation proposal from PostgreSQL.'
          }
          onRetry={refetch}
        />
      </div>
    )
  }

  const totalScrapValuation = (request.items || []).reduce(
    (acc, curr) => acc + (Number(curr.assessed_scrap_value) || 0),
    0
  )

  const isSubmitted = request.status === 'SUBMITTED'
  const isUnderReview = request.status === 'UNDER_REVIEW'
  const isApproved = request.status === 'APPROVED'
  const isRejected = request.status === 'REJECTED'

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={`Condemnation Proposal Dossier: ${request.request_number}`}
        subtitle={`Status: ${request.status} · Submitted on ${formatDate(request.created_at)}`}
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.CONDEMNATIONS}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                All Proposals
              </Button>
            </Link>

            {/* Review Button for Store Officer */}
            {isSubmitted && hasPermission(PERMISSIONS.CONDEMN_REVIEW) && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<UserCheck size={14} />}
                onClick={() => setIsReviewModalOpen(true)}
              >
                Mark Under Review
              </Button>
            )}

            {/* Final Decision Button for Approver (DDO / Competent Authority) */}
            {(isSubmitted || isUnderReview) && hasPermission(PERMISSIONS.CONDEMN_APPROVE) && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<ShieldCheck size={14} />}
                onClick={() => setIsDecisionModalOpen(true)}
              >
                Record Sanction Decision
              </Button>
            )}

            {isApproved && (
              <Link to={ROUTES.DISPOSALS}>
                <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />}>
                  Proceed to Disposal Register
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Stage Stepper Header */}
      <GlassCard level={1} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Statutory Approval Pipeline
          </span>
          <span
            className={`px-3 py-0.5 rounded-full text-xs font-extrabold ${
              isApproved
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                : isRejected
                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
            }`}
          >
            {request.status}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15">
            <span className="text-slate-500 dark:text-slate-400 block mb-0.5">1. Submission</span>
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {formatDateTime(request.created_at)}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15">
            <span className="text-slate-500 dark:text-slate-400 block mb-0.5">2. Committee Review</span>
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {isSubmitted ? 'Pending Review' : 'Survey Evaluated'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15">
            <span className="text-slate-500 dark:text-slate-400 block mb-0.5">3. Sanction Decision</span>
            <p
              className={`font-bold ${
                isApproved
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : isRejected
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {isApproved
                ? 'Officially Sanctioned'
                : isRejected
                ? 'Proposal Rejected'
                : 'Awaiting Order'}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Proposal Summary Card */}
      <GlassCard level={2} className="p-6 space-y-4">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-100 dark:border-emerald-500/15 pb-2">
          <FileText size={15} className="text-emerald-600 dark:text-emerald-400" />
          Dossier Mandate & Justification
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block mb-1">Reason Code</span>
            <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {request.reason_code}
            </p>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400 block mb-1">Total Assets Nominated</span>
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {request.items?.length || 0} durable / obsolete items
            </p>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400 block mb-1">Total Assessed Scrap Value</span>
            <p className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">
              {formatCurrency(totalScrapValuation)}
            </p>
          </div>
        </div>

        <div className="pt-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Condition Summary & Committee Notes
          </span>
          <p className="text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#0A1513] p-3 rounded-xl border border-slate-200 dark:border-emerald-500/15 leading-relaxed">
            {request.condition_summary}
          </p>
        </div>
      </GlassCard>

      {/* Candidate Items Table */}
      <GlassCard level={1} className="p-5 space-y-3">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
          Nominated Items Inspection Detail ({request.items?.length || 0})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs data-table">
            <thead>
              <tr>
                <th>Item ID</th>
                <th>Observed Condition</th>
                <th>Assessed Scrap Value</th>
                <th>Technical Remarks</th>
              </tr>
            </thead>
            <tbody>
              {(request.items || []).map((itm) => (
                <tr key={itm.id}>
                  <td className="font-mono font-bold text-slate-900 dark:text-emerald-400">
                    <Link
                      to={ROUTES.INVENTORY_DETAIL(itm.item_id)}
                      className="hover:underline flex items-center gap-1"
                    >
                      {String(itm.item_id).slice(0, 16)}…
                      <ExternalLink size={12} className="text-slate-400" />
                    </Link>
                  </td>
                  <td>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400">
                      {itm.item_condition}
                    </span>
                  </td>
                  <td className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(itm.assessed_scrap_value)}
                  </td>
                  <td className="text-slate-600 dark:text-slate-400">
                    {itm.inspector_remarks || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Approval Actions History Log */}
      <GlassCard level={1} className="p-5 space-y-3">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Clock size={14} className="text-emerald-600 dark:text-emerald-400" />
          Statutory Decision & Sanction Trail
        </h3>

        {(request.approval_actions || []).length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center">
            No formal actions recorded yet. Proposal is awaiting Survey Committee evaluation.
          </p>
        ) : (
          <div className="space-y-3">
            {request.approval_actions.map((act) => (
              <div
                key={act.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        act.action === 'APPROVE'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : act.action === 'REJECT'
                          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                          : 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      {act.action}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Role: {act.role_snapshot}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {formatDateTime(act.action_at)}
                  </span>
                </div>

                {act.order_number && (
                  <p className="font-mono text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                    Official Sanction Order No: {act.order_number}
                  </p>
                )}

                <p className="text-slate-700 dark:text-slate-300 italic">
                  &ldquo;{act.remarks}&rdquo;
                </p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Review Modal */}
      {isReviewModalOpen && (
        <Modal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          title="Mark Proposal Under Survey Review"
          size="md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsReviewModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={reviewMutation.isPending}
                onClick={handleReviewSubmit}
              >
                Confirm Review
              </Button>
            </>
          }
        >
          <form onSubmit={handleReviewSubmit} className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-400">
              Moving this proposal to <strong>UNDER_REVIEW</strong> signifies that the physical survey is underway.
            </p>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Survey Committee Assessment Remarks <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                placeholder="Technical inspection details, findings on condition, and recommendation..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Decision Modal */}
      {isDecisionModalOpen && (
        <Modal
          isOpen={isDecisionModalOpen}
          onClose={() => setIsDecisionModalOpen(false)}
          title="Record Official Administrative Sanction Decision"
          size="md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsDecisionModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={decisionAction === 'APPROVE' ? 'primary' : 'danger'}
                size="sm"
                loading={decisionMutation.isPending}
                onClick={handleDecisionSubmit}
              >
                Seal Decision Order
              </Button>
            </>
          }
        >
          <form onSubmit={handleDecisionSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sanction Authority Action <span className="text-red-500">*</span>
              </label>
              <select
                value={decisionAction}
                onChange={(e) => setDecisionAction(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="APPROVE">APPROVE (Sanction Condemnation & Proceed to Disposal)</option>
                <option value="REJECT">REJECT (Restore Assets to Store Register)</option>
                <option value="REQUEST_INFO">REQUEST_INFO (Return to Staff for Clarification)</option>
              </select>
            </div>

            {decisionAction === 'APPROVE' && (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Official Sanction Order Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sanctionOrderNumber}
                  onChange={(e) => setSanctionOrderNumber(e.target.value)}
                  placeholder="e.g. DDO/GS/STORE/COND-412/2026"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl font-mono bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Decision Directives & Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={decisionRemarks}
                onChange={(e) => setDecisionRemarks(e.target.value)}
                placeholder="Official remarks from competent sanction authority..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            {decisionAction === 'APPROVE' && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200">
                Approving this proposal will transition all included items to <code>PENDING_DISPOSAL</code> in PostgreSQL and unlock them in the Disposal Execution Register.
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  )
}
