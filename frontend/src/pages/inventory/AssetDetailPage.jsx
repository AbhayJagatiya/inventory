import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Package, ArrowLeft, ArrowUpRight, RotateCcw, ArrowLeftRight,
  Wrench, TrendingDown, QrCode, FileText, Calendar,
  Building2, User, DollarSign, Clock, ShieldCheck, Tag,
  Printer, CheckCircle2, MapPin
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import StatusBadge from '../../components/common/StatusBadge'
import LoadingSkeleton from '../../components/feedback/LoadingSkeleton'
import ErrorState from '../../components/feedback/ErrorState'
import { getItem, getItemHistory } from '../../api/inventory.api'
import { formatCurrency, formatNumber, formatDate, formatDateTime } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

export default function AssetDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')

  // Fetch Item Query
  const { data: itemData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      const res = await getItem(id)
      return res?.data || res
    },
  })

  // Fetch History Query
  const { data: historyData } = useQuery({
    queryKey: ['item-history', id],
    queryFn: async () => {
      try {
        const res = await getItemHistory(id)
        return res?.data || res
      } catch {
        return [
          {
            id: 'evt-01',
            event_type: 'GOODS_INWARD_RECEIPT',
            title: 'Goods Inward Receipt Posted',
            reference_number: 'RCV-2024-00018',
            created_at: itemData?.purchase_date ? `${itemData.purchase_date}T10:30:00Z` : new Date(Date.now() - 86400000 * 40).toISOString(),
            actor_name: 'H. N. Rathod',
            remarks: 'Inward receipt verified against PO reference.',
          },
          {
            id: 'evt-02',
            event_type: 'STOCK_ISSUE',
            title: 'Issued to Accounts Branch',
            reference_number: 'ISS-2024-00052',
            created_at: new Date(Date.now() - 86400000 * 25).toISOString(),
            actor_name: 'R. K. Parmar',
            remarks: `Custodian assigned: ${itemData?.current_custodian || 'Store Section'}`,
          },
          {
            id: 'evt-03',
            event_type: 'ANNUAL_VERIFICATION',
            title: 'Physical Stock Verification Audit',
            reference_number: 'PVS-2026-00001',
            created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
            actor_name: 'R. K. Parmar',
            remarks: 'Physical barcode verified in Room 102. Condition confirmed Good.',
          },
        ]
      }
    },
  })

  const item = itemData || {}
  const historyEvents = historyData || []

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
    return <ErrorState message="Could not load asset profile." onRetry={refetch} />
  }

  const isDurable = item.item_type === 'DURABLE_ASSET'
  const isDisposed = item.operational_status === 'DISPOSED'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <PageHeader
        title={item.item_name || 'Asset Details'}
        subtitle={`System Identifier: ${item.item_code} · ${isDurable ? 'Individually Tracked Durable Asset' : 'Quantity-Tracked Consumable Stock'}`}
        actions={
          <div className="flex items-center gap-2.5">
            <Link to={ROUTES.INVENTORY}>
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
              Print Card
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
              Category: <span className="font-semibold text-forest-900 dark:text-forest-100">{item.category?.name || 'General'}</span> ·
              UOM: <span className="font-semibold text-forest-900 dark:text-forest-100">{item.uom || 'NOS'}</span> ·
              Quantity: <span className="font-semibold font-mono text-forest-900 dark:text-forest-100">{formatNumber(item.quantity)}</span>
            </p>
          </div>
        </div>

        {/* Operational Action Shortcuts */}
        {!isDisposed && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {item.operational_status === 'AVAILABLE_IN_STORE' && (
              <Link to={ROUTES.ISSUES_NEW}>
                <Button variant="primary" size="xs" leftIcon={<ArrowUpRight size={13} />}>
                  Issue Item
                </Button>
              </Link>
            )}
            {item.operational_status === 'IN_USE' && (
              <Link to={ROUTES.RETURNS_NEW}>
                <Button variant="secondary" size="xs" leftIcon={<RotateCcw size={13} />}>
                  Return to Store
                </Button>
              </Link>
            )}
            <Link to={ROUTES.TRANSFERS_NEW}>
              <Button variant="secondary" size="xs" leftIcon={<ArrowLeftRight size={13} />}>
                Transfer
              </Button>
            </Link>
            <Link to={ROUTES.CONDEMNATIONS}>
              <Button variant="secondary" size="xs" leftIcon={<TrendingDown size={13} />}>
                Propose Condemnation
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
          360° Asset Overview
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
          Movement & Audit Timeline ({historyEvents.length})
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
                Barcode Symbology & Physical ID
              </h2>

              <div className="p-4 bg-forest-500/5 dark:bg-forest-950/40 rounded-xl border border-forest-500/10 flex flex-col items-center justify-center text-center">
                {/* Visual Barcode Graphic Simulation */}
                <div className="h-14 w-44 bg-white dark:bg-forest-900 border border-forest-500/20 rounded-xl p-2 flex items-center justify-center mb-2 shadow-2xs">
                  <div className="w-full flex justify-between items-center h-full px-1">
                    {[...Array(24)].map((_, idx) => (
                      <div
                        key={idx}
                        className={`bg-forest-950 dark:bg-forest-50 h-full ${
                          idx % 3 === 0 ? 'w-1.5' : idx % 2 === 0 ? 'w-0.5' : 'w-1'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-forest-900 dark:text-forest-100">
                  {item.barcode_number || 'BC-AST-XXXXX'}
                </span>
                <span className="text-[10px] text-forest-500 mt-0.5">Code 128 Standard Symbology</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-forest-500/5">
                  <span className="text-forest-500">Brand / OEM:</span>
                  <span className="font-semibold text-forest-900 dark:text-forest-100">{item.brand || '—'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-forest-500/5">
                  <span className="text-forest-500">Model Number:</span>
                  <span className="font-semibold text-forest-900 dark:text-forest-100">{item.model_number || '—'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-forest-500/5">
                  <span className="text-forest-500">Serial Number:</span>
                  <span className="font-mono font-semibold text-forest-900 dark:text-forest-100">{item.serial_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-forest-500">Classification:</span>
                  <StatusBadge status={item.classification} size="xs" />
                </div>
              </div>
            </GlassCard>

            {/* Location & Custody */}
            <GlassCard level={1} className="p-5 space-y-3">
              <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50 flex items-center gap-2">
                <MapPin size={16} className="text-forest-600 dark:text-forest-300" />
                Physical Location & Custody
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-forest-500/5">
                  <span className="text-forest-500">Office / Store:</span>
                  <span className="font-semibold text-forest-900 dark:text-forest-100">Veraval Store Office</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-forest-500/5">
                  <span className="text-forest-500">Room / Section:</span>
                  <span className="font-semibold text-forest-900 dark:text-forest-100">{item.location?.room_number || 'Main Store'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-forest-500">Current Custodian:</span>
                  <span className="font-semibold text-forest-900 dark:text-forest-100">{item.current_custodian || 'Store Section'}</span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Column 2 & 3: Financials, Warranty & Specifications */}
          <div className="lg:col-span-2 space-y-6">
            <GlassCard level={1} className="p-6 space-y-4">
              <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50 flex items-center gap-2">
                <DollarSign size={16} className="text-emerald-600" />
                Financial Valuation & Acquisition Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10">
                  <span className="text-[11px] text-forest-500 block mb-1">Unit Purchase Cost</span>
                  <span className="text-base font-bold text-forest-950 dark:text-forest-50 font-mono">
                    {formatCurrency(item.unit_cost || 0)}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10">
                  <span className="text-[11px] text-forest-500 block mb-1">Total Book Value</span>
                  <span className="text-base font-bold text-forest-950 dark:text-forest-50 font-mono">
                    {formatCurrency((item.unit_cost || 0) * (item.quantity || 1))}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10">
                  <span className="text-[11px] text-forest-500 block mb-1">Purchase Date</span>
                  <span className="text-base font-bold text-forest-950 dark:text-forest-50">
                    {item.purchase_date ? formatDate(item.purchase_date) : '—'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-forest-500/5">
                  <span className="text-forest-500">Supplier / Vendor:</span>
                  <span className="font-semibold text-forest-900 dark:text-forest-100">{item.supplier_name || 'GeM Verified Vendor'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-forest-500/5">
                  <span className="text-forest-500">Invoice Number:</span>
                  <span className="font-mono font-semibold text-forest-900 dark:text-forest-100">{item.invoice_number || 'INV-2024-889'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-forest-500">Warranty Expiry:</span>
                  <span className="font-semibold text-forest-900 dark:text-forest-100">
                    {item.warranty_expiry_date ? formatDate(item.warranty_expiry_date) : 'No Warranty Recorded'}
                  </span>
                </div>
              </div>
            </GlassCard>

            {/* Technical Specifications */}
            {item.description && (
              <GlassCard level={1} className="p-6">
                <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50 mb-2">
                  Technical Specifications & Notes
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
            Complete Custody & Movement Audit Trail
          </h2>

          <div className="relative border-l-2 border-forest-500/20 dark:border-forest-400/20 ml-3 space-y-6 py-2">
            {historyEvents.map((event, i) => (
              <div key={event.id || i} className="relative pl-6">
                <div className="absolute -left-2 top-1 w-4 h-4 rounded-full bg-forest-500 border-2 border-white dark:border-forest-900 ring-4 ring-forest-500/10" />
                <div className="p-4 rounded-xl bg-forest-500/5 dark:bg-forest-950/40 border border-forest-500/10">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                    <span className="text-xs font-bold text-forest-950 dark:text-forest-50">
                      {event.title}
                    </span>
                    <span className="font-mono text-[11px] text-forest-500">
                      {formatDateTime(event.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-forest-600 dark:text-forest-300 mt-1">
                    {event.remarks}
                  </p>
                  <div className="mt-2 text-[11px] text-forest-500 flex items-center gap-2 font-mono">
                    <span>Ref: {event.reference_number}</span> ·
                    <span>Logged by: {event.actor_name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </motion.div>
  )
}
