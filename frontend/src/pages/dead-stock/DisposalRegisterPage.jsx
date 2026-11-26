import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Trash2, Plus, Search, RotateCcw,
  DollarSign, ShieldAlert, ShieldCheck
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
import StatusBadge from '../../components/common/StatusBadge'
import { DataTable } from '../../components/tables/DataTable'
import ErrorState from '../../components/feedback/ErrorState'
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import toast from 'react-hot-toast'
import { useLanguage } from '../../i18n'
import { translateEnum } from '../../i18n/enumLabels'

export default function DisposalRegisterPage() {
  const { user, hasPermission } = useAuth()
  const { t } = useLanguage()
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
      toast.success(
        t('deadStock.disposal.toastExecuted', { number: created.disposal_number || '' })
      )
      setIsModalOpen(false)
      resetModalForm()
    },
    onError: (err) => {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        t('deadStock.disposal.toastExecuteFail')
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
      toast.error(t('deadStock.disposal.errOfficeId'))
      return
    }
    if (!selectedRequestId) {
      toast.error(t('deadStock.disposal.errSelectProposal'))
      return
    }
    if (!recipientAgency.trim()) {
      toast.error(t('deadStock.disposal.errRecipient'))
      return
    }
    if (!referenceOrderNumber.trim()) {
      toast.error(t('deadStock.disposal.errOrderRef'))
      return
    }
    if (disposalLines.length === 0) {
      toast.error(t('deadStock.disposal.errNoItems'))
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
      header: t('deadStock.disposal.colDisposalRef'),
      render: (_, row) => (
        <div>
          <div className="font-mono font-bold text-slate-900 dark:text-emerald-400">
            {row.disposal_number}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {t('deadStock.disposal.orderPrefix')} {row.reference_order_number}
          </div>
        </div>
      ),
    },
    {
      key: 'disposal_method',
      header: t('deadStock.disposal.colRegulatedMethod'),
      render: (_, row) => <StatusBadge status={row.disposal_method} size="xs" />,
    },
    {
      key: 'recipient_agency',
      header: t('deadStock.disposal.colPurchasingAgency'),
      render: (_, row) => (
        <div className="max-w-xs">
          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
            {row.recipient_agency}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t('deadStock.disposal.assetsDerecognized', { count: row.items?.length || 1 })}
          </p>
        </div>
      ),
    },
    {
      key: 'total_sale_proceeds',
      header: t('deadStock.disposal.colProceedsRealized'),
      align: 'right',
      render: (_, row) => (
        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">
          {formatCurrency(row.total_sale_proceeds)}
        </span>
      ),
    },
    {
      key: 'disposal_date',
      header: t('deadStock.disposal.colExecutionDate'),
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
        title={t('deadStock.disposal.pageTitle')}
        subtitle={t('deadStock.disposal.subtitle')}
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.CONDEMNATIONS}>
              <Button variant="secondary" size="sm" leftIcon={<ShieldAlert size={14} />}>
                {t('deadStock.disposal.btnCondemnationDossiers')}
              </Button>
            </Link>
            {hasPermission(PERMISSIONS.DISPOSAL_EXECUTE) && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => setIsModalOpen(true)}
              >
                {t('deadStock.disposal.btnExecuteDisposal')}
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
              {t('deadStock.disposal.kpiCompletedTitle')}
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              {formatNumber(totalRecords)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('deadStock.disposal.kpiCompletedSub')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-forest-500/10 text-forest-600 dark:text-forest-300 border border-forest-500/20 flex items-center justify-center">
            <Trash2 size={20} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {t('deadStock.disposal.kpiProceedsTitle')}
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
              {formatCurrency(totalRealizedRevenue)}
            </p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
              {t('deadStock.disposal.kpiProceedsSub')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 flex items-center justify-center">
            <DollarSign size={20} />
          </div>
        </GlassCard>

        <GlassCard level={1} className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              {t('deadStock.disposal.kpiReadyTitle')}
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-800 dark:text-amber-200 mt-1">
              {formatNumber(approvedProposals.length)}
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
              {t('deadStock.disposal.kpiReadySub')}
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
            placeholder={t('deadStock.disposal.searchPlaceholderFull')}
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="font-semibold text-slate-600 dark:text-slate-400">
            {t('deadStock.disposal.methodLabel')}
          </label>
          <select
            value={selectedMethod}
            onChange={(e) => {
              setSelectedMethod(e.target.value)
              setPage(1)
            }}
            className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">{t('deadStock.disposal.allMethods')}</option>
            <option value="PUBLIC_AUCTION">{t('deadStock.disposal.methodPublicAuction')}</option>
            <option value="E_WASTE_RECYCLING">{t('deadStock.disposal.methodEWaste')}</option>
            <option value="SCRAP_SALE">{t('deadStock.disposal.methodScrapSale')}</option>
            <option value="BUYBACK">{t('deadStock.disposal.methodBuyback')}</option>
            <option value="DESTRUCTION_BURIAL">{t('deadStock.disposal.methodDestructionBurial')}</option>
            <option value="DONATION_TRANSFER">{t('deadStock.disposal.methodDonationTransfer')}</option>
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
            {t('actions.reset')}
          </Button>
        </div>
      </GlassCard>

      {/* Main Table */}
      {isError ? (
        <ErrorState
          title={t('deadStock.disposal.loadErrorTitle')}
          message={
            error?.response?.data?.error?.message ||
            error?.response?.data?.detail ||
            t('deadStock.disposal.loadErrorMsg')
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
          emptyTitle={t('deadStock.disposal.emptyTitle')}
          emptyDescription={t('deadStock.disposal.emptyDesc')}
        />
      )}

      {/* Execute Regulated Disposal Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={t('deadStock.disposal.modalTitle')}
          size="lg"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                {t('actions.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={executeMutation.isPending}
                onClick={handleExecuteSubmit}
              >
                {t('deadStock.disposal.btnExecuteWriteOff')}
              </Button>
            </>
          }
        >
          <form onSubmit={handleExecuteSubmit} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-200">
              <strong>{t('deadStock.disposal.warningTitle')}</strong>{' '}
              {t('deadStock.disposal.warningBody')}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('deadStock.disposal.selectProposalLabel')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedRequestId}
                  onChange={(e) => handleSelectProposal(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                >
                  <option value="">{t('deadStock.disposal.chooseProposalOpt')}</option>
                  {approvedProposals.map((prop) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.request_number} ({translateEnum(t, prop.reason_code)}) –{' '}
                      {t('deadStock.disposal.optionAssetsSuffix', { count: prop.items?.length || 1 })}
                    </option>
                  ))}
                </select>
                {approvedProposals.length === 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    {t('deadStock.disposal.noApprovedMsg')}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('deadStock.disposal.regulatedMethodLabel')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={disposalMethod}
                  onChange={(e) => setDisposalMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="PUBLIC_AUCTION">{t('deadStock.disposal.methodPublicAuctionOpt')}</option>
                  <option value="E_WASTE_RECYCLING">{t('deadStock.disposal.methodEWasteOpt')}</option>
                  <option value="SCRAP_SALE">{t('deadStock.disposal.methodScrapSaleOpt')}</option>
                  <option value="BUYBACK">{t('deadStock.disposal.methodBuybackOpt')}</option>
                  <option value="DESTRUCTION_BURIAL">{t('deadStock.disposal.methodDestructionBurialOpt')}</option>
                  <option value="DONATION_TRANSFER">{t('deadStock.disposal.methodDonationTransferOpt')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('deadStock.disposal.disposalDateLabel')} <span className="text-red-500">*</span>
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
                  {t('deadStock.disposal.recipientAgencyLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={recipientAgency}
                  onChange={(e) => setRecipientAgency(e.target.value)}
                  placeholder={t('deadStock.disposal.recipientPlaceholder')}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('deadStock.disposal.orderChallanLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={referenceOrderNumber}
                  onChange={(e) => setReferenceOrderNumber(e.target.value)}
                  placeholder={t('deadStock.disposal.orderPlaceholder')}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl font-mono bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Line items table */}
            {disposalLines.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-emerald-500/15">
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                  <span>{t('deadStock.disposal.itemsToDispose', { count: disposalLines.length })}</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-300">
                    {t('deadStock.disposal.totalProceedsLabel')} {formatCurrency(totalSaleProceeds)}
                  </span>
                </div>

                <div className="overflow-x-auto max-h-48 scrollbar-thin">
                  <table className="w-full text-left text-xs data-table">
                    <thead>
                      <tr>
                        <th>{t('deadStock.disposal.colItemId')}</th>
                        <th>{t('deadStock.disposal.colQty')}</th>
                        <th>{t('deadStock.disposal.colRealizedAmount')}</th>
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
