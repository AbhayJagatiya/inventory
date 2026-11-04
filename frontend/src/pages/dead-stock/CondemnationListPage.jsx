import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldAlert, Plus, Filter, Search, RotateCcw,
  CheckCircle, Clock, AlertTriangle, ArrowRight,
  FileText, ShieldCheck, X, Trash2
} from 'lucide-react'
import { getCondemnations, createCondemnation } from '../../api/disposal.api'
import { getItems } from '../../api/inventory.api'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import Modal from '../../components/common/Modal'
import { DataTable } from '../../components/tables/DataTable'
import ErrorState from '../../components/feedback/ErrorState'
import EmptyState from '../../components/feedback/EmptyState'
import { formatNumber, formatDate, formatDateTime, formatCurrency } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import toast from 'react-hot-toast'

export default function CondemnationListPage() {
  const { user, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const officeId = user?.office?.id || user?.office_id

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // New Proposal Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [reasonCode, setReasonCode] = useState('BEYOND_ECONOMIC_REPAIR')
  const [conditionSummary, setConditionSummary] = useState('')
  const [proposalItems, setProposalItems] = useState([
    {
      item_id: searchParams.get('propose_item') || '',
      item_condition: 'DAMAGED',
      assessed_scrap_value: 0,
      inspector_remarks: '',
    },
  ])

  // Open modal automatically if redirected with ?propose_item=
  useEffect(() => {
    const proposeItemParam = searchParams.get('propose_item')
    if (proposeItemParam) {
      setIsNewModalOpen(true)
      setProposalItems([
        {
          item_id: proposeItemParam,
          item_condition: 'DAMAGED',
          assessed_scrap_value: 0,
          inspector_remarks: 'Nominated from Dead Stock Register',
        },
      ])
    }
  }, [searchParams])

  // Fetch available store items for selection
  const { data: itemsRes } = useQuery({
    queryKey: ['available-items', officeId],
    queryFn: () => getItems({ limit: 100 }),
  })
  const availableItems = itemsRes?.data || []

  // Fetch real condemnation requests from backend
  const {
    data: condemnationsRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['condemnations', officeId, selectedStatus, page, limit],
    queryFn: () => {
      const params = { page, limit }
      if (officeId) params.office_id = officeId
      if (selectedStatus !== 'ALL') params.status = selectedStatus
      return getCondemnations(params)
    },
  })

  const requests = condemnationsRes?.data || []
  const totalRecords = condemnationsRes?.meta?.total ?? requests.length
  const totalPages = condemnationsRes?.meta?.total_pages ?? Math.max(1, Math.ceil(totalRecords / limit))

  // Filtered locally by search query
  const filteredRequests = requests.filter((r) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      r.request_number?.toLowerCase().includes(q) ||
      r.condition_summary?.toLowerCase().includes(q) ||
      r.reason_code?.toLowerCase().includes(q)
    )
  })

  // Create Condemnation Mutation
  const createMutation = useMutation({
    mutationFn: (payload) => createCondemnation(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['condemnations'] })
      queryClient.invalidateQueries({ queryKey: ['dead-stock-register'] })
      queryClient.invalidateQueries({ queryKey: ['classification-summary'] })
      const created = res?.data || res
      toast.success(`Condemnation proposal ${created.request_number} submitted to Survey Committee!`)
      setIsNewModalOpen(false)
      if (created.id) {
        navigate(ROUTES.CONDEMNATION_DETAIL(created.id))
      }
    },
    onError: (err) => {
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || 'Failed to submit condemnation.'
      toast.error(msg)
    },
  })

  const handleAddItemLine = () => {
    setProposalItems([
      ...proposalItems,
      {
        item_id: '',
        item_condition: 'DAMAGED',
        assessed_scrap_value: 0,
        inspector_remarks: '',
      },
    ])
  }

  const handleRemoveItemLine = (idx) => {
    if (proposalItems.length === 1) {
      toast.error('A proposal must include at least one item.')
      return
    }
    setProposalItems(proposalItems.filter((_, i) => i !== idx))
  }

  const handleItemChange = (idx, field, value) => {
    const updated = [...proposalItems]
    updated[idx][field] = value
    setProposalItems(updated)
  }

  const handleCreateSubmit = (e) => {
    e.preventDefault()
    if (!officeId) {
      toast.error('Unable to determine user office identity.')
      return
    }
    if (!conditionSummary.trim() || conditionSummary.trim().length < 5) {
      toast.error('Please provide a condition summary of at least 5 characters.')
      return
    }
    const hasEmptyItem = proposalItems.some((itm) => !itm.item_id)
    if (hasEmptyItem) {
      toast.error('Please select an item for all proposal rows.')
      return
    }

    createMutation.mutate({
      office_id: officeId,
      reason_code: reasonCode,
      condition_summary: conditionSummary.trim(),
      items: proposalItems.map((itm) => ({
        item_id: itm.item_id,
        item_condition: itm.item_condition,
        assessed_scrap_value: Number(itm.assessed_scrap_value) || 0,
        inspector_remarks: itm.inspector_remarks.trim() || null,
      })),
    })
  }

  const columns = [
    {
      key: 'request_number',
      header: 'Proposal Reference & Reason',
      render: (_, row) => (
        <div>
          <div className="font-mono font-bold text-slate-900 dark:text-emerald-400">
            {row.request_number}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Reason: <span className="font-semibold text-slate-700 dark:text-slate-300">{row.reason_code}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'condition_summary',
      header: 'Condition Summary',
      render: (_, row) => (
        <p className="text-xs text-slate-700 dark:text-slate-300 max-w-sm truncate" title={row.condition_summary}>
          {row.condition_summary}
        </p>
      ),
    },
    {
      key: 'items_count',
      header: 'Items Nominated',
      render: (_, row) => (
        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
          {row.items?.length || 1} asset(s)
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Workflow Stage',
      render: (_, row) => {
        const badgeColors = {
          SUBMITTED: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
          UNDER_REVIEW: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
          APPROVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
          REJECTED: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
          MORE_INFO_REQUIRED: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
        }
        return (
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              badgeColors[row.status] || 'bg-slate-100 text-slate-700'
            }`}
          >
            {row.status}
          </span>
        )
      },
    },
    {
      key: 'created_at',
      header: 'Submitted On',
      render: (_, row) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <Link to={ROUTES.CONDEMNATION_DETAIL(row.id)}>
          <Button variant="secondary" size="xs" rightIcon={<ArrowRight size={12} />}>
            Review & Sanction
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Condemnation Proposals & Sanction Workflow"
        subtitle="Formal survey, condition assessment, and administrative sanction under Gujarat Panchayat Rules"
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.DEAD_STOCK_REGISTER}>
              <Button variant="secondary" size="sm" leftIcon={<ShieldAlert size={14} />}>
                Dead Stock Register
              </Button>
            </Link>
            {hasPermission(PERMISSIONS.CONDEMN_SUBMIT) && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => setIsNewModalOpen(true)}
              >
                New Condemnation Proposal
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Bar */}
      <GlassCard level={1} className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search proposals by number, reason, description..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="font-semibold text-slate-600 dark:text-slate-400">Stage:</label>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value)
              setPage(1)
            }}
            className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Stages</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved (Sanctioned)</option>
            <option value="REJECTED">Rejected</option>
            <option value="MORE_INFO_REQUIRED">More Info Required</option>
          </select>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw size={13} />}
            onClick={() => {
              setSearchQuery('')
              setSelectedStatus('ALL')
              setPage(1)
            }}
          >
            Reset
          </Button>
        </div>
      </GlassCard>

      {/* Main Proposals Table */}
      {isError ? (
        <ErrorState
          title="Error Loading Condemnation Proposals"
          message={
            error?.response?.data?.error?.message ||
            error?.response?.data?.detail ||
            'Unable to fetch condemnation proposals from PostgreSQL. Verify FastAPI backend is online.'
          }
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredRequests}
          isLoading={isLoading}
          page={page}
          limit={limit}
          total={totalRecords}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={setLimit}
          emptyTitle="No Condemnation Proposals"
          emptyDescription="There are no condemnation proposals recorded in the database for the active criteria."
        />
      )}

      {/* New Condemnation Proposal Modal */}
      {isNewModalOpen && (
        <Modal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          title="Submit Condemnation Proposal to Survey Committee"
          size="lg"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsNewModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={createMutation.isPending}
                onClick={handleCreateSubmit}
              >
                Submit Proposal
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-forest-500/10 dark:bg-forest-950/50 border border-forest-500/20 text-forest-800 dark:text-forest-200">
              <strong>Procedural Note:</strong> Submitted condemnation proposals are evaluated by the Survey Committee.
              Approved items are transitioned to <code>PENDING_DISPOSAL</code> status in PostgreSQL and locked from active store operations.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Statutory Condemnation Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="BEYOND_ECONOMIC_REPAIR">BEYOND_ECONOMIC_REPAIR (Repair cost exceeds current asset value)</option>
                  <option value="OBSOLETE">OBSOLETE (Exceeded useful lifespan & technologically obsolete)</option>
                  <option value="DAMAGED_BEYOND_RECOVERY">DAMAGED_BEYOND_RECOVERY (Severe physical breakdown / unserviceable)</option>
                  <option value="DESTROYED">DESTROYED (Natural calamity / accidental damage)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Condition Summary & Justification <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={conditionSummary}
                  onChange={(e) => setConditionSummary(e.target.value)}
                  placeholder="e.g. Obsolete computers and damaged printers in central store..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Line items section */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-emerald-500/15">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 dark:text-slate-200">
                  Nominated Assets for Condemnation ({proposalItems.length})
                </h4>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  leftIcon={<Plus size={12} />}
                  onClick={handleAddItemLine}
                >
                  Add Asset
                </Button>
              </div>

              {proposalItems.map((line, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Asset #{idx + 1}
                    </span>
                    {proposalItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemLine(idx)}
                        className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300"
                        title="Remove line"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Select Asset <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={line.item_id}
                        onChange={(e) => handleItemChange(idx, 'item_id', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0E1D19] text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        required
                      >
                        <option value="">-- Choose Asset --</option>
                        {availableItems.map((itm) => (
                          <option key={itm.id} value={itm.id}>
                            {itm.item_code} - {itm.item_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Inspection Condition
                      </label>
                      <select
                        value={line.item_condition}
                        onChange={(e) => handleItemChange(idx, 'item_condition', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0E1D19] text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="DAMAGED">Damaged (Faulty / Broken)</option>
                        <option value="SCRAP">Scrap (Uneconomical / Waste)</option>
                        <option value="POOR">Poor (Severely degraded)</option>
                        <option value="OBSOLETE">Obsolete (End of service)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Estimated Scrap Realization (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.assessed_scrap_value}
                        onChange={(e) => handleItemChange(idx, 'assessed_scrap_value', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0E1D19] text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={line.inspector_remarks}
                      onChange={(e) => handleItemChange(idx, 'inspector_remarks', e.target.value)}
                      placeholder="Technical defect details / inspection notes..."
                      className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0E1D19] text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
