import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, CheckCircle, Save,
  AlertTriangle, Building, FileText, Package
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { createReceipt } from '../../api/transactions.api'
import { formatCurrency } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function ReceiptCreatePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmPost, setShowConfirmPost] = useState(false)

  // Header Details
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0])
  const [supplierName, setSupplierName] = useState('')
  const [supplierContact, setSupplierContact] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [receivingOffice, setReceivingOffice] = useState('District Panchayat Central Store, Veraval')
  const [receivingLocation, setReceivingLocation] = useState('Room 102 (Central Store)')
  const [remarks, setRemarks] = useState('')
  const [attachmentName, setAttachmentName] = useState('')

  // Line items
  const [items, setItems] = useState([
    {
      id: 1,
      item_name: '',
      item_type: 'DURABLE_ASSET',
      category_name: 'Computers & Peripherals',
      uom: 'NOS',
      quantity_ordered: 1,
      quantity_received: 1,
      quantity_accepted: 1,
      quantity_rejected: 0,
      rejection_reason: '',
      unit_cost: 0,
      serial_numbers: '',
    },
  ])

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Date.now(),
        item_name: '',
        item_type: 'CONSUMABLE_STOCK',
        category_name: 'Office Stationery & Paper',
        uom: 'NOS',
        quantity_ordered: 1,
        quantity_received: 1,
        quantity_accepted: 1,
        quantity_rejected: 0,
        rejection_reason: '',
        unit_cost: 0,
        serial_numbers: '',
      },
    ])
  }

  const handleRemoveItem = (index) => {
    if (items.length === 1) {
      toast.error('Receipt must have at least one line item.')
      return
    }
    setItems(items.filter((_, idx) => idx !== index))
  }

  const handleItemChange = (index, field, value) => {
    const updated = [...items]
    updated[index][field] = value

    // Auto calculate accepted/rejected
    if (field === 'quantity_received' || field === 'quantity_accepted') {
      const rec = Number(updated[index].quantity_received) || 0
      const acc = Number(updated[index].quantity_accepted) || 0
      if (acc > rec) {
        updated[index].quantity_accepted = rec
        updated[index].quantity_rejected = 0
      } else {
        updated[index].quantity_rejected = Math.max(0, rec - acc)
      }
    }

    setItems(updated)
  }

  // Calculate totals
  const totalAcceptedValue = items.reduce(
    (sum, line) => sum + (Number(line.quantity_accepted) || 0) * (Number(line.unit_cost) || 0),
    0
  )

  const validateForm = () => {
    if (!supplierName.trim()) {
      toast.error('Please enter supplier name.')
      return false
    }
    if (!receiptDate) {
      toast.error('Please select receipt date.')
      return false
    }
    for (let i = 0; i < items.length; i++) {
      const line = items[i]
      if (!line.item_name.trim()) {
        toast.error(`Line ${i + 1}: Item name is required.`)
        return false
      }
      if (Number(line.quantity_received) <= 0) {
        toast.error(`Line ${i + 1}: Quantity received must be greater than 0.`)
        return false
      }
      if (Number(line.quantity_rejected) > 0 && !line.rejection_reason.trim()) {
        toast.error(`Line ${i + 1}: Please specify a rejection reason for rejected items.`)
        return false
      }
    }
    return true
  }

  const handleSave = async (targetStatus = 'DRAFT') => {
    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      const payload = {
        receipt_date: receiptDate,
        supplier_name: supplierName,
        supplier_contact: supplierContact,
        po_number: poNumber,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        receiving_office: receivingOffice,
        receiving_location: receivingLocation,
        receiving_officer: user?.full_name || 'Store Officer',
        status: targetStatus,
        remarks,
        attachment_name: attachmentName || 'Challan_Document.pdf',
        items: items.map((line, idx) => ({
          id: `line-${idx + 1}`,
          item_name: line.item_name,
          item_type: line.item_type,
          category_name: line.category_name,
          uom: line.uom,
          quantity_ordered: Number(line.quantity_ordered) || 0,
          quantity_received: Number(line.quantity_received) || 0,
          quantity_accepted: Number(line.quantity_accepted) || 0,
          quantity_rejected: Number(line.quantity_rejected) || 0,
          rejection_reason: line.rejection_reason || '',
          unit_cost: Number(line.unit_cost) || 0,
          total_accepted_cost: (Number(line.quantity_accepted) || 0) * (Number(line.unit_cost) || 0),
          serial_numbers: line.serial_numbers
            ? line.serial_numbers.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        })),
        total_accepted_value: totalAcceptedValue,
      }

      const res = await createReceipt(payload)
      toast.success(
        targetStatus === 'POSTED'
          ? 'Goods inward voucher posted! Stock balances updated.'
          : 'Receipt draft saved successfully.'
      )
      navigate(ROUTES.RECEIPT_DETAIL(res?.data?.id || ''))
    } catch (err) {
      toast.error(err.message || 'Failed to save receipt voucher.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Goods Inward Receipt (GRN)"
        subtitle="Create a procurement delivery receipt voucher and record received items"
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.RECEIPTS}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                Cancel
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Save size={14} />}
              loading={isSubmitting}
              onClick={() => handleSave('DRAFT')}
            >
              Save as Draft
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<CheckCircle size={14} />}
              loading={isSubmitting}
              onClick={() => setShowConfirmPost(true)}
            >
              Review & Post Inward
            </Button>
          </div>
        }
      />

      {/* Primary Procurement Header Form */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-6">
        <h2 className="text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
          <Building size={16} className="text-blue-700" />
          1. Procurement & Supplier Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supplier / Vendor Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g. Gujarat Infotech Solutions"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supplier Contact / Phone
            </label>
            <input
              type="text"
              value={supplierContact}
              onChange={(e) => setSupplierContact(e.target.value)}
              placeholder="+91 98250 XXXXX"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Receipt Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              PO / GeM Contract Number
            </label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="GEM-2026-PO-XXXX"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supplier Invoice / Challan No.
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-XXXX-2026"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Invoice Date
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Receiving Office Scope
            </label>
            <input
              type="text"
              value={receivingOffice}
              onChange={(e) => setReceivingOffice(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-700 font-medium cursor-not-allowed"
              readOnly
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Store Room / Receiving Bay
            </label>
            <input
              type="text"
              value={receivingLocation}
              onChange={(e) => setReceivingLocation(e.target.value)}
              placeholder="e.g. Room 102"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Challan Document Name / Note
            </label>
            <input
              type="text"
              value={attachmentName}
              onChange={(e) => setAttachmentName(e.target.value)}
              placeholder="e.g. Delivery_Challan_Scanned.pdf"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Multiple Line Items Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Package size={16} className="text-blue-700" />
            2. Inward Line Items ({items.length})
          </h2>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={handleAddItem}
          >
            Add Line Item
          </Button>
        </div>

        <div className="space-y-4">
          {items.map((line, idx) => (
            <div
              key={line.id}
              className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Item #{idx + 1}
                </span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors text-xs flex items-center gap-1"
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Item Name & Specification <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={line.item_name}
                    onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                    placeholder="e.g. HP LaserJet 4104dw Printer / A4 Copier Paper"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tracking Type
                  </label>
                  <select
                    value={line.item_type}
                    onChange={(e) => handleItemChange(idx, 'item_type', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="DURABLE_ASSET">Durable Asset (Serial Tracked)</option>
                    <option value="CONSUMABLE_STOCK">Consumable Stock (Bulk Qty)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Unit of Measure (UOM)
                  </label>
                  <select
                    value={line.uom}
                    onChange={(e) => handleItemChange(idx, 'uom', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="NOS">Numbers (Units)</option>
                    <option value="BOX">Box</option>
                    <option value="REAM">Ream (Paper)</option>
                    <option value="PACKET">Packet</option>
                    <option value="SET">Set</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Qty Ordered
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={line.quantity_ordered}
                    onChange={(e) => handleItemChange(idx, 'quantity_ordered', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Qty Received <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={line.quantity_received}
                    onChange={(e) => handleItemChange(idx, 'quantity_received', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Qty Accepted <span className="text-emerald-600 font-bold">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={line.quantity_received}
                    value={line.quantity_accepted}
                    onChange={(e) => handleItemChange(idx, 'quantity_accepted', e.target.value)}
                    className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50/50 rounded-md focus:ring-2 focus:ring-emerald-600 focus:outline-none font-semibold text-emerald-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Qty Rejected / Damaged
                  </label>
                  <input
                    type="number"
                    value={line.quantity_rejected}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-100 rounded-md font-semibold text-red-600 cursor-not-allowed"
                  />
                </div>

                {Number(line.quantity_rejected) > 0 && (
                  <div className="md:col-span-4 p-2.5 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    <label className="block font-bold mb-1 flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle size={13} />
                      Rejection Reason (Mandatory for {line.quantity_rejected} rejected units)
                    </label>
                    <input
                      type="text"
                      value={line.rejection_reason}
                      onChange={(e) => handleItemChange(idx, 'rejection_reason', e.target.value)}
                      placeholder="e.g. Broken packaging, shattered glass, water damage..."
                      className="w-full px-3 py-1.5 border border-amber-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Unit Purchase Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={line.unit_cost}
                    onChange={(e) => handleItemChange(idx, 'unit_cost', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Line Total Accepted Value
                  </label>
                  <div className="px-3 py-2 border border-slate-200 bg-slate-100 rounded-md font-mono font-bold text-slate-900 text-sm">
                    {formatCurrency((Number(line.quantity_accepted) || 0) * (Number(line.unit_cost) || 0))}
                  </div>
                </div>

                {line.item_type === 'DURABLE_ASSET' && Number(line.quantity_accepted) > 0 && (
                  <div className="md:col-span-4">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Serial Numbers (Comma separated for {line.quantity_accepted} units)
                    </label>
                    <input
                      type="text"
                      value={line.serial_numbers}
                      onChange={(e) => handleItemChange(idx, 'serial_numbers', e.target.value)}
                      placeholder="e.g. SN-001, SN-002"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono text-xs"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Total Summary Footer */}
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between">
          <div className="text-xs text-blue-900 font-medium">
            Total Accepted Inward Valuation ({items.length} line items):
          </div>
          <div className="text-lg font-bold font-mono text-blue-900">
            {formatCurrency(totalAcceptedValue)}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Posting */}
      <ConfirmDialog
        isOpen={showConfirmPost}
        onClose={() => setShowConfirmPost(false)}
        onConfirm={() => {
          setShowConfirmPost(false)
          handleSave('POSTED')
        }}
        title="Confirm Goods Inward & Stock Update"
        message="Posting this receipt will atomically increment store balances and generate permanent asset records. This action cannot be duplicated. Are you sure?"
        confirmText="Confirm & Post Inward"
        variant="primary"
      />
    </div>
  )
}

