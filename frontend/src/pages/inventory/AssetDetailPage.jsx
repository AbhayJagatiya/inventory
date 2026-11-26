import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Package, ArrowLeft, ArrowUpRight, RotateCcw, ArrowLeftRight,
  Wrench, TrendingDown, QrCode, FileText, Calendar,
  Building2, User, DollarSign, Clock, ShieldCheck, Tag,
  Printer, CheckCircle2, MapPin, Download
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import StatusBadge from '../../components/common/StatusBadge'
import LoadingSkeleton from '../../components/feedback/LoadingSkeleton'
import ErrorState from '../../components/feedback/ErrorState'
import { getItem, getItemHistory } from '../../api/inventory.api'
import { getBarcodeLabel } from '../../api/verification.api'
import { formatCurrency, formatNumber, formatDate, formatDateTime } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { PERMISSIONS } from '../../constants/permissions'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { useLanguage } from '../../i18n'
import { translateEnum, translateMasterName } from '../../i18n/enumLabels'

export default function AssetDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('overview')
  const [labelPreviewUrl, setLabelPreviewUrl] = useState('')
  const [downloadingFormat, setDownloadingFormat] = useState('')

  // Fetch Item Query
  const { data: itemData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      const res = await getItem(id)
      return res?.data || res
    },
  })

  // Fetch History Query
  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['item-history', id],
    queryFn: async () => {
      const res = await getItemHistory(id, { limit: 100 })
      return res?.data || []
    },
    enabled: Boolean(id),
  })

  const item = itemData || {}
  const historyEvents = historyData || []
  const isDurable = item.item_type === 'DURABLE_ASSET'
  const isDisposed = item.operational_status === 'DISPOSED'
  const canPrintBarcode = hasPermission(PERMISSIONS.BARCODE_PRINT)

  // Fetch real QR + Code 128 label image from backend
  const { data: labelBlob, isLoading: isLabelLoading } = useQuery({
    queryKey: ['item-barcode-label', id],
    queryFn: async () => {
      const res = await getBarcodeLabel(id, { format: 'png' })
      return res.data
    },
    enabled: Boolean(id && item.id && !isDisposed && canPrintBarcode),
    retry: false,
  })

  useEffect(() => {
    if (!labelBlob) {
      setLabelPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(labelBlob)
    setLabelPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [labelBlob])

  const handleDownloadLabel = async (format) => {
    try {
      setDownloadingFormat(format)
      const res = await getBarcodeLabel(id, { format })
      const blobUrl = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `label-${item.item_code || id}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(blobUrl)
      toast.success(t('inventory.detail.toastDownloadSuccess', { format: format.toUpperCase() }))
    } catch (err) {
      toast.error(
        err?.response?.data?.detail ||
          t('inventory.detail.toastDownloadError', { format: format.toUpperCase() })
      )
    } finally {
      setDownloadingFormat('')
    }
  }

  const handlePrintLabel = () => {
    if (!labelPreviewUrl) {
      window.print()
      return
    }
    const printWin = window.open('', '_blank', 'width=820,height=520')
    if (!printWin) {
      toast.error(t('inventory.detail.popupError'))
      return
    }
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${t('inventory.detail.printDocTitle', { code: item.item_code || '' })}</title>
          <style>
            body { margin: 0; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif; }
            img { max-width: 100%; height: auto; border: 1px solid #cbd5e1; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <img src="${labelPreviewUrl}" alt="Asset QR Label" onload="window.print();" />
        </body>
      </html>
    `)
    printWin.document.close()
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="h-10 bg-forest-500/10 dark:bg-forest-300/10 rounded-xl animate-pulse w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 bg-forest-500/10 dark:bg-forest-300/10 rounded-2xl animate-pulse" />
          <div className="md:col-span-2 h-64 bg-forest-500/10 dark:bg-forest-300/10 rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (isError) {
    return <ErrorState title={t('inventory.detail.loadErrorTitle')} message={t('inventory.detail.loadErrorMessage')} onRetry={refetch} />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <PageHeader
        title={item.item_name || t('inventory.assetDetail')}
        subtitle={`${t('inventory.table.assetCode')}: ${item.item_code} · ${isDurable ? t('itemType.durableAsset') : t('itemType.consumableStock')}`}
        actions={
          <div className="flex items-center gap-2.5">
            <Link to={ROUTES.INVENTORY}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                {t('inventory.detail.backToRegister')}
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
          </div>
        }
      />

      {/* Top Banner: Statuses & Quick Stats */}
      <GlassCard level={1} className="p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-forest-500/15 border border-forest-500/20 text-forest-700 dark:text-forest-300 flex items-center justify-center font-bold text-xl shadow-sm">
            <Package size={28} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-mono text-sm font-bold text-forest-950 dark:text-forest-50">
                {item.item_code}
              </span>
              <StatusBadge status={item.operational_status} size="sm" />
              <StatusBadge status={item.classification} size="sm" />
              <StatusBadge status={item.condition} size="sm" />
            </div>
            <p className="text-xs text-forest-600 dark:text-forest-400">
              {t('labels.category')}:{' '}
              <span className="font-semibold text-forest-900 dark:text-forest-100">
                {translateMasterName(t, 'category', item.category?.code, item.category?.name) || t('labels.na')}
              </span>{' '}
              · {t('labels.unit')}:{' '}
              <span className="font-semibold text-forest-900 dark:text-forest-100">
                {translateMasterName(t, 'uom', item.uom, item.uom) || 'NOS'}
              </span>{' '}
              · {t('labels.quantity')}:{' '}
              <span className="font-semibold font-mono text-forest-900 dark:text-forest-100">
                {formatNumber(item.quantity)}
              </span>
            </p>
          </div>
        </div>

        {/* Operational Action Shortcuts */}
        {!isDisposed && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {item.operational_status === 'AVAILABLE_IN_STORE' && (
              <Link to={ROUTES.ISSUES_NEW}>
                <Button variant="primary" size="xs" leftIcon={<ArrowUpRight size={13} />}>
                  {t('transactions.issues.add')}
                </Button>
              </Link>
            )}
            {item.operational_status === 'IN_USE' && (
              <Link to={ROUTES.RETURNS_NEW}>
                <Button variant="secondary" size="xs" leftIcon={<RotateCcw size={13} />}>
                  {t('transactions.returns.add')}
                </Button>
              </Link>
            )}
            <Link to={ROUTES.TRANSFERS_NEW}>
              <Button variant="secondary" size="xs" leftIcon={<ArrowLeftRight size={13} />}>
                {t('transactions.transfers.add')}
              </Button>
            </Link>
            <Link to={ROUTES.CONDEMNATIONS}>
              <Button variant="secondary" size="xs" leftIcon={<TrendingDown size={13} />}>
                {t('deadStock.condemnation.add')}
              </Button>
            </Link>
          </div>
        )}
      </GlassCard>

      {/* Tabs */}
      <div className="border-b border-forest-500/10 dark:border-forest-400/10 flex gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 transition-colors ${
            activeTab === 'overview'
              ? 'border-b-2 border-forest-500 text-forest-700 dark:text-forest-300 font-bold'
              : 'text-forest-600 dark:text-forest-400 hover:text-forest-900 dark:hover:text-forest-100'
          }`}
        >
          {t('inventory.detail.tabOverview')}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 transition-colors flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'border-b-2 border-forest-500 text-forest-700 dark:text-forest-300 font-bold'
              : 'text-forest-600 dark:text-forest-400 hover:text-forest-900 dark:hover:text-forest-100'
          }`}
        >
          <Clock size={15} />
          {t('inventory.detail.tabHistory', { count: historyEvents.length })}
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Core Specifications & Barcode */}
          <div className="space-y-6">
            <GlassCard level={1} className="p-5 space-y-4">
              <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50 flex items-center gap-2">
                <QrCode size={16} className="text-forest-600 dark:text-forest-300" />
                {t('inventory.detail.qrHeader')}
              </h2>

              <div className="p-3 bg-white rounded-xl border border-forest-500/20 flex flex-col items-center justify-center text-center space-y-2">
                {isDisposed ? (
                  <p className="text-xs text-slate-500 py-4">
                    {t('inventory.detail.disposedNotice')}
                  </p>
                ) : !canPrintBarcode ? (
                  <p className="text-xs text-slate-500 py-4">
                    {t('inventory.detail.noPrintPerm')}
                  </p>
                ) : isLabelLoading ? (
                  <div className="w-full h-28 bg-slate-100 rounded-lg animate-pulse" />
                ) : labelPreviewUrl ? (
                  <img
                    src={labelPreviewUrl}
                    alt={`${t('inventory.detail.labelAlt')} - ${item.item_code || ''}`}
                    className="w-full max-w-[320px] h-auto rounded"
                  />
                ) : (
                  <p className="text-xs text-slate-500 py-4">
                    {t('inventory.detail.labelFallback')}
                  </p>
                )}

                <span className="font-mono text-xs font-bold text-slate-900">
                  {t('inventory.detail.barcodeValueLabel', {
                    code: item.barcode_number || item.item_code || '—',
                  })}
                </span>
              </div>

              {!isDisposed && canPrintBarcode && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="xs"
                    leftIcon={<Printer size={12} />}
                    onClick={handlePrintLabel}
                  >
                    {t('inventory.detail.btnPrint')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    loading={downloadingFormat === 'png'}
                    leftIcon={<Download size={12} />}
                    onClick={() => handleDownloadLabel('png')}
                  >
                    {t('inventory.detail.btnPng')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    loading={downloadingFormat === 'pdf'}
                    leftIcon={<Download size={12} />}
                    onClick={() => handleDownloadLabel('pdf')}
                  >
                    {t('inventory.detail.btnPdf')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    loading={downloadingFormat === 'svg'}
                    leftIcon={<Download size={12} />}
                    onClick={() => handleDownloadLabel('svg')}
                  >
                    SVG
                  </Button>
                </div>
              )}

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-forest-500/5">
                  <span className="text-forest-500">{t('inventory.detail.brandManufacturer')}:</span>
                  <span className="font-semibold text-forest-900 dark:text-forest-100">{item.brand || '—'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-forest-500/5">
                  <span className="text-forest-500">{t('inventory.detail.modelNumber')}:</span>
                  <span className="font-semibold text-forest-900 dark:text-forest-100">{item.model_number || '—'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-forest-500/5">
                  <span className="text-forest-500">{t('labels.serialNumber')}:</span>
                  <span className="font-mono font-semibold text-forest-900 dark:text-forest-100">{item.serial_number || t('labels.na')}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-forest-500">{t('labels.classification')}:</span>
                  <StatusBadge status={item.classification} size="xs" />
                </div>
              </div>
            </GlassCard>

            {/* Location & Custody */}
            <GlassCard level={1} className="p-5 space-y-3">
              <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50 flex items-center gap-2">
                <MapPin size={16} className="text-forest-600 dark:text-forest-300" />
                {t('inventory.detail.locationCustodyHeading')}
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-forest-500/5 gap-2">
                  <span className="text-forest-500 shrink-0">{t('inventory.detail.officeLocation')}:</span>
                  <span className="font-semibold text-forest-900 dark:text-forest-100 text-right">
                    {translateMasterName(t, 'office', item.office_code, item.office_name) ||
                      t('inventory.detail.notAssigned')}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-forest-500/5 gap-2">
                  <span className="text-forest-500 shrink-0">{t('inventory.detail.roomBay')}:</span>
                  <span className="font-semibold text-forest-900 dark:text-forest-100 text-right">
                    {item.location
                      ? item.location.building_name
                        ? `${item.location.building_name} - ${item.location.room_number}`
                        : item.location.room_number
                      : t('inventory.detail.notAssigned')}
                  </span>
                </div>
                {item.current_department && (
                  <div className="flex justify-between py-1.5 border-b border-forest-500/5 gap-2">
                    <span className="text-forest-500 shrink-0">{t('inventory.detail.department')}:</span>
                    <span className="font-semibold text-forest-900 dark:text-forest-100 text-right">
                      {item.current_department}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 gap-2">
                  <span className="text-forest-500 shrink-0">{t('inventory.detail.currentCustodian')}:</span>
                  <span className="font-semibold text-forest-900 dark:text-forest-100 text-right">
                    {item.current_custodian || t('inventory.detail.unassignedPool')}
                  </span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Column 2 & 3: Financials, Warranty & Specifications */}
          <div className="lg:col-span-2 space-y-6">
            <GlassCard level={1} className="p-6 space-y-4">
              <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50 flex items-center gap-2">
                <DollarSign size={16} className="text-emerald-600" />
                {t('inventory.detail.financialsHeading')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10">
                  <span className="text-[11px] text-forest-500 block mb-1">{t('inventory.detail.unitCost')}</span>
                  <span className="text-base font-bold text-forest-950 dark:text-forest-50 font-mono">
                    {formatCurrency(item.unit_purchase_cost ?? 0)}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10">
                  <span className="text-[11px] text-forest-500 block mb-1">{t('inventory.detail.totalValue')}</span>
                  <span className="text-base font-bold text-forest-950 dark:text-forest-50 font-mono">
                    {formatCurrency(
                      item.total_cost ?? (Number(item.unit_purchase_cost) || 0) * (Number(item.quantity) || 1)
                    )}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10">
                  <span className="text-[11px] text-forest-500 block mb-1">{t('inventory.detail.acquisitionDate')}</span>
                  <span className="text-base font-bold text-forest-950 dark:text-forest-50">
                    {item.purchase_date ? formatDate(item.purchase_date) : '—'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-forest-500/5">
                  <span className="text-forest-500">{t('inventory.detail.supplierVendor')}:</span>
                  <span className="font-semibold text-forest-900 dark:text-forest-100">
                    {item.supplier_name || t('inventory.detail.notRecorded')}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-forest-500/5">
                  <span className="text-forest-500">{t('labels.invoiceNumber')}:</span>
                  <span className="font-mono font-semibold text-forest-900 dark:text-forest-100">
                    {item.invoice_number || t('inventory.detail.notRecorded')}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-forest-500">{t('inventory.detail.warrantyExpiry')}:</span>
                  <span className="font-semibold text-forest-900 dark:text-forest-100">
                    {item.warranty_expiry_date ? formatDate(item.warranty_expiry_date) : t('inventory.detail.notRecorded')}
                  </span>
                </div>
              </div>
            </GlassCard>

            {/* Technical Specifications */}
            {item.description && (
              <GlassCard level={1} className="p-6">
                <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50 mb-2">
                  {t('inventory.detail.techSpecsHeading')}
                </h2>
                <p className="text-xs text-forest-700 dark:text-forest-300 leading-relaxed whitespace-pre-line">
                  {item.description}
                </p>
              </GlassCard>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Movement & Audit History */}
      {activeTab === 'history' && (
        <GlassCard level={1} className="p-6">
          <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-forest-600 dark:text-forest-400" />
            {t('inventory.detail.auditTrailHeading')}
          </h2>

          {isHistoryLoading ? (
            <div className="space-y-3">
              <div className="h-16 bg-forest-500/10 rounded-xl animate-pulse" />
              <div className="h-16 bg-forest-500/10 rounded-xl animate-pulse" />
            </div>
          ) : historyEvents.length === 0 ? (
            <p className="text-xs text-forest-500 dark:text-forest-400 py-6 text-center">
              {t('inventory.detail.noHistory')}
            </p>
          ) : (
            <div className="relative border-l-2 border-forest-500/20 dark:border-forest-400/20 ml-3 space-y-6 py-2">
              {historyEvents.map((event, i) => {
                const eventLabels = {
                  VERIFICATION_SCAN: t('auditEvents.verificationScan'),
                  VERIFICATION_AUDIT: t('auditEvents.verificationAudit'),
                  VERIFY_UPDATE: t('auditEvents.verifyUpdate'),
                  MAINTENANCE: t('auditEvents.maintenance'),
                  RECEIPT: t('auditEvents.receipt'),
                  ISSUE: t('auditEvents.issue'),
                  RETURN: t('auditEvents.return'),
                  TRANSFER: t('auditEvents.transfer'),
                }
                const title = eventLabels[event.event_type] || event.title || event.event_type
                const timestamp = event.event_date || event.created_at
                const detailsText = event.details || event.remarks || '—'
                return (
                  <div key={event.id || `${event.event_type}-${timestamp}-${i}`} className="relative pl-6">
                    <div className="absolute -left-2 top-1 w-4 h-4 rounded-full bg-forest-500 border-2 border-white dark:border-forest-900 ring-4 ring-forest-500/10" />
                    <div className="p-4 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-forest-950 dark:text-forest-50">
                            {title}
                          </span>
                          {event.condition && <StatusBadge status={event.condition} size="xs" />}
                          {event.location_name && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-forest-500/10 text-forest-700 dark:text-forest-300">
                              {event.location_name}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-forest-500">
                          {timestamp ? formatDateTime(timestamp) : '—'}
                        </span>
                      </div>
                      <p className="text-xs text-forest-600 dark:text-forest-300 mt-1">
                        {detailsText}
                      </p>
                      <div className="mt-2 text-[11px] text-forest-500 flex items-center gap-2 font-mono flex-wrap">
                        <span>{t('inventory.detail.refLabel', { ref: event.reference_number || t('labels.na') })}</span> ·
                        <span>
                          {t('inventory.detail.loggedBy', {
                            actor: event.actor_name || t('auditEvents.loggedByFallback'),
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </GlassCard>
      )}
    </motion.div>
  )
}
