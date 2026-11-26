import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  QrCode, Search, MapPin, User, ShieldCheck, Tag, ExternalLink,
  Printer, AlertCircle, CheckCircle2, Camera, Keyboard, Building2,
  Calendar, Package, History
} from 'lucide-react'
import { getBarcodeLabel, lookupBarcode } from '../../api/verification.api'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import StatusBadge from '../../components/common/StatusBadge'
import QrCameraScanner from '../../components/verification/QrCameraScanner'
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { PERMISSIONS } from '../../constants/permissions'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function BarcodeLookupPage() {
  const { hasPermission } = useAuth()
  const [inputMode, setInputMode] = useState('MANUAL') // 'MANUAL' | 'CAMERA'
  const [barcodeInput, setBarcodeInput] = useState('')
  const [resolvedItem, setResolvedItem] = useState(null)
  const [recentLookups, setRecentLookups] = useState([])
  const [isPrintingLabel, setIsPrintingLabel] = useState(false)
  const inputRef = useRef(null)

  const lookupMutation = useMutation({
    mutationFn: (barcode) => lookupBarcode({ barcode }),
    onSuccess: (res) => {
      const data = res?.data || res
      setResolvedItem(data)
      setRecentLookups((prev) => {
        const filtered = prev.filter((item) => item.item_id !== data.item_id)
        return [data, ...filtered].slice(0, 5)
      })
      toast.success(`Asset identified: ${data.item_code}`)
    },
    onError: (err) => {
      setResolvedItem(null)
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        'No active asset found matching this code in your office scope.'
      toast.error(msg)
    },
  })

  const runLookup = (code) => {
    const clean = (code || '').trim()
    if (!clean) {
      toast.error('Please enter or scan a QR code, barcode, asset code, or serial number.')
      return
    }
    setBarcodeInput(clean)
    lookupMutation.mutate(clean)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    runLookup(barcodeInput)
  }

  const handleClear = () => {
    setBarcodeInput('')
    setResolvedItem(null)
    if (inputRef.current) inputRef.current.focus()
  }

  const handlePrintQrLabel = async (itemId, itemCode) => {
    try {
      setIsPrintingLabel(true)
      const res = await getBarcodeLabel(itemId, { format: 'png' })
      const blobUrl = URL.createObjectURL(res.data)
      const printWin = window.open('', '_blank', 'width=820,height=520')
      if (!printWin) {
        URL.revokeObjectURL(blobUrl)
        toast.error('Please allow pop-ups to print the QR label.')
        return
      }
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head><title>QR Label - ${itemCode}</title></head>
          <body style="margin:0;padding:24px;display:flex;justify-content:center;align-items:center;">
            <img src="${blobUrl}" alt="QR Label" style="max-width:100%;height:auto;" onload="window.print();" />
          </body>
        </html>
      `)
      printWin.document.close()
    } catch {
      toast.error('Unable to generate QR label for printing.')
    } finally {
      setIsPrintingLabel(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Asset QR & Barcode Lookup"
        subtitle="Search any asset instantly by scanning its QR code or entering its barcode, asset code, or serial number"
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

      {/* Mode Switcher + Input Box */}
      <GlassCard level={1} className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-emerald-500/15 pb-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={inputMode === 'MANUAL' ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={<Keyboard size={14} />}
              onClick={() => setInputMode('MANUAL')}
            >
              Manual Number / USB Scanner
            </Button>
            <Button
              type="button"
              variant={inputMode === 'CAMERA' ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={<Camera size={14} />}
              onClick={() => setInputMode('CAMERA')}
            >
              Camera QR Scan
            </Button>
          </div>

          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Accepts QR Code, Barcode (`BC-AST-...`), Asset Code (`AST-GS-VRV-...`), or Serial No.
          </span>
        </div>

        {/* Manual / Handheld Scanner Form (always available for quick edit or fallback) */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Enter or Scan Asset Identifier <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
              <QrCode size={18} />
            </div>
            <input
              ref={inputRef}
              type="text"
              autoFocus={inputMode === 'MANUAL'}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="e.g. BC-AST-00001, AST-GS-VRV-2024-00001, or Serial No."
              className="w-full pl-11 pr-32 py-3 text-sm sm:text-base font-mono bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
        </form>

        {/* Camera QR Scanner Panel */}
        {inputMode === 'CAMERA' && (
          <QrCameraScanner
            label="Desktop Webcam / Phone Camera QR Scanner"
            onScanSuccess={(decodedCode) => runLookup(decodedCode)}
            onError={(msg) => toast.error(msg)}
          />
        )}
      </GlassCard>

      {/* Lookup Error Message */}
      {lookupMutation.isError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-200 flex items-start gap-3 text-xs">
          <AlertCircle size={17} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Asset Not Found in Office Registry</p>
            <p className="mt-0.5 text-rose-700 dark:text-rose-300">
              {lookupMutation.error?.response?.data?.error?.message ||
                lookupMutation.error?.response?.data?.detail ||
                `The identifier "${barcodeInput}" could not be resolved against active records in your office.`}
            </p>
          </div>
        </div>
      )}

      {/* Resolved Asset Card */}
      {resolvedItem && (
        <GlassCard level={2} className="p-6 space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 dark:border-emerald-500/15 pb-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-lg font-extrabold text-slate-900 dark:text-emerald-400">
                  {resolvedItem.item_code}
                </span>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-emerald-950/40 text-slate-700 dark:text-emerald-300 border border-slate-200 dark:border-emerald-500/20">
                  {resolvedItem.barcode_number}
                </span>
                <StatusBadge status={resolvedItem.condition} size="xs" />
                <StatusBadge status={resolvedItem.operational_status} size="xs" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {resolvedItem.item_name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {resolvedItem.category_name} · {resolvedItem.item_type === 'DURABLE_ASSET' ? 'Durable Asset' : 'Consumable Stock'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {hasPermission(PERMISSIONS.BARCODE_PRINT) && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={isPrintingLabel}
                  leftIcon={<Printer size={13} />}
                  onClick={() => handlePrintQrLabel(resolvedItem.item_id, resolvedItem.item_code)}
                >
                  Print QR Label
                </Button>
              )}
              <Link to={ROUTES.INVENTORY_DETAIL(resolvedItem.item_id)}>
                <Button variant="primary" size="sm" rightIcon={<ExternalLink size={13} />}>
                  Full Asset Profile
                </Button>
              </Link>
            </div>
          </div>

          {/* Primary Location / Custody / Condition Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15">
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Storage Location</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <MapPin size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{resolvedItem.location_name}</span>
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15">
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Custodian & Department</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <User size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{resolvedItem.current_custodian || 'Store Custody'}</span>
              </p>
              {resolvedItem.current_department && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                  <Building2 size={11} /> {resolvedItem.current_department}
                </p>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15">
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Physical Condition</span>
              <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{resolvedItem.condition}</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Available Qty: <strong className="font-mono">{formatNumber(resolvedItem.available_qty ?? 1)}</strong>
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15">
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Classification & Status</span>
              <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Tag size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{resolvedItem.current_classification}</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Status: {resolvedItem.operational_status}
              </p>
            </div>
          </div>

          {/* Secondary Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-100 dark:border-emerald-500/15">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Brand / Model</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {[resolvedItem.brand, resolvedItem.model_number].filter(Boolean).join(' · ') || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Serial Number</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {resolvedItem.serial_number || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block flex items-center gap-1">
                <Calendar size={11} /> Purchase Date
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {resolvedItem.purchase_date ? formatDate(resolvedItem.purchase_date) : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Unit Purchase Cost</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {formatCurrency(resolvedItem.unit_purchase_cost ?? 0)}
              </span>
            </div>
          </div>

          <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Package size={13} />
              Last Movement:{' '}
              <strong className="text-slate-700 dark:text-slate-300">
                {resolvedItem.last_movement_date ? formatDate(resolvedItem.last_movement_date) : 'No movements logged'}
              </strong>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <ShieldCheck size={14} /> Verified in Store Registry
            </span>
          </div>
        </GlassCard>
      )}

      {/* Recent Session Lookups */}
      {recentLookups.length > 0 && (
        <GlassCard level={1} className="p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <History size={14} className="text-emerald-600 dark:text-emerald-400" />
            Recently Checked Assets
          </div>
          <div className="flex flex-wrap gap-2">
            {recentLookups.map((item) => (
              <button
                key={item.item_id}
                type="button"
                onClick={() => {
                  setBarcodeInput(item.barcode_number || item.item_code)
                  setResolvedItem(item)
                }}
                className="px-3 py-1.5 rounded-lg text-xs bg-slate-100 hover:bg-emerald-500/15 dark:bg-[#0A1513] dark:hover:bg-emerald-500/20 border border-slate-200 dark:border-emerald-500/20 text-slate-800 dark:text-slate-200 transition-colors"
              >
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{item.item_code}</span>{' '}
                · {item.item_name}
              </button>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  )
}
