import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Printer, ShieldCheck, CheckCircle2, XCircle, Truck,
  Building, User, FileText, ArrowRight, Clock, AlertTriangle, Calendar
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import LoadingSkeleton from '../../components/feedback/LoadingSkeleton'
import ErrorState from '../../components/feedback/ErrorState'
import {
  getTransfer,
  approveTransfer,
  dispatchTransfer,
  completeTransfer,
} from '../../api/transactions.api'
import { formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import { useLanguage } from '../../i18n'
import toast from 'react-hot-toast'

export default function TransferDetailPage() {
  const { id } = useParams()
  const { user, hasPermission } = useAuth()
  const { t } = useLanguage()

  // Modals state
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [carrierName, setCarrierName] = useState('Gujarat State Road Transport Parcel Service')
  const [waybillNumber, setWaybillNumber] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('GJ-11-GA-9041')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
  )
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [ackOfficer, setAckOfficer] = useState(user?.full_name || 'Destination Store Officer')
  const [ackRemarks, setAckRemarks] = useState('All items received and verified at destination store.')
  const [discrepancyReported, setDiscrepancyReported] = useState(false)

  const [isProcessing, setIsProcessing] = useState(false)

  const { data: transferData, isLoading, isError, refetch } = useQuery({
    queryKey: ['transfer', id],
    queryFn: () => getTransfer(id),
  })

  const transfer = transferData?.data || transferData || {}

  const canApprove = hasPermission(PERMISSIONS.STOCK_TRANSFER_APP) || user?.role?.name === 'SYSTEM_ADMIN' || user?.role?.name === 'STORE_OFFICER'
  const canComplete = hasPermission(PERMISSIONS.STOCK_TRANSFER_COMP) || hasPermission(PERMISSIONS.STOCK_TRANSFER_REQ)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 rounded w-72 animate-pulse" />
        <LoadingSkeleton rows={5} />
      </div>
    )
  }

  if (isError || !transfer.id) {
    return <ErrorState message={t('transactions.transfers.detail.notFound')} onRetry={refetch} />
  }

  const handleApprove = async () => {
    setIsProcessing(true)
    try {
      await approveTransfer(id, { action: 'APPROVE' }, user?.full_name || 'Store Officer')
      toast.success(t('transactions.transfers.detail.toastApproved'))
      refetch()
    } catch (err) {
      toast.error(err.message || t('transactions.transfers.detail.toastApproveFail'))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error(t('transactions.transfers.detail.toastRejectReason'))
      return
    }
    setIsProcessing(true)
    try {
      await approveTransfer(id, { action: 'REJECT', reason: rejectReason }, user?.full_name || 'Store Officer')
      toast.success(t('transactions.transfers.detail.toastRejected'))
      setShowRejectModal(false)
      refetch()
    } catch (err) {
      toast.error(err.message || t('transactions.transfers.detail.toastRejectFail'))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDispatch = async () => {
    if (!waybillNumber.trim()) {
      toast.error(t('transactions.transfers.detail.toastWaybillReq'))
      return
    }
    setIsProcessing(true)
    try {
      await dispatchTransfer(
        id,
        {
          carrier_name: carrierName,
          waybill_number: waybillNumber,
          vehicle_number: vehicleNumber,
          expected_delivery_date: expectedDeliveryDate,
        },
        user?.full_name || 'Store Officer'
      )
      toast.success(t('transactions.transfers.detail.toastDispatched'))
      setShowDispatchModal(false)
      refetch()
    } catch (err) {
      toast.error(err.message || t('transactions.transfers.detail.toastDispatchFail'))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleComplete = async () => {
    setIsProcessing(true)
    try {
      await completeTransfer(
        id,
        {
          received_by: ackOfficer,
          remarks: ackRemarks,
          discrepancy_reported: discrepancyReported,
        },
        user?.full_name || 'Store Staff'
      )
      toast.success(t('transactions.transfers.detail.toastCompleted'))
      setShowCompleteModal(false)
      refetch()
    } catch (err) {
      toast.error(err.message || t('transactions.transfers.detail.toastCompleteFail'))
    } finally {
      setIsProcessing(false)
    }
  }

  const steps = [
    { key: 'SUBMITTED', label: t('transactions.transfers.detail.step1'), done: true },
    {
      key: 'APPROVED',
      label: t('transactions.transfers.detail.step2'),
      done: ['APPROVED', 'IN_TRANSIT', 'COMPLETED'].includes(transfer.status),
    },
    {
      key: 'IN_TRANSIT',
      label: t('transactions.transfers.detail.step3'),
      done: ['IN_TRANSIT', 'COMPLETED'].includes(transfer.status),
    },
    {
      key: 'COMPLETED',
      label: t('transactions.transfers.detail.step4'),
      done: transfer.status === 'COMPLETED',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('transactions.transfers.detail.titlePrefix', { number: transfer.transfer_number })}
        subtitle={t('transactions.transfers.detail.subtitle', {
          type: transfer.transfer_type === 'PERMANENT' ? t('transactions.transfers.detail.permanentTransfer') : t('transactions.transfers.detail.temporaryLoan'),
          status: transfer.status,
        })}
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.TRANSFERS}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                {t('transactions.transfers.detail.backToRegister')}
              </Button>
            </Link>
            <Button variant="secondary" size="sm" leftIcon={<Printer size={14} />} onClick={() => window.print()}>
              {t('transactions.transfers.detail.printWaybill')}
            </Button>

            {/* Stage Actions */}
            {transfer.status === 'SUBMITTED' && canApprove && (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<XCircle size={14} />}
                  onClick={() => setShowRejectModal(true)}
                >
                  {t('transactions.transfers.detail.reject')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CheckCircle2 size={14} />}
                  loading={isProcessing}
                  onClick={handleApprove}
                >
                  {t('transactions.transfers.detail.approveTransfer')}
                </Button>
              </>
            )}

            {transfer.status === 'APPROVED' && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Truck size={14} />}
                onClick={() => setShowDispatchModal(true)}
              >
                {t('transactions.transfers.detail.dispatchItems')}
              </Button>
            )}

            {transfer.status === 'IN_TRANSIT' && canComplete && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<ShieldCheck size={14} />}
                onClick={() => setShowCompleteModal(true)}
              >
                {t('transactions.transfers.detail.acknowledgeComplete')}
              </Button>
            )}
          </div>
        }
      />

      {/* Stepper Lifecycle */}
      <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-5 shadow-sm">
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          {steps.map((st, i) => (
            <div key={st.key} className="space-y-1.5">
              <div
                className={`h-2 rounded-full ${st.done
                  ? 'bg-emerald-600'
                  : transfer.status === 'REJECTED'
                    ? 'bg-rose-500'
                    : 'bg-slate-200 dark:bg-slate-700'
                  }`}
              />
              <span className={`font-semibold ${st.done ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-500'}`}>
                {st.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Status Warning / Audit Banner */}
      {transfer.status === 'COMPLETED' && (
        <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-700 dark:text-emerald-400" />
            <span>
              <strong>{t('transactions.transfers.detail.completedBanner')}</strong>{' '}
              {t('transactions.transfers.detail.completedDesc', {
                office: transfer.destination_office,
                date: formatDate(transfer.completed_at),
                by: transfer.received_by,
              })}
            </span>
          </div>
          <span className="font-mono text-emerald-800 dark:text-emerald-300 font-bold">{t('transactions.transfers.detail.locked')}</span>
        </div>
      )}

      {transfer.status === 'IN_TRANSIT' && (
        <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <Truck size={18} className="text-blue-700 dark:text-blue-400" />
            <span>
              <strong>{t('transactions.transfers.detail.inTransitBanner')}</strong>{' '}
              {t('transactions.transfers.detail.inTransitDesc', {
                carrier: transfer.carrier_name,
                waybill: transfer.waybill_number,
                vehicle: transfer.vehicle_number || t('transactions.transfers.detail.officialVehicle'),
              })}
            </span>
          </div>
          <StatusBadge status="IN_TRANSIT" size="sm" />
        </div>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 dark:border-emerald-500/15 pb-2">
            <Building size={14} className="text-emerald-600 dark:text-emerald-400" />
            {t('transactions.transfers.detail.sectionOffices')}
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.transfers.detail.sourceStore')}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{transfer.source_office}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.transfers.detail.destOffice')}</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">{transfer.destination_office}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.transfers.detail.destRoom')}</span>
              <span className="text-slate-800 dark:text-slate-200">{transfer.destination_location || t('transactions.transfers.detail.centralBay')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.transfers.detail.adminOrder')}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{transfer.order_reference}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.transfers.detail.transferReason')}</span>
              <span className="text-slate-900 dark:text-white font-medium">{transfer.reason}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 dark:border-emerald-500/15 pb-2">
            <Clock size={14} className="text-emerald-600 dark:text-emerald-400" />
            {t('transactions.transfers.detail.sectionTimeline')}
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.transfers.detail.requestedBy')}</span>
              <span className="text-slate-800 dark:text-slate-200">{transfer.requested_by} {t('transactions.transfers.detail.onDate')} {formatDate(transfer.request_date)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.transfers.detail.sanctionedBy')}</span>
              <span className="text-slate-800 dark:text-slate-200">{transfer.approved_by || t('transactions.transfers.detail.pendingReview')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.transfers.detail.dispatchDetails')}</span>
              <span className="text-slate-800 dark:text-slate-200">{transfer.dispatched_at ? `${transfer.carrier_name} (${formatDate(transfer.dispatched_at)})` : t('transactions.transfers.detail.notDispatched')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.transfers.detail.destAck')}</span>
              <span className="text-slate-800 dark:text-slate-200">{transfer.completed_at ? `${transfer.received_by} (${formatDate(transfer.completed_at)})` : t('transactions.transfers.detail.pendingArrival')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Relocated Items Schedule */}
      <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-emerald-500/15 flex items-center justify-between bg-slate-50/70 dark:bg-[#0A1513]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText size={15} className="text-emerald-600 dark:text-emerald-400" />
            {t('transactions.transfers.detail.scheduleTitle', { count: transfer.items?.length || 0 })}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 dark:bg-[#0A1513] border-b border-slate-200 dark:border-emerald-500/20 text-slate-700 dark:text-emerald-300 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">#</th>
                <th className="py-2.5 px-4">{t('transactions.issues.detail.colItemNameCode')}</th>
                <th className="py-2.5 px-3">{t('transactions.issues.detail.colType')}</th>
                <th className="py-2.5 px-4">{t('transactions.issues.detail.colSerialNumber')}</th>
                <th className="py-2.5 px-3 text-center">{t('transactions.transfers.detail.colTransferQty')}</th>
                <th className="py-2.5 px-4">{t('transactions.transfers.detail.colMasterStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-emerald-500/10 text-slate-800 dark:text-slate-200">
              {transfer.items?.map((line, idx) => (
                <tr key={line.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 dark:text-white block text-xs">{line.item_name}</span>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{line.item_code}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-[#081210] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-emerald-500/20">
                      {line.item_type === 'DURABLE_ASSET' ? t('transactions.issues.detail.typeDurable') : t('transactions.issues.detail.typeConsumable')}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">{line.serial_number || 'N/A'}</td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                    {line.quantity} {line.uom}
                  </td>
                  <td className="py-3 px-4">
                    {transfer.status === 'COMPLETED' ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{t('transactions.transfers.detail.activeAtDest')}</span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">{t('transactions.transfers.detail.inRelocation')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title={t('transactions.transfers.detail.rejectModalTitle')}
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            {t('transactions.transfers.detail.rejectModalPrompt', { number: transfer.transfer_number })}
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder={t('transactions.transfers.detail.rejectPlaceholder')}
            className="w-full p-2.5 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-rose-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowRejectModal(false)}>
              {t('transactions.transfers.create.cancel')}
            </Button>
            <Button variant="danger" size="sm" loading={isProcessing} onClick={handleReject}>
              {t('transactions.transfers.detail.confirmRejection')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Dispatch Modal */}
      <Modal
        isOpen={showDispatchModal}
        onClose={() => setShowDispatchModal(false)}
        title={t('transactions.transfers.detail.dispatchModalTitle')}
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('transactions.transfers.detail.carrierLabel')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('transactions.transfers.detail.waybillLabel')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={waybillNumber}
              onChange={(e) => setWaybillNumber(e.target.value)}
              placeholder={t('transactions.transfers.detail.waybillPlaceholder')}
              className="w-full px-3 py-1.5 border border-slate-300 dark:border-emerald-500/25 rounded-xl font-mono bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('transactions.transfers.detail.vehicleLabel')}
            </label>
            <input
              type="text"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 dark:border-emerald-500/25 rounded-xl font-mono bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('transactions.transfers.detail.expectedDeliveryLabel')}
            </label>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowDispatchModal(false)}>
              {t('transactions.transfers.create.cancel')}
            </Button>
            <Button variant="primary" size="sm" loading={isProcessing} onClick={handleDispatch}>
              {t('transactions.transfers.detail.confirmDispatch')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Complete Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title={t('transactions.transfers.detail.completeModalTitle')}
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            {t('transactions.transfers.detail.completeModalDesc', { office: transfer.destination_office })}
          </p>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('transactions.transfers.detail.receivingOfficerLabel')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={ackOfficer}
              onChange={(e) => setAckOfficer(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('transactions.transfers.detail.ackNotesLabel')}
            </label>
            <input
              type="text"
              value={ackRemarks}
              onChange={(e) => setAckRemarks(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={discrepancyReported}
              onChange={(e) => setDiscrepancyReported(e.target.checked)}
              className="rounded text-red-600 border-slate-300 dark:border-emerald-500/30"
            />
            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              {t('transactions.transfers.detail.reportDiscrepancy')}
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowCompleteModal(false)}>
              {t('transactions.transfers.create.cancel')}
            </Button>
            <Button variant="primary" size="sm" loading={isProcessing} onClick={handleComplete}>
              {t('transactions.transfers.detail.ackTransferBtn')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
