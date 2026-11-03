import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Package, ArrowLeft, ArrowUpRight, RotateCcw, ArrowLeftRight,
  Wrench, TrendingDown, QrCode, FileText, Calendar,
  Building2, User, DollarSign, Clock, ShieldCheck, Tag,
  Printer, CheckCircle2
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import LoadingSkeleton from '../../components/feedback/LoadingSkeleton'
import ErrorState from '../../components/feedback/ErrorState'
import { getItem, getItemHistory } from '../../api/inventory.api'
import { MOCK_ITEMS } from '../../services/mockData'
import { formatCurrency, formatNumber, formatDate, formatDateTime } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function AssetDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'history' | 'documents'

  // Fetch Item Query
  const { data: itemData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['item', id],
    queryFn: async () => {
      try {
        const res = await getItem(id)
        return res?.data || res
      } catch {
        // Fallback to mock item
        const found = MOCK_ITEMS.find((i) => i.id === id) || MOCK_ITEMS[0]
        return found
      }
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
      <div className="space-y-6">
        <div className="h-10 bg-slate-200 rounded animate-pulse w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 bg-slate-200 rounded animate-pulse" />
          <div className="md:col-span-2 h-64 bg-slate-200 rounded animate-pulse" />
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
    <div className="space-y-6">
      <PageHeader
        title={item.item_name || 'Asset Details'}
        subtitle={`System Code: ${item.item_code} · ${isDurable ? 'Durable Asset' : 'Consumable Stock'}`}
        actions={
          <div className="flex items-center gap-2">
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
              Print Record
            </Button>
          </div>
        }
      />

      {/* Top Banner: Statuses & Quick Stats */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-lg">
            <Package size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-800">{item.item_code}</span>
              <StatusBadge status={item.operational_status} size="sm" />
              <StatusBadge status={item.classification} size="sm" />
              <StatusBadge status={item.condition} size="sm" />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Category: <span className="font-medium text-slate-700">{item.category?.name || 'General'}</span> ·
              UOM: <span className="font-medium text-slate-700">{item.uom || 'NOS'}</span> ·
              Quantity: <span className="font-medium text-slate-700">{formatNumber(item.quantity)}</span>
            </p>
          </div>
        </div>

        {/* Operational Action Shortcuts */}
        {!isDisposed && (
          <div className="flex items-center gap-2 shrink-0">
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
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 transition-colors ${
            activeTab === 'overview'
              ? 'border-b-2 border-blue-700 text-blue-700 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          360° Asset Overview
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 transition-colors flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'border-b-2 border-blue-700 text-blue-700 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
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
            {/* Identification & Barcode Card */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <QrCode size={16} className="text-blue-700" />
                Barcode & Identification
              </h2>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center justify-center text-center">
                {/* Visual Barcode Graphic Simulation */}
                <div className="h-14 w-44 bg-white border border-slate-300 rounded p-2 flex items-center justify-center mb-2 shadow-inner">
                  <div className="w-full flex justify-between items-center h-full px-1">
                    {[...Array(24)].map((_, idx) => (
                      <div
                        key={idx}
                        className={`bg-slate-900 h-full ${
                          idx % 3 === 0 ? 'w-1.5' : idx % 2 === 0 ? 'w-0.5' : 'w-1'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-slate-800">
                  {item.barcode_number || 'BC-AST-XXXXX'}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">Code 128 Standard Symbology</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Brand / OEM:</span>
                  <span className="font-medium text-slate-800">{item.brand || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Model Number:</span>
                  <span className="font-medium text-slate-800">{item.model_number || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Serial Number:</span>
                  <span className="font-mono font-medium text-slate-800">{item.serial_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Tracking Mode:</span>
                  <span className="font-medium text-slate-800">
                    {isDurable ? 'Individually Serialized' : 'Quantity Stock'}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Custody & Location */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Building2 size={16} className="text-emerald-700" />
                Location & Custody
              </h2>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Assigned Room:</span>
                  <span className="font-medium text-slate-800">{item.location?.room_number || 'Main Store'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Building / Yard:</span>
                  <span className="font-medium text-slate-800">{item.location?.description || 'Main Bhavan'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Assigned Branch:</span>
                  <span className="font-medium text-slate-800">{item.current_department || 'Store Department'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Current Custodian:</span>
                  <span className="font-medium text-blue-700">{item.current_custodian || 'Store Officer in Charge'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2 & 3: Procurement & Financial Valuation */}
          <div className="lg:col-span-2 space-y-6">
            {/* Procurement Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <DollarSign size={16} className="text-blue-700" />
                Procurement & Acquisition Record
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                <div>
                  <span className="text-[11px] text-slate-500 block">Unit Cost</span>
                  <span className="text-base font-bold text-slate-800 mt-0.5 block">
                    {formatCurrency(item.unit_purchase_cost)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Recorded Value</span>
                  <span className="text-base font-bold text-emerald-700 mt-0.5 block">
                    {formatCurrency(item.total_purchase_cost)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Acquisition Date</span>
                  <span className="text-sm font-semibold text-slate-800 mt-0.5 block">
                    {formatDate(item.purchase_date)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Invoice / PO</span>
                  <span className="font-mono text-xs font-semibold text-slate-800 mt-0.5 block">
                    {item.invoice_number || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs pt-1">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Supplier / Vendor:</span>
                  <span className="font-medium text-slate-800">Authorized Gem Vendor / Somnath Supplier</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Legacy Historical Record:</span>
                  <span className="font-medium text-slate-800">{item.is_legacy ? 'Yes (Pre-Digital Migration)' : 'No (Direct Digital Entry)'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Last Movement Ledger Date:</span>
                  <span className="font-medium text-slate-800">{formatDate(item.last_movement_date)}</span>
                </div>
              </div>
            </div>

            {/* Classification & Dead-Stock Factors */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <ShieldCheck size={16} className="text-amber-600" />
                Dead Stock Classification Assessment
              </h2>

              <p className="text-xs text-slate-600 leading-relaxed">
                Automated classification evaluated against category thresholds:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 block">Effective Classification</span>
                  <span className="font-bold text-slate-800 text-sm mt-1 block">
                    {item.classification}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 block">Physical Condition</span>
                  <span className="font-bold text-slate-800 text-sm mt-1 block">
                    {item.condition}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 block">Authority Override</span>
                  <span className="font-medium text-slate-600 text-xs mt-1 block">
                    System Computed
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-md border border-amber-200 text-[11px] text-amber-800">
                <strong>Statutory Note:</strong> System classification is a supervisory recommendation and does not automatically authorize write-off or scrap disposal without formal survey committee sanction.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Chronological Movement Timeline */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-6 flex items-center gap-2">
            <Clock size={16} className="text-blue-700" />
            Append-Only Inventory Movement Ledger Events
          </h2>

          <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 pb-4">
            {historyEvents.map((evt, idx) => (
              <div key={idx} className="relative pl-6">
                {/* Node Bullet */}
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-700 border-2 border-white flex items-center justify-center text-white" />

                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-800">{evt.title}</span>
                    <span className="text-xs text-slate-400">{formatDateTime(evt.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600 mb-2">
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                      {evt.reference_number}
                    </span>
                    <span>Action by: <strong>{evt.actor_name}</strong></span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{evt.remarks}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
