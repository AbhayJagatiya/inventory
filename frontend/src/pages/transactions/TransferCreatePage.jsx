import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, Trash2, CheckCircle, ArrowRightLeft,
  Building, FileText, Package, Calendar
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import { createTransfer } from '../../api/transactions.api'
import { getItems } from '../../api/inventory.api'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const OFFICES = [
  'Talala Taluka Panchayat Store',
  'Kodinar Branch Store',
  'Una Panchayat Office Store',
  'Gir Gadhada Taluka Store',
  'Sutrapada Taluka Panchayat Store',
  'Patan-Veraval Rural Office Store',
]

export default function TransferCreatePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Header Details
  const [transferType, setTransferType] = useState('PERMANENT')
  const [expectedReturnDate, setExpectedReturnDate] = useState('')
  const [sourceOffice] = useState('District Panchayat Central Store, Veraval')
  const [destinationOffice, setDestinationOffice] = useState(OFFICES[0])
  const [destinationLocation, setDestinationLocation] = useState('Central Store Bay 1')
  const [orderReference, setOrderReference] = useState('')
  const [reason, setReason] = useState('')

  // Query items
  const { data: itemsData } = useQuery({
    queryKey: ['available-items-for-transfer'],
    queryFn: async () => {
      const res = await getItems()
      return res?.data || res || []
    },
    initialData: [],
  })

  const availableItems = (itemsData || []).filter((i) => {
    if (i.item_type === 'DURABLE_ASSET') return i.operational_status === 'AVAILABLE_IN_STORE'
    return (i.quantity || 0) > 0
  })

  // Transfer Lines
  const [lines, setLines] = useState([
    {
      id: 1,
      selected_item_id: '',
      quantity: 1,
    },
  ])

  const handleAddLine = () => {
    setLines([...lines, { id: Date.now(), selected_item_id: '', quantity: 1 }])
  }

  const handleRemoveLine = (idx) => {
    if (lines.length === 1) {
      toast.error('A transfer request must have at least one item.')
      return
    }
    setLines(lines.filter((_, i) => i !== idx))
  }

  const handleLineChange = (idx, field, value) => {
    const updated = [...lines]
    updated[idx][field] = value
    setLines(updated)
  }

  const validate = () => {
    if (!destinationOffice) {
      toast.error('Please select destination office.')
      return false
    }
    if (transferType === 'TEMPORARY' && !expectedReturnDate) {
      toast.error('Please specify expected return date for temporary loan transfer.')
      return false
    }
    if (!orderReference.trim()) {
      toast.error('Please enter sanction order / memo reference.')
      return false
    }
    if (!reason.trim()) {
      toast.error('Please enter transfer reason / justification.')
      return false
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.selected_item_id) {
        toast.error(`Line ${i + 1}: Please select an item to transfer.`)
        return false
      }
      const item = availableItems.find((itm) => itm.id === line.selected_item_id)
      const qty = Number(line.quantity) || 0
      if (qty <= 0) {
        toast.error(`Line ${i + 1}: Quantity must be greater than 0.`)
        return false
      }
      if (item && item.item_type === 'CONSUMABLE_STOCK' && qty > item.quantity) {
        toast.error(`Line ${i + 1}: Quantity exceeds available balance (${item.quantity} ${item.uom}).`)
        return false
      }
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const formattedItems = lines.map((line, idx) => {
        const item = availableItems.find((itm) => itm.id === line.selected_item_id)
        return {
          id: `trf-itm-${idx + 1}`,
          item_id: item.id,
          item_code: item.item_code,
          item_name: item.item_name,
          item_type: item.item_type,
          serial_number: item.serial_number || null,
          quantity: Number(line.quantity),
          uom: item.uom || 'NOS',
        }
      })

      const payload = {
        source_office_id: user?.office_id,
        transfer_type: transferType,
        expected_return_date: transferType === 'TEMPORARY' ? expectedReturnDate : null,
        source_office: sourceOffice,
        destination_office: destinationOffice,
        destination_location: destinationLocation,
        order_reference: orderReference,
        reason,
        items: formattedItems,
      }

      const res = await createTransfer(payload)
      toast.success('Transfer request submitted! Awaiting Store Officer sanction.')
      navigate(ROUTES.TRANSFER_DETAIL(res?.data?.id || ''))
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to submit transfer request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Inter-Office Transfer Request"
        subtitle="Initiate an asset or inventory transfer between Panchayat store locations"
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.TRANSFERS}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                Cancel
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<CheckCircle size={14} />}
              loading={isSubmitting}
              onClick={handleSubmit}
            >
              Submit Transfer Request
            </Button>
          </div>
        }
      />

      {/* Origin, Destination & Scope Form */}
      <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-6 shadow-sm space-y-6">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-emerald-500/15 pb-2 flex items-center gap-2">
          <ArrowRightLeft size={16} className="text-emerald-600 dark:text-emerald-400" />
          1. Relocation Route & Transfer Classification
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Transfer Classification <span className="text-red-500">*</span>
            </label>
            <select
              value={transferType}
              onChange={(e) => setTransferType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl font-semibold text-slate-900 dark:text-white bg-white dark:bg-[#0A1513] focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="PERMANENT" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">Permanent Reallocation</option>
              <option value="TEMPORARY" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">Temporary Loan (Returnable)</option>
            </select>
          </div>

          {transferType === 'TEMPORARY' && (
            <div>
              <label className="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1 flex items-center gap-1">
                <Calendar size={13} /> Expected Return Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full px-3 py-2 border border-amber-300 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none font-semibold text-amber-900 dark:text-amber-200"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Source Office (Current Location)
            </label>
            <input
              type="text"
              value={sourceOffice}
              readOnly
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-slate-100 dark:bg-[#081210] text-slate-700 dark:text-slate-300 font-medium cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Destination Office / Store <span className="text-red-500">*</span>
            </label>
            <select
              value={destinationOffice}
              onChange={(e) => setDestinationOffice(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl font-semibold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-[#0A1513] focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {OFFICES.map((off) => (
                <option key={off} value={off} className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">
                  {off}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Destination Room / Receiving Location
            </label>
            <input
              type="text"
              value={destinationLocation}
              onChange={(e) => setDestinationLocation(e.target.value)}
              placeholder="e.g. Talala Store Room 1"
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Sanction / Administrative Order No. <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={orderReference}
              onChange={(e) => setOrderReference(e.target.value)}
              placeholder="e.g. DDO/GS/TRF/2026/108"
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Transfer Justification / Directive Reason <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Official inter-taluka reallocation as per District Development Committee resolution..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Items to Transfer */}
      <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-emerald-500/15 pb-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Package size={16} className="text-emerald-600 dark:text-emerald-400" />
            2. Assets & Items to Relocate ({lines.length})
          </h2>
          <Button variant="secondary" size="sm" leftIcon={<Plus size={14} />} onClick={handleAddLine}>
            Add Item
          </Button>
        </div>

        <div className="space-y-4">
          {lines.map((line, idx) => {
            const selectedItem = availableItems.find((itm) => itm.id === line.selected_item_id)
            const isDurable = selectedItem?.item_type === 'DURABLE_ASSET'

            return (
              <div key={line.id} className="p-4 rounded-xl border border-slate-200 dark:border-emerald-500/20 bg-slate-50/70 dark:bg-[#081210] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                    Transfer Item #{idx + 1}
                  </span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs flex items-center gap-1"
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  <div className="md:col-span-2">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Select Item from Source Store <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={line.selected_item_id}
                      onChange={(e) => handleLineChange(idx, 'selected_item_id', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">-- Choose Item from Available Store Stock --</option>
                      {availableItems.map((itm) => (
                        <option key={itm.id} value={itm.id} className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">
                          {itm.item_name} [{itm.item_code}] ·{' '}
                          {itm.item_type === 'DURABLE_ASSET'
                            ? `Durable (SN: ${itm.serial_number || 'N/A'})`
                            : `Consumable (Available: ${itm.quantity} ${itm.uom})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Transfer Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      disabled={isDurable}
                      value={line.quantity}
                      onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] font-bold font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    {isDurable && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                        Locked to 1 (Individually tracked asset)
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Available In Source Store
                    </label>
                    <div className="px-3 py-2 border border-slate-200 dark:border-emerald-500/20 bg-slate-100 dark:bg-[#081210] rounded-xl font-mono text-slate-700 dark:text-slate-300 font-semibold">
                      {selectedItem
                        ? selectedItem.item_type === 'DURABLE_ASSET'
                          ? '1 Unit (In Store)'
                          : `${selectedItem.quantity} ${selectedItem.uom}`
                        : 'Select item'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

