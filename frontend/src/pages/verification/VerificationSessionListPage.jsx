import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  QrCode, Plus, Filter, Search, RotateCcw,
  CheckCircle, AlertTriangle, ShieldCheck, Clock,
  ArrowRight, Layers, FileText, X, MapPin, Tag
} from 'lucide-react'
import {
  getVerificationSessions,
  createVerificationSession
} from '../../api/verification.api'
import { getLocations, getCategories } from '../../api/inventory.api'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import Modal from '../../components/common/Modal'
import { DataTable } from '../../components/tables/DataTable'
import ErrorState from '../../components/feedback/ErrorState'
import EmptyState from '../../components/feedback/EmptyState'
import { CardSkeleton } from '../../components/feedback/LoadingSkeleton'
import { formatNumber, formatDate, formatDateTime } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import toast from 'react-hot-toast'

export default function VerificationSessionListPage() {
  const { user, hasPermission } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const officeId = user?.office?.id || user?.office_id

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // New session modal state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [scopeType, setScopeType] = useState('FULL_OFFICE')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [sessionNotes, setSessionNotes] = useState('')

  // Fetch locations & categories for scoping
  const { data: locationsRes } = useQuery({
    queryKey: ['locations', officeId],
    queryFn: () => getLocations(officeId ? { office_id: officeId } : {}),
  })
  const locationsList = locationsRes?.data || []

  const { data: categoriesRes } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  })
  const categoriesList = categoriesRes?.data || []

  // Fetch real sessions from backend
  const {
    data: sessionsRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['verification-sessions', officeId, selectedStatus, page, limit],
    queryFn: () => {
      const params = { page, limit }
      if (officeId) params.office_id = officeId
      if (selectedStatus !== 'ALL') params.status = selectedStatus
      return getVerificationSessions(params)
    },
  })

  const sessions = sessionsRes?.data || []
  const totalRecords = sessionsRes?.meta?.total ?? sessions.length
  const totalPages = sessionsRes?.meta?.total_pages ?? Math.max(1, Math.ceil(totalRecords / limit))

  // Filtered by local search query
  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      s.session_number?.toLowerCase().includes(q) ||
      s.notes?.toLowerCase().includes(q)
    )
  })

  // Create Session Mutation
  const createMutation = useMutation({
    mutationFn: (payload) => createVerificationSession(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['verification-sessions'] })
      const created = res?.data || res
      toast.success(`Verification session ${created.session_number} initialized! Snapshot frozen.`)
      setIsNewModalOpen(false)
      resetNewForm()
      if (created.id) {
        navigate(ROUTES.VERIFICATION_SESSION_DETAIL(created.id))
      }
    },
    onError: (err) => {
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || 'Failed to initialize session.'
      toast.error(msg)
    },
  })

  const resetNewForm = () => {
    setScopeType('FULL_OFFICE')
    setSelectedLocationId('')
    setSelectedCategoryId('')
    setSessionNotes('')
  }

  const handleCreateSession = (e) => {
    e.preventDefault()
    if (!officeId) {
      toast.error('Unable to determine user office identity. Please re-login.')
      return
    }
    if (scopeType === 'LOCATION' && !selectedLocationId) {
      toast.error('Please select the target room / location for this audit.')
      return
    }
    if (scopeType === 'CATEGORY' && !selectedCategoryId) {
      toast.error('Please select the item category to audit.')
      return
    }

    createMutation.mutate({
      office_id: officeId,
      scope_type: scopeType,
      location_id: scopeType === 'LOCATION' ? selectedLocationId : null,
      category_id: scopeType === 'CATEGORY' ? selectedCategoryId : null,
      notes: sessionNotes.trim() || null,
    })
  }

  // Status counters
  const inProgressCount = sessions.filter((s) => s.status === 'IN_PROGRESS').length
  const completedCount = sessions.filter((s) => s.status === 'COMPLETED').length
  const plannedCount = sessions.filter((s) => s.status === 'PLANNED').length

  const columns = [
    {
      key: 'session_number',
      header: 'Session Number & Scope',
      render: (_, row) => (
        <div>
          <div className="font-mono font-bold text-slate-900 dark:text-emerald-400">
            {row.session_number}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Scope: <span className="font-semibold text-slate-700 dark:text-slate-300">{row.scope_type}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Audit Status',
      render: (_, row) => {
        const badgeColors = {
          PLANNED: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
          IN_PROGRESS: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
          UNDER_REVIEW: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
          COMPLETED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
          CANCELLED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300',
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
      key: 'progress',
      header: 'Scanning Progress',
      render: (_, row) => {
        const expected = row.total_expected_items || 0
        const scanned = row.total_scanned_items || 0
        const pct = expected > 0 ? Math.min(100, Math.round((scanned / expected) * 100)) : 0
        return (
          <div className="space-y-1 min-w-[130px]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {scanned} / {expected} items
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {pct}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-emerald-950/40 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      },
    },
    {
      key: 'discrepancy_count',
      header: 'Discrepancies',
      align: 'center',
      render: (_, row) => {
        const dCount = row.discrepancy_count || 0
        if (dCount > 0) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
              <AlertTriangle size={12} /> {dCount} Pending
            </span>
          )
        }
        return (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center gap-1">
            <CheckCircle size={13} /> None
          </span>
        )
      },
    },
    {
      key: 'created_at',
      header: 'Initiated On',
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
        <Link to={ROUTES.VERIFICATION_SESSION_DETAIL(row.id)}>
          <Button variant="secondary" size="xs" rightIcon={<ArrowRight size={12} />}>
            Workspace
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Physical Stock Verification & Audit Sessions"
        subtitle="Periodic stocktaking, room-by-room inventory audits, and discrepancy reconciliation"
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.BARCODE_LOOKUP}>
              <Button variant="secondary" size="sm" leftIcon={<QrCode size={14} />}>
                Barcode Lookup
              </Button>
            </Link>
            {hasPermission(PERMISSIONS.VERIFY_CREATE) && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => setIsNewModalOpen(true)}
              >
                New Audit Session
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              Total Sessions
            </p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 mt-1">
              {formatNumber(totalRecords)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-forest-500/10 text-forest-600 dark:text-forest-300 border border-forest-500/20 flex items-center justify-center">
            <Layers size={17} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase">
              In Progress
            </p>
            <p className="text-2xl font-extrabold text-amber-800 dark:text-amber-200 mt-1">
              {formatNumber(inProgressCount)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 flex items-center justify-center">
            <Clock size={17} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">
              Planned
            </p>
            <p className="text-2xl font-extrabold text-blue-800 dark:text-blue-200 mt-1">
              {formatNumber(plannedCount)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20 flex items-center justify-center">
            <FileText size={17} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
              Completed Audits
            </p>
            <p className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-200 mt-1">
              {formatNumber(completedCount)}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle size={17} />
          </div>
        </GlassCard>
      </div>

      {/* Filter Bar */}
      <GlassCard level={1} className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit sessions by number..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="font-semibold text-slate-600 dark:text-slate-400">Status:</label>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value)
              setPage(1)
            }}
            className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Audit Statuses</option>
            <option value="PLANNED">Planned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
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

      {/* Main Table */}
      {isError ? (
        <ErrorState
          title="Error Loading Verification Sessions"
          message={
            error?.response?.data?.error?.message ||
            error?.response?.data?.detail ||
            'Unable to fetch verification sessions from backend. Verify FastAPI service is online.'
          }
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredSessions}
          isLoading={isLoading}
          page={page}
          limit={limit}
          total={totalRecords}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={setLimit}
          emptyTitle="No Verification Sessions Found"
          emptyDescription="No physical verification audit sessions have been initiated for this office yet."
        />
      )}

      {/* New Verification Session Modal */}
      {isNewModalOpen && (
        <Modal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          title="Initialize Physical Stock Verification Session"
          size="md"
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
                onClick={handleCreateSession}
              >
                Start Session & Freeze Snapshot
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreateSession} className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-forest-500/10 dark:bg-forest-950/50 border border-forest-500/20 text-forest-800 dark:text-forest-200">
              <strong>Statutory Snapshot Notice:</strong> When starting this session, the system freezes the expected inventory baseline from the active PostgreSQL ledger at this exact moment. All physical scans will be cross-referenced against this baseline.
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Audit Scope Type <span className="text-red-500">*</span>
              </label>
              <select
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="FULL_OFFICE">Full Office Comprehensive Audit (All Store Rooms)</option>
                <option value="LOCATION">Room-Specific Audit (Single Storage Room / Bay)</option>
                <option value="CATEGORY">Category-Specific Audit (e.g. IT Equipment Only)</option>
              </select>
            </div>

            {scopeType === 'LOCATION' && (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Storage Room / Location <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                >
                  <option value="">-- Select Room Location --</option>
                  {locationsList.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.room_number} - {loc.description}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scopeType === 'CATEGORY' && (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Asset Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                >
                  <option value="">-- Select Category --</option>
                  {categoriesList.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Audit Mandate / Purpose Notes
              </label>
              <textarea
                rows={3}
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="e.g. Annual physical stocktaking per DDO Order No. 412 or pre-monsoon store audit..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
