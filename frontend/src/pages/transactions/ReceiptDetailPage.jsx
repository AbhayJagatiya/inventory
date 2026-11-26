import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Printer, CheckCircle2, Building,
  FileText, ShieldCheck, Clock, Package
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import LoadingSkeleton from '../../components/feedback/LoadingSkeleton'
import ErrorState from '../../components/feedback/ErrorState'
import { getReceipt, postReceipt } from '../../api/transactions.api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import { useLanguage } from '../../i18n'
import { translateEnum, translateMasterName } from '../../i18n/enumLabels'
import toast from 'react-hot-toast'

export default function ReceiptDetailPage() {
  const { id } = useParams()
  const { user, hasPermission } = useAuth()
  const { t } = useLanguage()

  const [isPosting, setIsPosting] = useState(false)
  const [showConfirmPost, setShowConfirmPost] = useState(false)

  const { data: receiptData, isLoading, isError, refetch } = useQuery({
    queryKey: ['receipt', id],
    queryFn: () => getReceipt(id),
  })

  const receipt = receiptData?.data || receiptData || {}
  const canPost = hasPermission(PERMISSIONS.STOCK_RECEIPT_CREATE) && receipt.status === 'DRAFT'

  const handleConfirmPost = async () => {
    setShowConfirmPost(false)
    setIsPosting(true)
    try {
      await postReceipt(id, user?.full_name || t('transactions.returns.detail.storeOfficer'))
      toast.success(t('transactions.receipts.messages.posted'))
      refetch()
    } catch (err) {
      toast.error(err.message || t('toast.error'))
    } finally {
      setIsPosting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 rounded w-72 animate-pulse" />
        <LoadingSkeleton rows={5} />
      </div>
    )
  }

  if (isError || !receipt.id) {
    return <ErrorState message={t('feedback.error.message')} onRetry={refetch} />
  }

  const isPosted = receipt.status === 'POSTED'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t('transactions.receipts.detail')}: ${receipt.voucher_number}`}
        subtitle={`${t('labels.date')}: ${formatDate(receipt.receipt_date)} · ${t('labels.status')}: ${translateEnum(t, receipt.status)}`}
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.RECEIPTS}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                {t('actions.back')}
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Printer size={14} />}
              onClick={() => window.print()}
            >
              {t('actions.print')}
            </Button>
            {canPost && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<CheckCircle2 size={14} />}
                loading={isPosting}
                onClick={() => setShowConfirmPost(true)}
              >
                {t('actions.confirm')}
              </Button>
            )}
          </div>
        }
      />

      {/* Audit Banner */}
      {isPosted ? (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-emerald-900 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck size={18} className="text-emerald-700" />
            <span>
              <strong>{t('transactions.receipts.detailPage.voucherPostedLabel')}</strong>{' '}
              {t('transactions.receipts.detailPage.voucherPostedDesc', {
                date: formatDate(receipt.posted_at || receipt.receipt_date),
                by: receipt.posted_by || t('transactions.returns.detail.storeOfficer'),
              })}
            </span>
          </div>
          <span className="font-mono text-emerald-800 font-bold">
            {t('transactions.receipts.detailPage.lockedBadge')}
          </span>
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between text-amber-900 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <Clock size={16} className="text-amber-700" />
            <span>
              <strong>{t('transactions.receipts.detailPage.draftBannerLabel')}</strong>{' '}
              {t('transactions.receipts.detailPage.draftBannerDesc')}
            </span>
          </div>
          <StatusBadge status="DRAFT" size="sm" />
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Supplier & Procurement */}
        <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 dark:border-emerald-500/15 pb-2">
            <Building size={14} className="text-emerald-600 dark:text-emerald-400" />
            {t('transactions.receipts.detailPage.sectionSupplier')}
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">
                {t('transactions.receipts.detailPage.supplierVendor')}
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">{receipt.supplier_name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">
                {t('transactions.receipts.detailPage.supplierContact')}
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{receipt.supplier_contact || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">
                {t('transactions.receipts.detailPage.poContract')}
              </span>
              <span className="font-mono font-medium text-slate-900 dark:text-white">
                {receipt.po_number || t('transactions.receipts.directProc')}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">
                {t('transactions.receipts.detailPage.supplierInvoice')}
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{receipt.invoice_number || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">
                {t('transactions.receipts.detailPage.invoiceDate')}
              </span>
              <span className="text-slate-800 dark:text-slate-200">
                {receipt.invoice_date ? formatDate(receipt.invoice_date) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Receiving Office */}
        <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 dark:border-emerald-500/15 pb-2">
            <Package size={14} className="text-emerald-600 dark:text-emerald-400" />
            {t('transactions.receipts.detailPage.sectionReceiving')}
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">
                {t('transactions.receipts.detailPage.receivingOffice')}
              </span>
              <span className="font-medium text-slate-900 dark:text-white">{receipt.receiving_office}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">
                {t('transactions.receipts.detailPage.storeRoomBay')}
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {receipt.receiving_location || t('transactions.receipts.detailPage.centralStore')}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">
                {t('transactions.receipts.detailPage.receivingOfficer')}
              </span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {receipt.receiving_officer || t('transactions.returns.detail.storeOfficer')}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">
                {t('transactions.receipts.detailPage.challanAttachment')}
              </span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400 underline cursor-pointer">
                {receipt.attachment_name || 'Challan_Document.pdf'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">
                {t('transactions.receipts.detailPage.totalAcceptedVal')}
              </span>
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                {formatCurrency(receipt.total_accepted_value || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Items Table */}
      <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-emerald-500/15 flex items-center justify-between bg-slate-50/70 dark:bg-[#0A1513]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText size={15} className="text-emerald-600 dark:text-emerald-400" />
            {t('transactions.receipts.detailPage.scheduleHeading', { count: receipt.items?.length || 0 })}
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('transactions.receipts.detailPage.valuesInInr')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 dark:bg-[#0A1513] border-b border-slate-200 dark:border-emerald-500/20 text-slate-700 dark:text-emerald-300 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">#</th>
                <th className="py-2.5 px-4">{t('transactions.receipts.detailPage.colItemType')}</th>
                <th className="py-2.5 px-3 text-center">{t('transactions.receipts.detailPage.colOrdered')}</th>
                <th className="py-2.5 px-3 text-center">{t('transactions.receipts.detailPage.colReceived')}</th>
                <th className="py-2.5 px-3 text-center text-emerald-700 dark:text-emerald-400">
                  {t('transactions.receipts.detailPage.colAccepted')}
                </th>
                <th className="py-2.5 px-3 text-center text-rose-600 dark:text-rose-400">
                  {t('transactions.receipts.detailPage.colRejected')}
                </th>
                <th className="py-2.5 px-4">{t('transactions.receipts.detailPage.colRejectionReason')}</th>
                <th className="py-2.5 px-4 text-right">{t('transactions.receipts.detailPage.colUnitCost')}</th>
                <th className="py-2.5 px-4 text-right">{t('transactions.receipts.detailPage.colAcceptedTotal')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-emerald-500/10 text-slate-800 dark:text-slate-200">
              {receipt.items?.map((line, idx) => (
                <tr key={line.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 dark:text-white block text-xs">{line.item_name}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {translateEnum(t, line.item_type)} · {translateMasterName(t, 'uom', line.uom, line.uom)}
                    </span>
                    {line.serial_numbers && line.serial_numbers.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {line.serial_numbers.map((sn, sIdx) => (
                          <span
                            key={sIdx}
                            className="font-mono text-[10px] bg-slate-100 dark:bg-[#081210] text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-emerald-500/20"
                          >
                            SN: {sn}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center font-mono">{line.quantity_ordered}</td>
                  <td className="py-3 px-3 text-center font-mono font-medium">{line.quantity_received}</td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/40 dark:bg-emerald-500/10">
                    {line.quantity_accepted}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50/40 dark:bg-rose-950/20">
                    {line.quantity_rejected || 0}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                    {line.rejection_reason || '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                    {formatCurrency(line.unit_cost)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(line.total_accepted_cost || (line.quantity_accepted * line.unit_cost))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 dark:bg-[#0A1513] border-t border-slate-200 dark:border-emerald-500/20 font-semibold text-xs text-slate-900 dark:text-white">
              <tr>
                <td colSpan={8} className="py-3 px-4 text-right uppercase tracking-wide">
                  {t('transactions.receipts.detailPage.totalValuationLabel')}
                </td>
                <td className="py-3 px-4 text-right font-mono text-sm text-emerald-700 dark:text-emerald-400 font-bold">
                  {formatCurrency(receipt.total_accepted_value || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirmPost}
        onClose={() => setShowConfirmPost(false)}
        onConfirm={handleConfirmPost}
        title={t('transactions.receipts.detailPage.confirmTitle')}
        message={t('transactions.receipts.detailPage.confirmMessage')}
        confirmText={t('transactions.receipts.detailPage.confirmBtn')}
        variant="primary"
      />
    </div>
  )
}
