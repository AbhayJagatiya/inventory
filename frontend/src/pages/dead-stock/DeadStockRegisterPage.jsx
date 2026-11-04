import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Archive, ShieldAlert, Clock, Filter, Search, RotateCcw,
  CheckCircle, ArrowUpRight, ShieldCheck, FileText, AlertCircle,
  Eye, Edit3, X, ExternalLink
} from 'lucide-react'
import {
  getDeadStockRegister,
  overrideClassification,
  releaseClassificationOverride
} from '../../api/disposal.api'
import { getCategories } from '../../api/inventory.api'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import Modal from '../../components/common/Modal'
import { DataTable } from '../../components/tables/DataTable'
import ErrorState from '../../components/feedback/ErrorState'
import EmptyState from '../../components/feedback/EmptyState'
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import toast from 'react-hot-toast'

export default function DeadStockRegisterPage() {
  const { user, hasPermission } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const officeId = user?.office?.id || user?.office_id

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClassification, setSelectedClassification] = useState('ALL')
  const [selectedCondition, setSelectedCondition] = useState('ALL')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // Override modal state
  const [overrideModalItem, setOverrideModalItem] = useState(null)
  const [overrideFormClassification, setOverrideFormClassification] = useState('OBSOLETE')
  const [overrideReason, setOverrideReason] = useState('')
  const [releaseReason, setReleaseReason] = useState('')
  const [isReleaseMode, setIsReleaseMode] = useState(false)

  // Fetch categories for filter dropdown
  const { data: categoriesRes } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  })
  const categoriesList = categoriesRes?.data || []

  // Fetch real dead stock register from backend
  const {
    data: registerRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'dead-stock-register',
      officeId,
      selectedClassification,
      selectedCondition,
      selectedCategory,
      page,
      limit,
    ],
    queryFn: () => {
      const params = {
        page,
        limit,
      }
      if (officeId) params.office_id = officeId
      if (selectedClassification !== 'ALL') params.classification = selectedClassification
      if (selectedCondition !== 'ALL') params.condition = selectedCondition
      if (selectedCategory !== 'ALL') params.category_id = selectedCategory
      return getDeadStockRegister(params)
    },
  })

  const candidates = registerRes?.data || []
  const totalRecords = registerRes?.meta?.total ?? candidates.length
  const totalPages = registerRes?.meta?.total_pages ?? Math.max(1, Math.ceil(totalRecords / limit))

  // Client-side search filtering on loaded page items
  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidates
    const q = searchQuery.toLowerCase().trim()
    return candidates.filter((c) => {
      const itm = c.item || {}
      return (
        itm.item_code?.toLowerCase().includes(q) ||
        itm.item_name?.toLowerCase().includes(q) ||
        itm.serial_number?.toLowerCase().includes(q) ||
        itm.barcode_number?.toLowerCase().includes(q) ||
        itm.brand?.toLowerCase().includes(q)
      )
    })
  }, [candidates, searchQuery])

  // Override Mutation
  const overrideMutation = useMutation({
    mutationFn: ({ itemId, payload }) => overrideClassification(itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dead-stock-register'] })
      queryClient.invalidateQueries({ queryKey: ['classification-summary'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Classification override successfully applied to inventory record.')
      closeOverrideModal()
    },
    onError: (err) => {
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || 'Failed to apply override.'
      toast.error(msg)
    },
  })

  // Release Override Mutation
  const releaseMutation = useMutation({
    mutationFn: ({ itemId, payload }) => releaseClassificationOverride(itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dead-stock-register'] })
      queryClient.invalidateQueries({ queryKey: ['classification-summary'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Override released! Calculated classification restored.')
      closeOverrideModal()
    },
    onError: (err) => {
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || 'Failed to release override.'
      toast.error(msg)
    },
  })

  const openOverrideModal = (candidate) => {
    setOverrideModalItem(candidate)
    setIsReleaseMode(false)
    setOverrideFormClassification(candidate.classification?.effective_classification || 'OBSOLETE')
    setOverrideReason(candidate.classification?.override_reason || '')
    setReleaseReason('')
  }

  const closeOverrideModal = () => {
    setOverrideModalItem(null)
    setOverrideReason('')
    setReleaseReason('')
    setIsReleaseMode(false)
  }

  const handleApplyOverride = (e) => {
    e.preventDefault()
    if (!overrideReason.trim() || overrideReason.trim().length < 5) {
      toast.error('A mandatory justification of at least 5 characters is required.')
      return
    }
    const itmId = overrideModalItem?.item?.id || overrideModalItem?.classification?.item_id
    overrideMutation.mutate({
      itemId: itmId,
      payload: {
        new_classification: overrideFormClassification,
        override_reason: overrideReason.trim(),
      },
    })
  }

  const handleReleaseOverride = (e) => {
    e.preventDefault()
    if (!releaseReason.trim() || releaseReason.trim().length < 3) {
      toast.error('Please provide a reason for releasing the manual override.')
      return
    }
    const itmId = overrideModalItem?.item?.id || overrideModalItem?.classification?.item_id
    releaseMutation.mutate({
      itemId: itmId,
      payload: {
        release_reason: releaseReason.trim(),
      },
    })
  }

  const columns = [
    {
      key: 'item_code',
      header: 'Asset Code & Barcode',
      render: (_, row) => {
        const itm = row.item || {}
        return (
          <div>
            <div className="font-mono font-bold text-slate-900 dark:text-emerald-400">
              {itm.item_code || '—'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {itm.barcode_number || 'No barcode'}
            </div>
          </div>
        )
      },
    },
    {
      key: 'item_name',
      header: 'Description & Brand',
      render: (_, row) => {
        const itm = row.item || {}
        return (
          <div className="max-w-[240px]">
            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
              {itm.item_name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {[itm.brand, itm.model_number, itm.serial_number && `S/N: ${itm.serial_number}`]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
          </div>
        )
      },
    },
    {
      key: 'category',
      header: 'Category & Location',
      render: (_, row) => {
        const itm = row.item || {}
        return (
          <div>
            <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
              {itm.category?.name || 'Uncategorized'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {itm.location ? `${itm.location.room_number}` : 'Central Store'}
            </div>
          </div>
        )
      },
    },
    {
      key: 'condition',
      header: 'Condition',
      render: (_, row) => {
        const cond = row.item?.condition || 'UNKNOWN'
        const badgeColors = {
          GOOD: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
          FAIR: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
          DAMAGED: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
          SCRAP: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
        }
        return (
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              badgeColors[cond] || 'bg-slate-100 text-slate-700'
            }`}
          >
            {cond}
          </span>
        )
      },
    },
    {
      key: 'inactivity',
      header: 'Age & Inactivity',
      render: (_, row) => {
        const ageDays = row.item_age_days ?? row.classification?.item_age_days ?? 0
        const inactDays = row.days_inactive ?? row.classification?.days_inactive ?? 0
        const ageYears = (ageDays / 365).toFixed(1)
        return (
          <div className="text-xs">
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {inactDays} days idle
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Age: {ageYears} yrs ({ageDays}d)
            </div>
          </div>
        )
      },
    },
    {
      key: 'recorded_cost',
      header: 'Book Value',
      align: 'right',
      render: (_, row) => (
        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
          {formatCurrency(row.recorded_cost ?? row.item?.total_cost ?? 0)}
        </span>
      ),
    },
    {
      key: 'effective_classification',
      header: 'Classification',
      render: (_, row) => {
        const eff = row.classification?.effective_classification || row.item?.current_classification || 'OBSOLETE'
        const isOverridden = row.classification?.is_overridden
        const badgeColors = {
          OBSOLETE: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
          NON_MOVING: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
          SLOW_MOVING: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
          ACTIVE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
        }
        return (
          <div className="space-y-1">
            <span
              className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                badgeColors[eff] || 'bg-slate-100 text-slate-700'
              }`}
            >
              {eff}
            </span>
            {isOverridden && (
              <span className="block text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                • Officer Override
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link
            to={ROUTES.INVENTORY_DETAIL(row.item?.id || row.classification?.item_id)}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-forest-800/50 rounded-lg transition-colors"
            title="View Asset Profile"
          >
            <Eye size={15} />
          </Link>
          {hasPermission(PERMISSIONS.CLASSIFY_OVERRIDE) && (
            <button
              onClick={() => openOverrideModal(row)}
              className="p-1.5 text-forest-600 hover:text-forest-800 dark:text-forest-400 dark:hover:text-forest-200 hover:bg-forest-500/10 rounded-lg transition-colors"
              title="Review / Override Classification"
            >
              <Edit3 size={15} />
            </button>
          )}
          {hasPermission(PERMISSIONS.CONDEMN_SUBMIT) && (
            <Link
              to={`${ROUTES.CONDEMNATIONS}?propose_item=${row.item?.id || row.classification?.item_id}`}
              className="p-1.5 text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-200 hover:bg-rose-500/10 rounded-lg transition-colors"
              title="Initiate Condemnation Proposal"
            >
              <ShieldAlert size={15} />
            </Link>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Official Dead Stock Register"
        subtitle="Statutory register of non-moving and obsolete government-owned assets"
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.DEAD_STOCK}>
              <Button variant="secondary" size="sm" leftIcon={<Archive size={14} />}>
                Engine Overview
              </Button>
            </Link>
            <Link to={ROUTES.CONDEMNATIONS}>
              <Button variant="primary" size="sm" leftIcon={<ShieldAlert size={14} />}>
                Condemnation Workflow
              </Button>
            </Link>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <GlassCard level={1} className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[260px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter loaded candidates by code, name, serial..."
              className="w-full pl-10 pr-9 py-2 text-sm bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RotateCcw size={13} />}
              onClick={() => {
                setSearchQuery('')
                setSelectedClassification('ALL')
                setSelectedCondition('ALL')
                setSelectedCategory('ALL')
                setPage(1)
              }}
            >
              Reset Filters
            </Button>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-emerald-500/15 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
            <Filter size={13} />
            <span>Filters:</span>
          </div>

          {/* Classification Filter */}
          <div className="flex items-center gap-1">
            <label className="text-slate-500 dark:text-slate-400">Class:</label>
            <select
              value={selectedClassification}
              onChange={(e) => {
                setSelectedClassification(e.target.value)
                setPage(1)
              }}
              className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Dead Stock (Non-Moving & Obsolete)</option>
              <option value="OBSOLETE">Obsolete / Dead Stock Only</option>
              <option value="NON_MOVING">Non-Moving Stock Only</option>
            </select>
          </div>

          {/* Condition Filter */}
          <div className="flex items-center gap-1">
            <label className="text-slate-500 dark:text-slate-400">Condition:</label>
            <select
              value={selectedCondition}
              onChange={(e) => {
                setSelectedCondition(e.target.value)
                setPage(1)
              }}
              className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Conditions</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="DAMAGED">Damaged</option>
              <option value="SCRAP">Scrap</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1">
            <label className="text-slate-500 dark:text-slate-400">Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value)
                setPage(1)
              }}
              className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Categories</option>
              {categoriesList.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Main Data Section */}
      {isError ? (
        <ErrorState
          title="Error Loading Dead Stock Register"
          message={
            error?.response?.data?.error?.message ||
            error?.response?.data?.detail ||
            'Unable to fetch records from PostgreSQL. Verify the FastAPI backend is online.'
          }
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredCandidates}
          isLoading={isLoading}
          page={page}
          limit={limit}
          total={totalRecords}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={setLimit}
          emptyTitle="No Dead Stock Records Found"
          emptyDescription="There are no non-moving or obsolete assets currently recorded in PostgreSQL for the selected criteria."
        />
      )}

      {/* Authorized Store Officer Override Modal */}
      {overrideModalItem && (
        <Modal
          isOpen={Boolean(overrideModalItem)}
          onClose={closeOverrideModal}
          title={
            isReleaseMode
              ? 'Release Classification Override'
              : 'Authorized Store Officer Classification Override'
          }
          size="md"
          footer={
            <div className="flex items-center justify-between w-full">
              {overrideModalItem.classification?.is_overridden && !isReleaseMode ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setIsReleaseMode(true)}
                >
                  Release Existing Override
                </Button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={closeOverrideModal}>
                  Cancel
                </Button>
                {isReleaseMode ? (
                  <Button
                    variant="danger"
                    size="sm"
                    loading={releaseMutation.isPending}
                    onClick={handleReleaseOverride}
                  >
                    Confirm Release
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    loading={overrideMutation.isPending}
                    onClick={handleApplyOverride}
                  >
                    Apply Override
                  </Button>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Target Item Brief */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-900 dark:text-emerald-400">
                  {overrideModalItem.item?.item_code}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Valuation: {formatCurrency(overrideModalItem.recorded_cost ?? overrideModalItem.item?.total_cost ?? 0)}
                </span>
              </div>
              <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                {overrideModalItem.item?.item_name}
              </p>
              <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <span>Calculated: <strong>{overrideModalItem.classification?.calculated_classification || '—'}</strong></span>
                <span>Effective: <strong>{overrideModalItem.classification?.effective_classification || '—'}</strong></span>
                {overrideModalItem.classification?.is_overridden && (
                  <span className="text-purple-600 dark:text-purple-400 font-semibold">• Currently Overridden</span>
                )}
              </div>
            </div>

            {/* Contributing factors info */}
            {overrideModalItem.classification?.contributing_factors && (
              <div className="p-3 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/15 space-y-1">
                <span className="font-bold text-forest-950 dark:text-forest-100 flex items-center gap-1">
                  <AlertCircle size={13} /> Contributing Engine Factors
                </span>
                <p className="text-[11px] text-forest-800 dark:text-forest-200 leading-normal">
                  {JSON.stringify(overrideModalItem.classification.contributing_factors, null, 2)}
                </p>
              </div>
            )}

            {isReleaseMode ? (
              /* Release Mode Form */
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-200 text-xs">
                  Releasing the override will restore the algorithmic classification calculated by the engine (<strong>{overrideModalItem.classification?.calculated_classification}</strong>).
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Release Reason / Audit Note <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={releaseReason}
                    onChange={(e) => setReleaseReason(e.target.value)}
                    placeholder="Provide justification for restoring automated classification..."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>
            ) : (
              /* Override Form */
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Select New Classification <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={overrideFormClassification}
                    onChange={(e) => setOverrideFormClassification(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE (Return to active circulation)</option>
                    <option value="SLOW_MOVING">SLOW_MOVING (Sluggish stock under observation)</option>
                    <option value="NON_MOVING">NON_MOVING (Statutory non-moving stock)</option>
                    <option value="OBSOLETE">OBSOLETE (Dead stock recommended for condemnation)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mandatory Officer Justification <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Explain why this item is being manually reclassified (e.g. required for upcoming election duty, repair scheduled)..."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Note: All overrides are permanently recorded in the official audit trail with your user identity and timestamp.
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
