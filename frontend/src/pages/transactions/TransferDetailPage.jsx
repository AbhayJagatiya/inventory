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
import toast from 'react-hot-toast'

export default function TransferDetailPage() {
  const { id } = useParams()
  const { user, hasPermission } = useAuth()

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
    return <ErrorState message="Could not locate transfer record." onRetry={refetch} />
  }

  const handleApprove = async () => {
    setIsProcessing(true)
    try {
      await approveTransfer(id, { action: 'APPROVE' }, user?.full_name || 'Store Officer')
      toast.success('Transfer approved! Items ready for dispatch.')
      refetch()
    } catch (err) {
      toast.error(err.message || 'Failed to approve transfer.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please specify a rejection reason.')
      return
    }
    setIsProcessing(true)
    try {
      await approveTransfer(id, { action: 'REJECT', reason: rejectReason }, user?.full_name || 'Store Officer')
      toast.success('Transfer rejected.')
      setShowRejectModal(false)
      refetch()
    } catch (err) {
      toast.error(err.message || 'Failed to reject transfer.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDispatch = async () => {
    if (!waybillNumber.trim()) {
      toast.error('Please enter waybill / dispatch challan number.')
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
      toast.success('Transfer marked IN_TRANSIT! Dispatch details recorded.')
      setShowDispatchModal(false)
      refetch()
    } catch (err) {
      toast.error(err.message || 'Failed to dispatch transfer.')
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
      toast.success('Transfer acknowledged! Asset location updated to destination office.')
      setShowCompleteModal(false)
      refetch()
    } catch (err) {
      toast.error(err.message || 'Failed to complete transfer.')
    } finally {
      setIsProcessing(false)
    }
  }

  const steps = [
    { key: 'SUBMITTED', label: '1. Submitted', done: true },
    {
      key: 'APPROVED',
      label: '2. Sanctioned',
      done: ['APPROVED', 'IN_TRANSIT', 'COMPLETED'].includes(transfer.status),
    },
    {
      key: 'IN_TRANSIT',
      label: '3. In Transit',
      done: ['IN_TRANSIT', 'COMPLETED'].includes(transfer.status),
    },
    {
      key: 'COMPLETED',
      label: '4. Completed',
      done: transfer.status === 'COMPLETED',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Transfer: ${transfer.transfer_number}`}
        subtitle={`Type: ${transfer.transfer_type === 'PERMANENT' ? 'Permanent Transfer' : 'Temporary Loan'} · Status: ${transfer.status}`}
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.TRANSFERS}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                Back to Register
              </Button>
            </Link>
            <Button variant="secondary" size="sm" leftIcon={<Printer size={14} />} onClick={() => window.print()}>
              Print Waybill Challan
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
                  Reject
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CheckCircle2 size={14} />}
                  loading={isProcessing}
                  onClick={handleApprove}
                >
                  Approve Transfer
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
                Dispatch Items
              </Button>
            )}

            {transfer.status === 'IN_TRANSIT' && canComplete && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<ShieldCheck size={14} />}
                onClick={() => setShowCompleteModal(true)}
              >
                Acknowledge Receipt & Complete
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
              <strong>TRANSFER COMPLETED:</strong> Destination store ({transfer.destination_office}) acknowledged receipt on{' '}
              {formatDate(transfer.completed_at)} by {transfer.received_by}. Asset custody and location are officially updated.
            </span>
          </div>
          <span className="font-mono text-emerald-800 dark:text-emerald-300 font-bold">LOCKED</span>
        </div>
      )}

      {transfer.status === 'IN_TRANSIT' && (
        <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <Truck size={18} className="text-blue-700 dark:text-blue-400" />
            <span>
              <strong>DISPATCHED & IN TRANSIT:</strong> Carrier: {transfer.carrier_name} (Waybill: {transfer.waybill_number}, Vehicle: {transfer.vehicle_number || 'Official'}).
              Asset location will officially transfer once destination confirms arrival.
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
            Origin & Destination Offices
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Source Store:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{transfer.source_office}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Destination Office:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">{transfer.destination_office}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Destination Room:</span>
              <span className="text-slate-800 dark:text-slate-200">{transfer.destination_location || 'Central Bay'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Administrative Order:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{transfer.order_reference}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Transfer Reason:</span>
              <span className="text-slate-900 dark:text-white font-medium">{transfer.reason}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 dark:border-emerald-500/15 pb-2">
            <Clock size={14} className="text-emerald-600 dark:text-emerald-400" />
            Lifecycle Audit Timeline
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Requested By:</span>
              <span className="text-slate-800 dark:text-slate-200">{transfer.requested_by} on {formatDate(transfer.request_date)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Sanctioned / Approved By:</span>
              <span className="text-slate-800 dark:text-slate-200">{transfer.approved_by || 'Pending Review'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Dispatch Details:</span>
              <span className="text-slate-800 dark:text-slate-200">{transfer.dispatched_at ? `${transfer.carrier_name} (${formatDate(transfer.dispatched_at)})` : 'Not yet dispatched'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Destination Acknowledgment:</span>
              <span className="text-slate-800 dark:text-slate-200">{transfer.completed_at ? `${transfer.received_by} (${formatDate(transfer.completed_at)})` : 'Pending arrival'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Relocated Items Schedule */}
      <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-emerald-500/15 flex items-center justify-between bg-slate-50/70 dark:bg-[#0A1513]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText size={15} className="text-emerald-600 dark:text-emerald-400" />
            Transferred Assets & Items Schedule ({transfer.items?.length || 0})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 dark:bg-[#0A1513] border-b border-slate-200 dark:border-emerald-500/20 text-slate-700 dark:text-emerald-300 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">#</th>
                <th className="py-2.5 px-4">Item Name & Code</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-4">Serial Number</th>
                <th className="py-2.5 px-3 text-center">Transfer Qty</th>
                <th className="py-2.5 px-4">Current Master Status</th>
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
                      {line.item_type === 'DURABLE_ASSET' ? 'Durable' : 'Consumable'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">{line.serial_number || 'N/A'}</td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                    {line.quantity} {line.uom}
                  </td>
                  <td className="py-3 px-4">
                    {transfer.status === 'COMPLETED' ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Active at Destination</span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">In Relocation Custody</span>
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
        title="Reject Transfer Request"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Please enter a formal justification for rejecting transfer request #{transfer.transfer_number}.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="e.g. Asset required for upcoming state election cell in Veraval..."
            className="w-full p-2.5 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-rose-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowRejectModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" loading={isProcessing} onClick={handleReject}>
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Dispatch Modal */}
      <Modal
        isOpen={showDispatchModal}
        onClose={() => setShowDispatchModal(false)}
        title="Dispatch Items & Generate Waybill"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Logistics / Transport Carrier <span className="text-red-500">*</span>
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
              Waybill / Lorry Receipt (LR) Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={waybillNumber}
              onChange={(e) => setWaybillNumber(e.target.value)}
              placeholder="e.g. GSRTC-VRV-9021"
              className="w-full px-3 py-1.5 border border-slate-300 dark:border-emerald-500/25 rounded-xl font-mono bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Vehicle Registration Number
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
              Expected Delivery Date
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
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={isProcessing} onClick={handleDispatch}>
              Confirm Dispatch
            </Button>
          </div>
        </div>
      </Modal>

      {/* Complete Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="Acknowledge Receipt & Complete Relocation"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Confirm that the physical items have arrived at <strong>{transfer.destination_office}</strong> and are verified.
            This action will update the system location for all transferred assets.
          </p>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Receiving Destination Officer <span className="text-red-500">*</span>
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
              Acknowledgment / Inspection Notes
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
              Report transit discrepancy (e.g. damaged seal or transit scuff)
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowCompleteModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={isProcessing} onClick={handleComplete}>
              Acknowledge & Transfer Location
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
