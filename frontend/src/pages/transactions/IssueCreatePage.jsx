import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, Trash2, CheckCircle, Save,
  AlertTriangle, Building, FileText, Package, User
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { createIssue } from '../../api/transactions.api'
import { getItems } from '../../api/inventory.api'
import { getMockItemsState } from '../../services/transactionsMockData'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const DEPARTMENTS = [
  'Accounts & Audit Branch',
  'Establishment & Administration Branch',
  'Health & Medical Services Branch',
  'Engineering & Irrigation Wing',
  'Panchayat Raj & Gram Seva Registry',
  'Taluka Development Office, Talala',
  'Taluka Development Office, Kodinar',
  'Taluka Development Office, Una',
  'District Planning & Statistics Cell',
]

export default function IssueCreatePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Header Details
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  const [department, setDepartment] = useState(DEPARTMENTS[0])
  const [receivingEmployee, setReceivingEmployee] = useState('')
  const [receivingDesignation, setReceivingDesignation] = useState('')
  const [sanctionOrderNumber, setSanctionOrderNumber] = useState('')
  const [purpose, setPurpose] = useState('')
  const [remarks, setRemarks] = useState('')

  // Query available items
  const { data: itemsData } = useQuery({
    queryKey: ['available-items-for-issue'],
    queryFn: async () => {
      try {
        const res = await getItems()
        return res?.data || res
      } catch {
        return getMockItemsState()
      }
    },
    initialData: getMockItemsState(),
  })

  const allItems = itemsData || []
  // Filter items that can be issued:
  // For durable assets: operational_status must be AVAILABLE_IN_STORE
  // For consumables: quantity must be > 0
  const availableItems = allItems.filter((i) => {
    if (i.item_type === 'DURABLE_ASSET') {
      return i.operational_status === 'AVAILABLE_IN_STORE'
    }
    return (i.quantity || 0) > 0
  })

  // Lines to issue
  const [issueLines, setIssueLines] = useState([
    {
      id: 1,
      selected_item_id: '',
      quantity_issued: 1,
      remarks: '',
    },
  ])

  const handleAddLine = () => {
    setIssueLines([
      ...issueLines,
      {
        id: Date.now(),
        selected_item_id: '',
        quantity_issued: 1,
        remarks: '',
      },
    ])
  }

  const handleRemoveLine = (idx) => {
    if (issueLines.length === 1) {
      toast.error('An issue voucher must contain at least one line item.')
      return
    }
    setIssueLines(issueLines.filter((_, i) => i !== idx))
  }

  const handleLineChange = (idx, field, value) => {
    const updated = [...issueLines]
    updated[idx][field] = value

    if (field === 'selected_item_id') {
      const found = availableItems.find((i) => i.id === value)
      if (found && found.item_type === 'DURABLE_ASSET') {
        updated[idx].quantity_issued = 1
      }
    }

    setIssueLines(updated)
  }

  const validate = () => {
    if (!department) {
      toast.error('Please select recipient department.')
      return false
    }
    if (!receivingEmployee.trim()) {
      toast.error('Please enter receiving employee / custodian name.')
      return false
    }
    if (!purpose.trim()) {
      toast.error('Please specify purpose of issue.')
      return false
    }

    for (let i = 0; i < issueLines.length; i++) {
      const line = issueLines[i]
      if (!line.selected_item_id) {
        toast.error(`Line ${i + 1}: Please select an item to issue.`)
        return false
      }
      const item = availableItems.find((itm) => itm.id === line.selected_item_id)
      if (!item) {
        toast.error(`Line ${i + 1}: Selected item is invalid.`)
        return false
      }
      const qty = Number(line.quantity_issued) || 0
      if (qty <= 0) {
        toast.error(`Line ${i + 1}: Issued quantity must be greater than 0.`)
        return false
      }
      if (item.item_type === 'CONSUMABLE_STOCK' && qty > item.quantity) {
        toast.error(
          `Line ${i + 1}: Issued quantity (${qty} ${item.uom}) exceeds available balance (${item.quantity} ${item.uom}).`
        )
        return false
      }
    }
    return true
  }

  const handlePostIssue = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const formattedItems = issueLines.map((line, idx) => {
        const item = availableItems.find((itm) => itm.id === line.selected_item_id)
        return {
          id: `iss-line-${idx + 1}`,
          item_id: item.id,
          item_code: item.item_code,
          item_name: item.item_name,
          item_type: item.item_type,
          serial_number: item.serial_number || null,
          uom: item.uom || 'NOS',
          quantity_issued: Number(line.quantity_issued),
          quantity_returned: 0,
          remaining_unreturned: Number(line.quantity_issued),
          remarks: line.remarks || '',
        }
      })

      const payload = {
        issue_date: issueDate,
        department,
        receiving_employee: receivingEmployee,
        receiving_designation: receivingDesignation || 'Designated Staff',
        sanction_order_number: sanctionOrderNumber,
        purpose,
        remarks,
        items: formattedItems,
      }

      const res = await createIssue(payload, user?.full_name || 'Store Staff')
      toast.success('Stock issue voucher created! Inventory updated.')
      navigate(ROUTES.ISSUE_DETAIL(res?.data?.id || ''))
    } catch (err) {
      toast.error(err.message || 'Failed to create issue voucher.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Stock Issue Voucher"
        subtitle="Issue store supplies and durable assets to panchayat departments and personnel"
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.ISSUES}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                Cancel
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<CheckCircle size={14} />}
              loading={isSubmitting}
              onClick={() => {
                if (validate()) setShowConfirm(true)
              }}
            >
              Post & Hand Over
            </Button>
          </div>
        }
      />

      {/* Recipient & Sanction Form */}
      <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-6 shadow-sm space-y-6">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-emerald-500/15 pb-2 flex items-center gap-2">
          <Building size={16} className="text-emerald-600 dark:text-emerald-400" />
          1. Destination & Recipient Custodian
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Issue Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Recipient Department / Branch <span className="text-red-500">*</span>
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept} className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Sanction / Order Memo Number
            </label>
            <input
              type="text"
              value={sanctionOrderNumber}
              onChange={(e) => setSanctionOrderNumber(e.target.value)}
              placeholder="e.g. DDO/GS/ACC/2026/102"
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Receiving Employee / Custodian <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={receivingEmployee}
              onChange={(e) => setReceivingEmployee(e.target.value)}
              placeholder="e.g. Ramesh Dave"
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Employee Designation
            </label>
            <input
              type="text"
              value={receivingDesignation}
              onChange={(e) => setReceivingDesignation(e.target.value)}
              placeholder="e.g. Head Accountant / Senior Clerk"
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Official Purpose of Issue <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Desk setup for audit verification..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Items to Issue */}
      <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-emerald-500/15 pb-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Package size={16} className="text-emerald-600 dark:text-emerald-400" />
            2. Select Items to Issue from Available Store Stock ({issueLines.length})
          </h2>
          <Button variant="secondary" size="sm" leftIcon={<Plus size={14} />} onClick={handleAddLine}>
            Add Item to Issue
          </Button>
        </div>

        <div className="space-y-4">
          {issueLines.map((line, idx) => {
            const selectedItem = availableItems.find((itm) => itm.id === line.selected_item_id)
            const isDurable = selectedItem?.item_type === 'DURABLE_ASSET'
            const isOverIssue =
              selectedItem &&
              selectedItem.item_type === 'CONSUMABLE_STOCK' &&
              Number(line.quantity_issued) > selectedItem.quantity

            return (
              <div
                key={line.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-emerald-500/20 bg-slate-50/70 dark:bg-[#081210] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                    Issue Line #{idx + 1}
                  </span>
                  {issueLines.length > 1 && (
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
                      Select Item from Store Inventory <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={line.selected_item_id}
                      onChange={(e) => handleLineChange(idx, 'selected_item_id', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">-- Choose Item from Available Stock --</option>
                      {availableItems.map((itm) => (
                        <option key={itm.id} value={itm.id} className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">
                          {itm.item_name} [{itm.item_code}] ·{' '}
                          {itm.item_type === 'DURABLE_ASSET'
                            ? `Durable Asset (SN: ${itm.serial_number || 'N/A'})`
                            : `Consumable (Available: ${itm.quantity} ${itm.uom})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Quantity to Issue <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      disabled={isDurable}
                      value={line.quantity_issued}
                      onChange={(e) => handleLineChange(idx, 'quantity_issued', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-xl font-bold font-mono focus:outline-none ${
                        isOverIssue
                          ? 'border-red-500 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-300 dark:border-red-500/40'
                          : 'border-slate-300 dark:border-emerald-500/25 bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500'
                      }`}
                    />
                    {isDurable && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                        Locked to 1 (Individually tracked asset)
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Available In Store
                    </label>
                    <div className="px-3 py-2 border border-slate-200 dark:border-emerald-500/20 bg-slate-100 dark:bg-[#081210] rounded-xl font-mono text-slate-700 dark:text-slate-300 font-semibold">
                      {selectedItem
                        ? selectedItem.item_type === 'DURABLE_ASSET'
                          ? '1 Unit (Available)'
                          : `${selectedItem.quantity} ${selectedItem.uom}`
                        : 'Select item'}
                    </div>
                  </div>

                  {isOverIssue && (
                    <div className="md:col-span-4 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                      <AlertTriangle size={14} className="shrink-0" />
                      <span>
                        <strong>Cannot Issue:</strong> Requested quantity ({line.quantity_issued}) exceeds
                        available stock balance ({selectedItem.quantity} {selectedItem.uom}). Please adjust quantity.
                      </span>
                    </div>
                  )}

                  <div className="md:col-span-4">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Line Remarks / Handover Notes</label>
                    <input
                      type="text"
                      value={line.remarks}
                      onChange={(e) => handleLineChange(idx, 'remarks', e.target.value)}
                      placeholder="e.g. Issued with power cable, tested working on arrival..."
                      className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false)
          handlePostIssue()
        }}
        title="Confirm Stock Issue Voucher"
        message="Posting this issue voucher will immediately update stock balances. Durable assets will be assigned to the recipient custodian and marked IN_USE. Proceed?"
        confirmText="Confirm & Issue Items"
        variant="primary"
      />
    </div>
  )
}

