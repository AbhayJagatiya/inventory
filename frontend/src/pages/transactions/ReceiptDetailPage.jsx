import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Printer, CheckCircle2, AlertCircle, Building,
  FileText, ShieldCheck, Clock, User, Package
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
import toast from 'react-hot-toast'

export default function ReceiptDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()

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
      await postReceipt(id, user?.full_name || 'Store Officer')
      toast.success('Goods Inward Voucher successfully posted! Stock balances updated.')
      refetch()
    } catch (err) {
      toast.error(err.message || 'Failed to post receipt voucher.')
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
    return <ErrorState message="Could not locate receipt voucher." onRetry={refetch} />
  }

  const isPosted = receipt.status === 'POSTED'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Inward Receipt: ${receipt.voucher_number}`}
        subtitle={`Receipt Date: ${formatDate(receipt.receipt_date)} · Status: ${receipt.status}`}
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.RECEIPTS}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                Back to Register
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Printer size={14} />}
              onClick={() => window.print()}
            >
              Print GRN Note
            </Button>
            {canPost && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<CheckCircle2 size={14} />}
                loading={isPosting}
                onClick={() => setShowConfirmPost(true)}
              >
                Confirm & Post Inward
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
              <strong>VOUCHER POSTED:</strong> Stock balances incremented on{' '}
              {formatDate(receipt.posted_at || receipt.receipt_date)} by {receipt.posted_by || 'Store Officer'}.
              Immutable government record.
            </span>
          </div>
          <span className="font-mono text-emerald-800 font-bold">LOCKED</span>
        </div>
      ) : (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between text-amber-900 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <Clock size={16} className="text-amber-700" />
            <span>
              <strong>DRAFT VOUCHER:</strong> Physical items received but not yet confirmed into store balance.
              Review item details below before posting.
            </span>
          </div>
          <StatusBadge status="DRAFT" size="sm" />
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Supplier & Procurement */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Building size={14} className="text-blue-700" />
            Supplier & Procurement Details
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Supplier / Vendor:</span>
              <span className="font-semibold text-slate-900">{receipt.supplier_name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Supplier Contact:</span>
              <span className="font-mono text-slate-800">{receipt.supplier_contact || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">PO / GeM Contract No:</span>
              <span className="font-mono font-medium text-slate-900">{receipt.po_number || 'Direct Proc.'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Supplier Invoice No:</span>
              <span className="font-mono text-slate-800">{receipt.invoice_number || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Invoice Date:</span>
              <span className="text-slate-800">{receipt.invoice_date ? formatDate(receipt.invoice_date) : '—'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Receiving Office */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Package size={14} className="text-blue-700" />
            Receiving Custody & Office
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Receiving Office:</span>
              <span className="font-medium text-slate-900">{receipt.receiving_office}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Store Room / Bay:</span>
              <span className="font-medium text-slate-800">{receipt.receiving_location || 'Central Store'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Receiving Officer:</span>
              <span className="font-medium text-slate-800">{receipt.receiving_officer || 'Store Officer'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Delivery Challan Attachment:</span>
              <span className="font-medium text-blue-700 underline cursor-pointer">
                {receipt.attachment_name || 'Challan_Document.pdf'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Total Accepted Value:</span>
              <span className="font-mono font-bold text-sm text-slate-900">
                {formatCurrency(receipt.total_accepted_value || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Items Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <FileText size={15} className="text-blue-700" />
            Itemized Goods Inward Schedule ({receipt.items?.length || 0})
          </h2>
          <span className="text-xs text-slate-500">Values in INR (₹)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">#</th>
                <th className="py-2.5 px-4">Item Name & Type</th>
                <th className="py-2.5 px-3 text-center">Ordered</th>
                <th className="py-2.5 px-3 text-center">Received</th>
                <th className="py-2.5 px-3 text-center text-emerald-700">Accepted</th>
                <th className="py-2.5 px-3 text-center text-red-600">Rejected</th>
                <th className="py-2.5 px-4">Rejection Reason</th>
                <th className="py-2.5 px-4 text-right">Unit Cost</th>
                <th className="py-2.5 px-4 text-right">Accepted Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {receipt.items?.map((line, idx) => (
                <tr key={line.id || idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 block text-xs">{line.item_name}</span>
                    <span className="text-[11px] text-slate-500">
                      {line.item_type === 'DURABLE_ASSET' ? 'Durable Asset' : 'Consumable Stock'} · {line.uom}
                    </span>
                    {line.serial_numbers && line.serial_numbers.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {line.serial_numbers.map((sn, sIdx) => (
                          <span
                            key={sIdx}
                            className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                          >
                            SN: {sn}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center font-mono">{line.quantity_ordered}</td>
                  <td className="py-3 px-3 text-center font-mono font-medium">{line.quantity_received}</td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/40">
                    {line.quantity_accepted}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-red-600 bg-red-50/40">
                    {line.quantity_rejected || 0}
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                    {line.rejection_reason || '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700">
                    {formatCurrency(line.unit_cost)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                    {formatCurrency(line.total_accepted_cost || (line.quantity_accepted * line.unit_cost))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold text-xs text-slate-900">
              <tr>
                <td colSpan={8} className="py-3 px-4 text-right uppercase tracking-wide">
                  Total Accepted Inward Valuation:
                </td>
                <td className="py-3 px-4 text-right font-mono text-sm text-blue-900 font-bold">
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
        title="Confirm & Post Goods Inward"
        message="Posting this receipt will permanently update store inventory records. This operation cannot be reversed without an authorized administrative correction voucher. Proceed?"
        confirmText="Yes, Post to Inventory"
        variant="primary"
      />
    </div>
  )
}
