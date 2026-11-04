import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Trash2, Plus, Filter, Search, RotateCcw,
  CheckCircle, DollarSign, ShieldAlert, FileText,
  Clock, ShieldCheck, ArrowRight, Building, X
} from 'lucide-react'
import {
  getDisposals,
  createDisposal,
  getCondemnations
} from '../../api/disposal.api'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import Modal from '../../components/common/Modal'
import { DataTable } from '../../components/tables/DataTable'
import ErrorState from '../../components/feedback/ErrorState'
import EmptyState from '../../components/feedback/EmptyState'
import { CardSkeleton } from '../../components/feedback/LoadingSkeleton'
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import toast from 'react-hot-toast'

export default function DisposalRegisterPage() {
  const { user, hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const officeId = user?.office?.id || user?.office_id

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMethod, setSelectedMethod] = useState('ALL')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // Execute Disposal Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [disposalMethod, setDisposalMethod] = useState('PUBLIC_AUCTION')
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().split('T')[0])
  const [totalSaleProceeds, setTotalSaleProceeds] = useState(0)
  const [recipientAgency, setRecipientAgency] = useState('')
  const [referenceOrderNumber, setReferenceOrderNumber] = useState('')
  const [disposalLines, setDisposalLines] = useState([])

  // Fetch approved condemnation requests ready for disposal
  const { data: approvedCondemnationsRes } = useQuery({
    queryKey: ['approved-condemnations', officeId],
    queryFn: () => getCondemnations({ status: 'APPROVED', limit: 50 }),
  })
  const approvedProposals = approvedCondemnationsRes?.data || []

  // Fetch real disposal records from backend
  const {
    data: disposalsRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['disposals', officeId, selectedMethod, page, limit],
    queryFn: () => {
      const params = { page, limit }
      if (officeId) params.office_id = officeId
      if (selectedMethod !== 'ALL') params.disposal_method = selectedMethod
      return getDisposals(params)
    },
  })

  const disposals = disposalsRes?.data || []
  const totalRecords = disposalsRes?.meta?.total ?? disposals.length
  const totalPages = disposalsRes?.meta?.total_pages ?? Math.max(1, Math.ceil(totalRecords / limit))

  // Local search filter
  const filteredDisposals = useMemo(() => {
    if (!searchQuery.trim()) return disposals
    const q = searchQuery.toLowerCase().trim()
    return disposals.filter((d) => (
      d.disposal_number?.toLowerCase().includes(q) ||
      d.recipient_agency?.toLowerCase().includes(q) ||
      d.reference_order_number?.toLowerCase().includes(q)
    ))
  }, [disposals, searchQuery])

  // Total realized scrap revenue across all records
  const totalRealizedRevenue = useMemo(() => {
    return disposals.reduce((acc, curr) => acc + (Number(curr.total_sale_proceeds) || 0), 0)
  }, [disposals])

  // Execute Disposal Mutation
  const executeMutation = useMutation({
    mutationFn: (payload) => createDisposal(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['disposals'] })
      queryClient.invalidateQueries({ queryKey: ['approved-condemnations'] })
      queryClient.invalidateQueries({ queryKey: ['dead-stock-register'] })
      queryClient.invalidateQueries({ queryKey: ['classification-summary'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      const created = res?.data || res
      toast.success(`Disposal ${created.disposal_number} executed! Assets written off from active inventory.`)
      setIsModalOpen(false)
      resetModalForm()
    },
    onError: (err) => {
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || 'Disposal execution failed.'
      toast.error(msg)
    },
  })

  const resetModalForm = () => {
    setSelectedRequestId('')
    setDisposalMethod('PUBLIC_AUCTION')
    setDisposalDate(new Date().toISOString().split('T')[0])
    setTotalSaleProceeds(0)
    setRecipientAgency('')
    setReferenceOrderNumber('')
    setDisposalLines([])
  }

  // When an approved proposal is selected, initialize disposal lines
  const handleSelectProposal = (reqId) => {
    setSelectedRequestId(reqId)
    const found = approvedProposals.find((p) => p.id === reqId)
    if (found && found.items) {
      const lines = found.items.map((itm) => ({
        item_id: itm.item_id,
        disposed_qty: 1,
        realized_amount: itm.assessed_scrap_value || 0,
      }))
      setDisposalLines(lines)
      const sum = lines.reduce((acc, l) => acc + (Number(l.realized_amount) || 0), 0)
      setTotalSaleProceeds(sum)
    } else {
      setDisposalLines([])
      setTotalSaleProceeds(0)
    }
  }

  const handleLineRealizedChange = (idx, value) => {
    const updated = [...disposalLines]
    updated[idx].realized_amount = Number(value) || 0
    setDisposalLines(updated)
    const sum = updated.reduce((acc, l) => acc + (Number(l.realized_amount) || 0), 0)
    setTotalSaleProceeds(sum)
  }

  const handleExecuteSubmit = (e) => {
    e.preventDefault()
    if (!officeId) {
      toast.error('Unable to determine user office identity.')
      return
    }
    if (!selectedRequestId) {
      toast.error('Please select an approved condemnation proposal.')
      return
    }
    if (!recipientAgency.trim()) {
      toast.error('Please enter the purchasing buyer / recycler agency name.')
      return
    }
    if (!referenceOrderNumber.trim()) {
      toast.error('Please enter the disposal order / auction gazette reference.')
      return
    }
    if (disposalLines.length === 0) {
      toast.error('No items to dispose.')
      return
    }

    executeMutation.mutate({
      request_id: selectedRequestId,
      office_id: officeId,
      disposal_method: disposalMethod,
      disposal_date: disposalDate,
      total_sale_proceeds: Number(totalSaleProceeds) || 0,
      recipient_agency: recipientAgency.trim(),
      reference_order_number: referenceOrderNumber.trim(),
      items: disposalLines.map((l) => ({
        item_id: l.item_id,
        disposed_qty: Number(l.disposed_qty) || 1,
        realized_amount: Number(l.realized_amount) || 0,
      })),
    })
  }

  const columns = [
    {
      key: 'disposal_number',
      header: 'Disposal Reference',
      render: (_, row) => (
        <div>
          <div className="font-mono font-bold text-slate-900 dark:text-emerald-400">
            {row.disposal_number}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Order: {row.reference_order_number}
          </div>
        </div>
      ),
    },
    {
      key: 'disposal_method',
      header: 'Regulated Method',
      render: (_, row) => {
        const methodBadges = {
          PUBLIC_AUCTION: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
          E_WASTE_RECYCLING: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
          SCRAP_SALE: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
          BUYBACK: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
          DESTRUCTION_BURIAL: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
          DONATION_TRANSFER: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20',
        }
        return (
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              methodBadges[row.disposal_method] || 'bg-slate-100 text-slate-700'
            }`}
          >
            {row.disposal_method}
          </span>
        )
      },
    },
    {
      key: 'recipient_agency',
      header: 'Purchasing Agency / Recipient',
      render: (_, row) => (
        <div className="max-w-xs">
          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
            {row.recipient_agency}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {row.items?.length || 1} asset(s) derecognized
          </p>
        </div>
      ),
    },
    {
      key: 'total_sale_proceeds',
      header: 'Proceeds Realized',
      align: 'right',
      render: (_, row) => (
        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">
          {formatCurrency(row.total_sale_proceeds)}
        </span>
      ),
    },
    {
      key: 'disposal_date',
      header: 'Execution Date',
      render: (_, row) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {formatDate(row.disposal_date)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Official Regulated Disposal Register & Scrap Ledger"
        subtitle="Statutory archive of auctioned, scrapped, recycled, or destroyed government assets"
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.CONDEMNATIONS}>
              <Button variant="secondary" size="sm" leftIcon={<ShieldAlert size={14} />}>
                Condemnation Dossiers
              </Button>
            </Link>
            {hasPermission(PERMISSIONS.DISPOSAL_EXECUTE) && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => setIsModalOpen(true)}
              >
                Execute Regulated Disposal
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard level={1} className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Completed Disposals
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              {formatNumber(totalRecords)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Statutory write-offs executed
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-forest-500/10 text-forest-600 dark:text-forest-300 border border-forest-500/20 flex items-center justify-center">
            <Trash2 size={20} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Total Scrap Proceeds Realized
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
              {formatCurrency(totalRealizedRevenue)}
            </p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
              Credited to Panchayat revenue account
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 flex items-center justify-center">
            <DollarSign size={20} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Sanctioned Ready for Disposal
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-800 dark:text-amber-200 mt-1">
              {formatNumber(approvedProposals.length)}
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
              Approved condemnation orders
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 flex items-center justify-center">
            <ShieldCheck size={20} />
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
            placeholder="Search disposals by number, agency, order..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="font-semibold text-slate-600 dark:text-slate-400">Method:</label>
          <select
            value={selectedMethod}
            onChange={(e) => {
              setSelectedMethod(e.target.value)
              setPage(1)
            }}
            className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Regulated Methods</option>
            <option value="PUBLIC_AUCTION">Public Auction</option>
            <option value="E_WASTE_RECYCLING">E-Waste Recycling</option>
            <option value="SCRAP_SALE">Scrap Sale</option>
            <option value="BUYBACK">Buyback Scheme</option>
            <option value="DESTRUCTION_BURIAL">Destruction / Burial</option>
            <option value="DONATION_TRANSFER">Donation / Transfer</option>
          </select>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw size={13} />}
            onClick={() => {
              setSearchQuery('')
              setSelectedMethod('ALL')
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
          title="Error Loading Disposal Register"
          message={
            error?.response?.data?.error?.message ||
            error?.response?.data?.detail ||
            'Unable to fetch disposal register from PostgreSQL. Verify FastAPI backend service is online.'
          }
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredDisposals}
          isLoading={isLoading}
          page={page}
          limit={limit}
          total={totalRecords}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={setLimit}
          emptyTitle="No Disposals Recorded"
          emptyDescription="There are no completed regulated disposals in the PostgreSQL register for this office."
        />
      )}

      {/* Execute Regulated Disposal Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Execute Regulated Disposal & Asset Write-Off"
          size="lg"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={executeMutation.isPending}
                onClick={handleExecuteSubmit}
              >
                Execute Write-Off & Derecognize
              </Button>
            </>
          }
        >
          <form onSubmit={handleExecuteSubmit} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-200">
              <strong>Irreversible Write-Off Warning:</strong> Executing disposal commits a <code>DISPOSAL_WRITEOFF</code> transaction to the movement ledger, sets item status to <code>DISPOSED</code> in PostgreSQL, and permanently locks the items from future store issues or transfers.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Approved Condemnation Proposal <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedRequestId}
                  onChange={(e) => handleSelectProposal(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                >
                  <option value="">-- Choose Sanctioned Proposal --</option>
                  {approvedProposals.map((prop) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.request_number} ({prop.reason_code}) – {prop.items?.length || 1} asset(s)
                    </option>
                  ))}
                </select>
                {approvedProposals.length === 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    No approved condemnation proposals available. Propose and approve a condemnation first.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Regulated Disposal Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={disposalMethod}
                  onChange={(e) => setDisposalMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="PUBLIC_AUCTION">PUBLIC_AUCTION (Highest Bidder Open E-Auction)</option>
                  <option value="E_WASTE_RECYCLING">E_WASTE_RECYCLING (Authorized State Pollution Control Board Recycler)</option>
                  <option value="SCRAP_SALE">SCRAP_SALE (Direct Scrap Dealer Tender / GeM)</option>
                  <option value="BUYBACK">BUYBACK (Vendor OEM Exchange Scheme)</option>
                  <option value="DESTRUCTION_BURIAL">DESTRUCTION_BURIAL (Biological / Unusable Waste Burial)</option>
                  <option value="DONATION_TRANSFER">DONATION_TRANSFER (Inter-Departmental Transfer)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Disposal / Auction Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={disposalDate}
                  onChange={(e) => setDisposalDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Purchaser / Recipient Agency <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={recipientAgency}
                  onChange={(e) => setRecipientAgency(e.target.value)}
                  placeholder="e.g. M/s Gujarat E-Waste Recyclers"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sanction Order / Challan No <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={referenceOrderNumber}
                  onChange={(e) => setReferenceOrderNumber(e.target.value)}
                  placeholder="e.g. DDO/AUCTION/2026/088"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl font-mono bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Line items table */}
            {disposalLines.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-emerald-500/15">
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                  <span>Items to be Disposed ({disposalLines.length})</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-300">
                    Total Proceeds: {formatCurrency(totalSaleProceeds)}
                  </span>
                </div>

                <div className="overflow-x-auto max-h-48 scrollbar-thin">
                  <table className="w-full text-left text-xs data-table">
                    <thead>
                      <tr>
                        <th>Item ID</th>
                        <th>Qty</th>
                        <th>Realized Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disposalLines.map((line, idx) => (
                        <tr key={line.item_id}>
                          <td className="font-mono font-bold text-slate-900 dark:text-emerald-400">
                            {String(line.item_id).slice(0, 16)}…
                          </td>
                          <td className="font-mono">1</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.realized_amount}
                              onChange={(e) => handleLineRealizedChange(idx, e.target.value)}
                              className="w-28 px-2 py-1 border border-slate-300 dark:border-emerald-500/25 rounded-lg font-mono bg-white dark:bg-[#0E1D19] text-slate-900 dark:text-white"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  )
}
