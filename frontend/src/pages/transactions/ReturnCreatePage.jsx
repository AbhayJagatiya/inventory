import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, CheckCircle, RotateCcw, AlertTriangle,
  Building, FileText, Package, User, Wrench
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { createReturn, getIssues } from '../../api/transactions.api'
import { getMockIssues } from '../../services/transactionsMockData'
import { formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function ReturnCreatePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Form Fields
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedIssueId, setSelectedIssueId] = useState('')
  const [returnReason, setReturnReason] = useState('')
  const [receivingOfficer, setReceivingOfficer] = useState(user?.full_name || 'Store Officer')

  // Query posted issues with unreturned items
  const { data: issuesData } = useQuery({
    queryKey: ['posted-issues-for-return'],
    queryFn: async () => {
      try {
        const res = await getIssues()
        return res?.data || res
      } catch {
        return getMockIssues()
      }
    },
    initialData: getMockIssues(),
  })

  const allIssues = issuesData || []
  const returnableIssues = allIssues.filter((iss) => {
    return iss.items?.some((i) => (i.remaining_unreturned ?? i.quantity_issued) > 0)
  })

  const selectedIssue = returnableIssues.find((i) => i.id === selectedIssueId || i.voucher_number === selectedIssueId)

  // Track items to return from the selected issue
  const [returnItems, setReturnItems] = useState({})

  const handleSelectIssue = (issueId) => {
    setSelectedIssueId(issueId)
    const found = returnableIssues.find((i) => i.id === issueId || i.voucher_number === issueId)
    if (found) {
      const initialMap = {}
      found.items.forEach((line) => {
        const unreturned = line.remaining_unreturned ?? (line.quantity_issued - (line.quantity_returned || 0))
        if (unreturned > 0) {
          initialMap[line.id] = {
            selected: true,
            quantity: unreturned,
            condition: 'GOOD',
            inspection_notes: 'Physical check completed. Normal working condition.',
          }
        }
      })
      setReturnItems(initialMap)
    } else {
      setReturnItems({})
    }
  }

  const handleItemToggle = (lineId) => {
    setReturnItems((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        selected: !prev[lineId]?.selected,
      },
    }))
  }

  const handleItemProperty = (lineId, prop, value) => {
    setReturnItems((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        [prop]: value,
      },
    }))
  }

  const validate = () => {
    if (!selectedIssue) {
      toast.error('Please select original issue voucher.')
      return false
    }
    if (!returnReason.trim()) {
      toast.error('Please specify the reason for return.')
      return false
    }

    const selectedLines = Object.entries(returnItems).filter(([_, val]) => val.selected)
    if (selectedLines.length === 0) {
      toast.error('Please select at least one item to return.')
      return false
    }

    for (const [lineId, state] of selectedLines) {
      const origLine = selectedIssue.items.find((i) => i.id === lineId)
      const maxReturnable = origLine.remaining_unreturned ?? (origLine.quantity_issued - (origLine.quantity_returned || 0))
      const qty = Number(state.quantity) || 0

      if (qty <= 0) {
        toast.error(`Return quantity for ${origLine.item_name} must be greater than 0.`)
        return false
      }
      if (qty > maxReturnable) {
        toast.error(
          `Cannot return ${qty} ${origLine.uom} of ${origLine.item_name}. Maximum returnable is ${maxReturnable}.`
        )
        return false
      }
    }

    return true
  }

  const handlePostReturn = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const linesToSubmit = Object.entries(returnItems)
        .filter(([_, val]) => val.selected)
        .map(([lineId, val]) => {
          const origLine = selectedIssue.items.find((i) => i.id === lineId)
          return {
            id: `ret-item-${lineId}`,
            item_id: origLine.item_id,
            item_code: origLine.item_code,
            item_name: origLine.item_name,
            item_type: origLine.item_type,
            uom: origLine.uom,
            quantity_returned: Number(val.quantity),
            condition: val.condition,
            inspection_notes: val.inspection_notes || '',
            flagged_for_maintenance: val.condition === 'DAMAGED' || val.condition === 'SCRAP',
          }
        })

      const payload = {
        return_date: returnDate,
        original_issue_id: selectedIssue.id,
        original_issue_voucher: selectedIssue.voucher_number,
        returning_department: selectedIssue.department,
        returning_employee: selectedIssue.receiving_employee,
        receiving_officer: receivingOfficer,
        return_reason: returnReason,
        items: linesToSubmit,
      }

      const res = await createReturn(payload, user?.full_name || 'Store Officer')
      toast.success('Stock return processed! Condition recorded and balances updated.')
      navigate(ROUTES.RETURN_DETAIL(res?.data?.id || ''))
    } catch (err) {
      toast.error(err.message || 'Failed to record return.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Record Stock Return"
        subtitle="Return issued inventory, inspect condition, and re-admit items to store balance"
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.RETURNS}>
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
              Confirm & Re-admit Stock
            </Button>
          </div>
        }
      />

      {/* Select Original Issue */}
      <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-6 shadow-sm space-y-6">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-emerald-500/15 pb-2 flex items-center gap-2">
          <RotateCcw size={16} className="text-emerald-600 dark:text-emerald-400" />
          1. Select Original Issue Voucher & Return Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Original Issue Voucher <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedIssueId}
              onChange={(e) => handleSelectIssue(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl font-mono text-sm text-slate-900 dark:text-white bg-white dark:bg-[#0A1513] focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">-- Select Posted Issue Voucher with Outstanding Items --</option>
              {returnableIssues.map((iss) => (
                <option key={iss.id} value={iss.id} className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">
                  {iss.voucher_number} · {iss.department} ({iss.receiving_employee}) · Issued {formatDate(iss.issue_date)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Return Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Returning Department
            </label>
            <input
              type="text"
              value={selectedIssue?.department || '—'}
              readOnly
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-slate-100 dark:bg-[#081210] text-slate-700 dark:text-slate-300 font-medium cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Returning Officer / Custodian
            </label>
            <input
              type="text"
              value={selectedIssue?.receiving_employee || '—'}
              readOnly
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-slate-100 dark:bg-[#081210] text-slate-700 dark:text-slate-300 font-medium cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Receiving Store Officer <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={receivingOfficer}
              onChange={(e) => setReceivingOfficer(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reason for Return <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. Project cycle completed, surplus stock, equipment malfunctioning..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
            />
          </div>
        </div>
      </div>

      {/* Item Selection & Condition Inspection */}
      {selectedIssue && (
        <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-emerald-500/15 pb-3">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Package size={16} className="text-emerald-600 dark:text-emerald-400" />
              2. Inspect & Select Items to Return from Voucher #{selectedIssue.voucher_number}
            </h2>
          </div>

          <div className="space-y-4">
            {selectedIssue.items?.map((line) => {
              const maxReturnable =
                line.remaining_unreturned ?? (line.quantity_issued - (line.quantity_returned || 0))
              const state = returnItems[line.id] || {
                selected: false,
                quantity: maxReturnable,
                condition: 'GOOD',
                inspection_notes: '',
              }

              const isDamaged = state.condition === 'DAMAGED' || state.condition === 'SCRAP'

              if (maxReturnable <= 0) return null

              return (
                <div
                  key={line.id}
                  className={`p-4 rounded-xl border transition-all ${
                    state.selected
                      ? 'border-emerald-400/50 bg-emerald-50/40 dark:bg-emerald-500/10 dark:border-emerald-500/40 shadow-xs'
                      : 'border-slate-200 dark:border-emerald-500/15 bg-slate-50/50 dark:bg-[#081210] opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.selected}
                        onChange={() => handleItemToggle(line.id)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 dark:border-emerald-500/30 focus:ring-emerald-500"
                      />
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white text-sm block">{line.item_name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {line.item_code} · {line.item_type === 'DURABLE_ASSET' ? `SN: ${line.serial_number || 'N/A'}` : 'Consumable'}
                        </span>
                      </div>
                    </label>

                    <div className="text-right text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Issued: {line.quantity_issued} {line.uom}</span>
                      <span className="block font-bold text-amber-700 dark:text-amber-400 font-mono">
                        Available to return: {maxReturnable} {line.uom}
                      </span>
                    </div>
                  </div>

                  {state.selected && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-200/70 dark:border-emerald-500/15 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Return Quantity ({line.uom})
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={maxReturnable}
                          value={state.quantity}
                          onChange={(e) => handleItemProperty(line.id, 'quantity', e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 dark:border-emerald-500/25 rounded-lg bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-bold font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Physical Condition Assessment
                        </label>
                        <select
                          value={state.condition}
                          onChange={(e) => handleItemProperty(line.id, 'condition', e.target.value)}
                          className={`w-full px-3 py-1.5 border rounded-lg font-semibold focus:outline-none ${
                            isDamaged
                              ? 'border-red-400 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-300 dark:border-red-500/40'
                              : 'border-slate-300 dark:border-emerald-500/25 bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white'
                          }`}
                        >
                          <option value="GOOD">Good (Directly Re-usable)</option>
                          <option value="FAIR">Fair (Minor Wear, Operable)</option>
                          <option value="DAMAGED">Damaged (Requires Repair / Inspection)</option>
                          <option value="SCRAP">Unserviceable / Scrap</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Inspection Notes
                        </label>
                        <input
                          type="text"
                          value={state.inspection_notes}
                          onChange={(e) => handleItemProperty(line.id, 'inspection_notes', e.target.value)}
                          placeholder="e.g. Scratches on lid, tested working..."
                          className="w-full px-3 py-1.5 border border-slate-300 dark:border-emerald-500/25 rounded-lg bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>

                      {isDamaged && (
                        <div className="md:col-span-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                          <Wrench size={15} className="text-amber-700 dark:text-amber-400 shrink-0" />
                          <span>
                            <strong>Flagged for Technical Inspection:</strong> Because this asset is marked as{' '}
                            <strong>{state.condition}</strong>, its operational status will become{' '}
                            <code className="font-mono bg-white dark:bg-[#0A1513] px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-500/30">
                              UNDER_MAINTENANCE
                            </code>{' '}
                            and it will not be available for departmental re-issue until repaired or inspected.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false)
          handlePostReturn()
        }}
        title="Confirm Stock Return & Condition Inspection"
        message="Posting this return will update physical store balances and re-classify returned assets based on your inspection. Proceed?"
        confirmText="Confirm & Re-admit"
        variant="primary"
      />
    </div>
  )
}

