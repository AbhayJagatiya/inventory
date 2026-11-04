import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  QrCode, Search, Package, MapPin, User, ShieldCheck,
  Tag, ExternalLink, Printer, AlertCircle, CheckCircle2, RotateCcw
} from 'lucide-react'
import { lookupBarcode } from '../../api/verification.api'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import { formatCurrency } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import toast from 'react-hot-toast'

export default function BarcodeLookupPage() {
  const [barcodeInput, setBarcodeInput] = useState('')
  const [resolvedItem, setResolvedItem] = useState(null)
  const inputRef = useRef(null)

  const lookupMutation = useMutation({
    mutationFn: (barcode) => lookupBarcode({ barcode }),
    onSuccess: (res) => {
      const data = res?.data || res
      setResolvedItem(data)
      toast.success('Asset identified successfully')
    },
    onError: (err) => {
      setResolvedItem(null)
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        'No active asset found matching this barcode in your office scope.'
      toast.error(msg)
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const clean = barcodeInput.trim()
    if (!clean) {
      toast.error('Please enter or scan a barcode number or asset code.')
      return
    }
    lookupMutation.mutate(clean)
  }

  const handleClear = () => {
    setBarcodeInput('')
    setResolvedItem(null)
    if (inputRef.current) inputRef.current.focus()
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Asset Barcode Lookup & Identity"
        subtitle="Instant optical verification and physical inventory identifier"
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.VERIFICATION_SESSIONS}>
              <Button variant="secondary" size="sm" leftIcon={<QrCode size={14} />}>
                Audit Sessions
              </Button>
            </Link>
          </div>
        }
      />

      {/* Barcode / QR Input Box */}
      <GlassCard level={1} className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Scan Barcode / Enter Asset Identification Code <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
                <QrCode size={18} />
              </div>
              <input
                ref={inputRef}
                type="text"
                autoFocus
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="e.g. BC-AST-00001 or AST-GS-VRV-2026-00001"
                className="w-full pl-11 pr-28 py-3 text-base font-mono bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="absolute inset-y-1.5 right-1.5 flex items-center gap-1.5">
                {barcodeInput && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Clear
                  </button>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={lookupMutation.isPending}
                  leftIcon={<Search size={14} />}
                >
                  Lookup
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              Supports optical handheld 1D USB/Bluetooth laser scanners, 2D QR readers, and manual asset code input.
            </p>
          </div>
        </form>
      </GlassCard>

      {/* Lookup Error Message */}
      {lookupMutation.isError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-200 flex items-start gap-3 text-xs">
          <AlertCircle size={17} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Asset Not Found in Database</p>
            <p className="mt-0.5 text-rose-700 dark:text-rose-300">
              {lookupMutation.error?.response?.data?.error?.message ||
                lookupMutation.error?.response?.data?.detail ||
                `The scanned identifier "${barcodeInput}" could not be resolved against records in the current office.`}
            </p>
          </div>
        </div>
      )}

      {/* Resolved Asset Card */}
      {resolvedItem && (
        <GlassCard level={2} className="p-6 space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 dark:border-emerald-500/15 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-extrabold text-slate-900 dark:text-emerald-400">
                  {resolvedItem.item_code}
                </span>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-emerald-950/40 text-slate-700 dark:text-emerald-300 border border-slate-200 dark:border-emerald-500/20">
                  {resolvedItem.barcode_number}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {resolvedItem.item_name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {resolvedItem.category_name}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link to={ROUTES.INVENTORY_DETAIL(resolvedItem.item_id)}>
                <Button variant="secondary" size="sm" rightIcon={<ExternalLink size={13} />}>
                  Asset Profile
                </Button>
              </Link>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15">
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Storage Location</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <MapPin size={14} className="text-emerald-600 dark:text-emerald-400" />
                {resolvedItem.location_name}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15">
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Current Custodian</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <User size={14} className="text-emerald-600 dark:text-emerald-400" />
                {resolvedItem.current_custodian || 'Unassigned / Store Custody'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15">
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Physical Condition</span>
              <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                {resolvedItem.condition}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15">
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Classification Status</span>
              <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Tag size={14} className="text-emerald-600 dark:text-emerald-400" />
                {resolvedItem.current_classification} ({resolvedItem.operational_status})
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Recorded Acquisition Cost:{' '}
              <strong className="text-slate-800 dark:text-slate-200 font-mono">
                {formatCurrency(resolvedItem.unit_purchase_cost ?? 0)}
              </strong>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <ShieldCheck size={14} /> Verified in PostgreSQL Store Registry
            </span>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
