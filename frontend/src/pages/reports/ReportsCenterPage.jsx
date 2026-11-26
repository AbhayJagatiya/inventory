import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Package,
  Monitor,
  Boxes,
  IndianRupee,
  ArrowLeftRight,
  ArchiveX,
  FileWarning,
  Trash2,
  Truck,
  ShieldCheck,
  Wrench,
  ClipboardCheck,
  ArrowRight,
  FileBarChart2,
  Clock,
  ShieldAlert,
  ShieldX,
  TrendingUp,
} from 'lucide-react'
import { getReportsOverview } from '../../api/reports.api'
import PageHeader from '../../components/layout/PageHeader'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import ErrorState from '../../components/feedback/ErrorState'
import { REPORT_TYPES } from '../../constants/enums'
import { ROUTES } from '../../constants/routes'
import { formatCurrency, formatDateTime, formatNumber } from '../../utils/formatters'
import { useLanguage } from '../../i18n'

const REPORT_CATALOG = [
  {
    type: REPORT_TYPES.STOCK_REGISTER,
    title: 'Stock Register',
    category: 'Inventory & Valuation',
    description: 'Complete register of active inventory items, available quantities, conditions, and storage locations.',
    icon: Package,
    accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    type: REPORT_TYPES.ASSET_REGISTER,
    title: 'Asset Register',
    category: 'Inventory & Valuation',
    description: 'Capital & durable asset ledger with serial numbers, acquisition dates, cost, and assigned custodians.',
    icon: Monitor,
    accent: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  {
    type: REPORT_TYPES.STOCK_QUANTITY,
    title: 'Stock Quantity Summary',
    category: 'Inventory & Valuation',
    description: 'Breakdown of available, allocated, vendor RMA, and disposed quantities across offices and rooms.',
    icon: Boxes,
    accent: 'text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/20',
  },
  {
    type: REPORT_TYPES.ASSET_VALUATION,
    title: 'Asset Valuation & Depreciation',
    category: 'Inventory & Valuation',
    description: 'Original purchase cost, asset age, applied depreciation rates, and estimated current book value.',
    icon: IndianRupee,
    accent: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    type: REPORT_TYPES.MOVEMENTS,
    title: 'Stock Movements Ledger',
    category: 'Operations & Audit',
    description: 'Chronological ledger of receipts, issues, returns, inter-office transfers, and reversal corrections.',
    icon: ArrowLeftRight,
    accent: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20',
  },
  {
    type: REPORT_TYPES.DEAD_STOCK,
    title: 'Dead Stock Register',
    category: 'Dead Stock & Disposal',
    description: 'Items classified as slow-moving, non-moving, or obsolete requiring review or condemnation.',
    icon: ArchiveX,
    accent: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  {
    type: REPORT_TYPES.CONDEMNATIONS,
    title: 'Condemnation Requests',
    category: 'Dead Stock & Disposal',
    description: 'Audit trail of condemnation proposals, committee review statuses, and approved scrap assessments.',
    icon: FileWarning,
    accent: 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20',
  },
  {
    type: REPORT_TYPES.DISPOSALS,
    title: 'Disposal Register',
    category: 'Dead Stock & Disposal',
    description: 'Executed disposals by auction, scrap sale, e-waste recycling, or destruction with realized proceeds.',
    icon: Trash2,
    accent: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
  {
    type: REPORT_TYPES.SUPPLIERS_PROCUREMENT,
    title: 'Suppliers & Procurement',
    category: 'Procurement & Maintenance',
    description: 'Procurement orders, supplier performance, invoice values, and delivery records.',
    icon: Truck,
    accent: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  },
  {
    type: REPORT_TYPES.WARRANTIES,
    title: 'Warranty & AMC Register',
    category: 'Procurement & Maintenance',
    description: 'Active, expiring-soon, and expired warranty/AMC contracts linked to registered assets.',
    icon: ShieldCheck,
    accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    type: REPORT_TYPES.MAINTENANCE,
    title: 'Maintenance & Repair Register',
    category: 'Procurement & Maintenance',
    description: 'Service tickets, external vendors, estimated vs. actual repair expenditure, and completion status.',
    icon: Wrench,
    accent: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20',
  },
  {
    type: REPORT_TYPES.PHYSICAL_VERIFICATION,
    title: 'Physical Verification & Audit',
    category: 'Operations & Audit',
    description: 'Physical stock-taking sessions, expected vs. scanned counts, and reconciled discrepancies.',
    icon: ClipboardCheck,
    accent: 'text-slate-700 dark:text-slate-300 bg-slate-500/10 border-slate-500/20',
  },
]

const CATEGORIES = [
  'All Reports',
  'Inventory & Valuation',
  'Dead Stock & Disposal',
  'Procurement & Maintenance',
  'Operations & Audit',
]

export default function ReportsCenterPage() {
  const { t } = useLanguage()
  const [selectedCategory, setSelectedCategory] = useState('All Reports')

  const {
    data: overviewRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['reports-overview'],
    queryFn: getReportsOverview,
  })

  const overview = overviewRes?.data || overviewRes || {}

  const filteredReports = useMemo(() => {
    if (selectedCategory === 'All Reports') return REPORT_CATALOG
    return REPORT_CATALOG.filter((r) => r.category === selectedCategory)
  }, [selectedCategory])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('reports.title', 'Reports & Analytics Center')}
        subtitle="District Panchayat, Gir Somnath, Veraval — Official Inventory Registers, Valuation & Audit Exports"
        actions={
          overview.calculated_at ? (
            <div className="inline-flex items-center gap-1.5 text-xs text-forest-700/80 dark:text-forest-300/80 bg-white/80 dark:bg-forest-900/60 border border-slate-200 dark:border-emerald-500/20 px-3 py-1.5 rounded-xl">
              <Clock size={13} />
              <span>Updated: {formatDateTime(overview.calculated_at)}</span>
            </div>
          ) : null
        }
      />

      {/* Overview KPI Section */}
      {isError ? (
        <GlassCard className="p-4">
          <ErrorState
            message={error?.response?.data?.error?.message || error?.message || 'Failed to load reports overview.'}
            onRetry={refetch}
          />
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="p-4" cursorLight>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total Registered Assets
                </p>
                <p className="text-2xl font-bold text-forest-950 dark:text-forest-50 mt-1">
                  {isLoading ? '—' : formatNumber(overview.total_registered_assets)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Current Stock Qty:{' '}
                  <span className="font-semibold text-forest-700 dark:text-forest-300">
                    {isLoading ? '—' : formatNumber(overview.current_stock_quantity)}
                  </span>
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Package size={20} />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" cursorLight>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total Acquisition Value
                </p>
                <p className="text-2xl font-bold text-forest-950 dark:text-forest-50 mt-1">
                  {isLoading ? '—' : formatCurrency(overview.total_acquisition_value)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Est. Valuation:{' '}
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {isLoading ? '—' : formatCurrency(overview.estimated_current_valuation)}
                  </span>
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <TrendingUp size={20} />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" cursorLight>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Dead Stock Count & Value
                </p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                  {isLoading ? '—' : formatNumber(overview.dead_stock_count)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Blocked Value:{' '}
                  <span className="font-semibold text-amber-700 dark:text-amber-300">
                    {isLoading ? '—' : formatCurrency(overview.dead_stock_value)}
                  </span>
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <ArchiveX size={20} />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" cursorLight>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total Disposals & Proceeds
                </p>
                <p className="text-2xl font-bold text-forest-950 dark:text-forest-50 mt-1">
                  {isLoading ? '—' : formatCurrency(overview.total_disposal_proceeds)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Disposals Executed:{' '}
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    {isLoading ? '—' : formatNumber(overview.total_disposals)}
                  </span>
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Trash2 size={20} />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" cursorLight>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Maintenance Expenditure
                </p>
                <p className="text-xl font-bold text-forest-950 dark:text-forest-50 mt-1">
                  {isLoading ? '—' : formatCurrency(overview.maintenance_expenditure)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Stock Movements:{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {isLoading ? '—' : formatNumber(overview.total_stock_movements)}
                  </span>
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Wrench size={20} />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" cursorLight>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Active Warranties
                </p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                  {isLoading ? '—' : formatNumber(overview.active_warranties_count)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Covered under active AMC / warranty
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={20} />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" cursorLight>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Expiring Warranties
                </p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                  {isLoading ? '—' : formatNumber(overview.expiring_warranties_count)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Due for renewal soon
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <ShieldAlert size={20} />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4" cursorLight>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Expired Warranties
                </p>
                <p className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">
                  {isLoading ? '—' : formatNumber(overview.expired_warranties_count)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Coverage lapsed
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <ShieldX size={20} />
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Category Filter Pills & Catalog */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileBarChart2 size={18} className="text-forest-600 dark:text-forest-400" />
            <h2 className="text-base font-bold text-forest-950 dark:text-forest-50">
              Official Registers & Reports ({filteredReports.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    active
                      ? 'bg-forest-500 text-white dark:bg-forest-400 dark:text-forest-950 shadow-xs'
                      : 'bg-white/80 dark:bg-forest-900/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-emerald-500/15 hover:bg-forest-50 dark:hover:bg-forest-800/60'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredReports.map((report) => {
            const Icon = report.icon
            return (
              <GlassCard
                key={report.type}
                interactive
                cursorLight
                className="p-5 flex flex-col justify-between h-full"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className={`p-2.5 rounded-xl border ${report.accent}`}>
                      <Icon size={20} />
                    </div>
                    <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-forest-800/80 text-slate-600 dark:text-slate-300">
                      {report.category}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-forest-950 dark:text-forest-50">
                    {report.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {report.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-emerald-500/10 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    {report.type}
                  </span>
                  <Link to={ROUTES.REPORT_VIEW(report.type)}>
                    <Button
                      variant="secondary"
                      size="sm"
                      rightIcon={<ArrowRight size={14} />}
                    >
                      Open Report
                    </Button>
                  </Link>
                </div>
              </GlassCard>
            )
          })}
        </div>
      </div>
    </div>
  )
}
