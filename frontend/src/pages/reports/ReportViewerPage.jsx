import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Filter,
  Printer,
  RotateCcw,
  Search,
  Building2,
  Calendar,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { generateExport, getReport } from '../../api/reports.api'
import { getCategories, getLocations } from '../../api/inventory.api'
import { getSuppliers } from '../../api/suppliers.api'
import { getOffices } from '../../api/administration.api'
import PageHeader from '../../components/layout/PageHeader'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { DataTable } from '../../components/tables/DataTable'
import ErrorState from '../../components/feedback/ErrorState'
import {
  CLASSIFICATIONS,
  CLASSIFICATION_LABELS,
  CONDEMNATION_STATUSES,
  CONDEMNATION_STATUS_LABELS,
  DISPOSAL_METHODS,
  DISPOSAL_METHOD_LABELS,
  EXPORT_FORMATS,
  MAINTENANCE_STATUSES,
  MAINTENANCE_STATUS_LABELS,
  OPERATIONAL_STATUSES,
  OPERATIONAL_STATUS_LABELS,
  REPORT_TYPES,
  ROLES,
  TRANSACTION_TYPES,
  VERIFICATION_STATUSES,
  WARRANTY_STATUSES,
  WARRANTY_STATUS_LABELS,
} from '../../constants/enums'
import { PERMISSIONS } from '../../constants/permissions'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../i18n'
import {
  downloadBlob,
  formatCurrency,
  formatDateTime,
  formatNumber,
  titleCase,
} from '../../utils/formatters'

const REPORT_META = {
  [REPORT_TYPES.STOCK_REGISTER]: {
    title: 'Stock Register',
    filters: ['search', 'office', 'category', 'location', 'status'],
    statusOptions: OPERATIONAL_STATUS_LABELS,
  },
  [REPORT_TYPES.ASSET_REGISTER]: {
    title: 'Asset Register',
    filters: ['search', 'office', 'dateRange', 'category', 'location', 'supplier', 'status'],
    statusOptions: OPERATIONAL_STATUS_LABELS,
  },
  [REPORT_TYPES.STOCK_QUANTITY]: {
    title: 'Stock Quantity Summary',
    filters: ['search', 'office', 'category', 'location'],
  },
  [REPORT_TYPES.ASSET_VALUATION]: {
    title: 'Asset Valuation & Depreciation',
    filters: ['search', 'office', 'category', 'location'],
  },
  [REPORT_TYPES.MOVEMENTS]: {
    title: 'Stock Movements Ledger',
    filters: ['search', 'office', 'dateRange', 'category', 'transactionType'],
  },
  [REPORT_TYPES.DEAD_STOCK]: {
    title: 'Dead Stock Register',
    filters: ['search', 'office', 'category', 'location', 'classification'],
  },
  [REPORT_TYPES.CONDEMNATIONS]: {
    title: 'Condemnation Requests',
    filters: ['search', 'office', 'dateRange', 'status'],
    statusOptions: CONDEMNATION_STATUS_LABELS,
  },
  [REPORT_TYPES.DISPOSALS]: {
    title: 'Disposal Register',
    filters: ['search', 'office', 'dateRange', 'disposalMethod'],
  },
  [REPORT_TYPES.SUPPLIERS_PROCUREMENT]: {
    title: 'Suppliers & Procurement',
    filters: ['search', 'office', 'dateRange', 'supplier'],
  },
  [REPORT_TYPES.WARRANTIES]: {
    title: 'Warranty & AMC Register',
    filters: ['search', 'office', 'dateRange', 'supplier', 'status'],
    statusOptions: WARRANTY_STATUS_LABELS,
  },
  [REPORT_TYPES.MAINTENANCE]: {
    title: 'Maintenance & Repair Register',
    filters: ['search', 'office', 'dateRange', 'category', 'status'],
    statusOptions: MAINTENANCE_STATUS_LABELS,
  },
  [REPORT_TYPES.PHYSICAL_VERIFICATION]: {
    title: 'Physical Verification & Audit',
    filters: ['search', 'office', 'dateRange', 'status'],
    statusOptions: {
      [VERIFICATION_STATUSES.ACTIVE]: 'Active',
      [VERIFICATION_STATUSES.COMPLETED]: 'Completed',
      [VERIFICATION_STATUSES.CANCELLED]: 'Cancelled',
    },
  },
}

const BADGE_STATUS_SET = new Set([
  ...Object.values(CLASSIFICATIONS),
  ...Object.values(OPERATIONAL_STATUSES),
  ...Object.values(CONDEMNATION_STATUSES),
  ...Object.values(MAINTENANCE_STATUSES),
  ...Object.values(WARRANTY_STATUSES),
  ...Object.values(VERIFICATION_STATUSES),
  'GOOD',
  'FAIR',
  'DAMAGED',
  'SCRAP',
  'DRAFT',
  'POSTED',
])

const INITIAL_FILTERS = {
  search: '',
  date_from: '',
  date_to: '',
  office_id: '',
  category_id: '',
  location_id: '',
  supplier_id: '',
  classification: '',
  status: '',
  transaction_type: '',
  disposal_method: '',
}

const CURRENCY_KEY_RE = /(value|cost|proceeds|valuation|expenditure|amount|revenue|price)/i

function extractFilename(contentDisposition, fallback) {
  if (!contentDisposition) return fallback
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^["']|["']$/g, ''))
    } catch {
      return utf8Match[1].trim()
    }
  }
  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  return plainMatch?.[1]?.trim() || fallback
}

function cleanParams(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  )
}

export default function ReportViewerPage() {
  const { reportType } = useParams()
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const { t } = useLanguage()

  const isValidReport = Object.values(REPORT_TYPES).includes(reportType)
  const meta = REPORT_META[reportType] || {
    title: titleCase(reportType || 'Report'),
    filters: ['search', 'dateRange', 'office'],
  }

  const userRole = user?.role?.name || user?.role_name || user?.role
  const isSystemAdmin = userRole === ROLES.SYSTEM_ADMIN
  const canExport = hasPermission(PERMISSIONS.REPORTS_EXPORT)

  const [draftFilters, setDraftFilters] = useState(INITIAL_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sortBy, setSortBy] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const [exportingFormat, setExportingFormat] = useState(null)

  const enabledFilters = useMemo(() => new Set(meta.filters || []), [meta.filters])

  // Master data dropdowns (only fetch what this report uses)
  const { data: officesRes } = useQuery({
    queryKey: ['report-offices'],
    queryFn: () => getOffices({ limit: 100 }),
    enabled: isSystemAdmin && enabledFilters.has('office'),
  })
  const { data: categoriesRes } = useQuery({
    queryKey: ['report-categories'],
    queryFn: () => getCategories({ limit: 100 }),
    enabled: enabledFilters.has('category'),
  })
  const { data: locationsRes } = useQuery({
    queryKey: ['report-locations'],
    queryFn: () => getLocations({ limit: 100 }),
    enabled: enabledFilters.has('location'),
  })
  const { data: suppliersRes } = useQuery({
    queryKey: ['report-suppliers'],
    queryFn: () => getSuppliers({ limit: 100 }),
    enabled: enabledFilters.has('supplier'),
  })

  const offices = officesRes?.data || []
  const categories = categoriesRes?.data || []
  const locations = locationsRes?.data || []
  const suppliers = suppliersRes?.data || []

  // Fetch report data
  const queryParams = useMemo(
    () =>
      cleanParams({
        ...appliedFilters,
        page,
        limit,
        sort_by: sortBy || undefined,
        sort_dir: sortBy ? sortDir : undefined,
      }),
    [appliedFilters, page, limit, sortBy, sortDir]
  )

  const {
    data: reportRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['report-data', reportType, queryParams],
    queryFn: () => getReport(reportType, queryParams),
    enabled: isValidReport,
  })

  const reportData = reportRes?.data || reportRes || {}
  const responseMeta = reportRes?.meta || {}

  const rawColumns = reportData.columns || reportData.headers || []
  const rawRows = reportData.rows || []
  const rowLinks = reportData.row_links || []
  const summary = reportData.summary || {}

  const totalRecords =
    responseMeta.total ?? reportData.total ?? rawRows.length
  const totalPages =
    responseMeta.total_pages ?? Math.max(1, Math.ceil(totalRecords / limit))

  // Normalize columns and rows for DataTable (supports both array-of-arrays and array-of-objects)
  const tableColumns = useMemo(() => {
    return rawColumns.map((col, idx) => {
      const isObj = typeof col === 'object' && col !== null
      const header = isObj ? col.header || col.label || col.name || `Column ${idx + 1}` : String(col)
      const key = isObj ? col.key || header : header
      const isCurrencyCol = header.includes('₹') || CURRENCY_KEY_RE.test(header)

      return {
        key,
        header,
        sortable: isObj ? col.sortable !== false : true,
        align: isCurrencyCol ? 'right' : 'left',
        render: (val, row, rowIdx) => {
          const displayVal = val ?? (Array.isArray(row.__raw) ? row.__raw[idx] : undefined)
          if (displayVal === null || displayVal === undefined || displayVal === '') {
            return <span className="text-slate-400">—</span>
          }

          if (typeof displayVal === 'string' && BADGE_STATUS_SET.has(displayVal)) {
            return <StatusBadge status={displayVal} size="xs" />
          }

          if (isCurrencyCol && !isNaN(Number(displayVal))) {
            return <span className="font-medium tabular-nums">{formatCurrency(Number(displayVal))}</span>
          }

          if (typeof displayVal === 'number') {
            return <span className="tabular-nums">{formatNumber(displayVal)}</span>
          }

          if (idx === 0 && row.__rowLink) {
            return (
              <span className="inline-flex items-center gap-1.5 font-medium text-forest-700 dark:text-forest-300">
                <span>{String(displayVal)}</span>
                <ExternalLink size={12} className="opacity-60 shrink-0" />
              </span>
            )
          }

          return String(displayVal)
        },
      }
    })
  }, [rawColumns])

  const tableRows = useMemo(() => {
    return rawRows.map((row, rowIdx) => {
      const link = rowLinks[rowIdx] || (typeof row === 'object' && !Array.isArray(row) ? row.link : null) || null
      if (Array.isArray(row)) {
        const obj = { id: `row-${rowIdx}`, __raw: row, __rowLink: link }
        tableColumns.forEach((col, colIdx) => {
          obj[col.key] = row[colIdx]
        })
        return obj
      }
      return {
        id: row.id || `row-${rowIdx}`,
        ...row,
        __rowLink: link,
      }
    })
  }, [rawRows, rowLinks, tableColumns])

  const handleFilterChange = (field, value) => {
    setDraftFilters((prev) => ({ ...prev, [field]: value }))
  }

  const handleApplyFilters = (e) => {
    e?.preventDefault()
    setAppliedFilters(draftFilters)
    setPage(1)
  }

  const handleResetFilters = () => {
    setDraftFilters(INITIAL_FILTERS)
    setAppliedFilters(INITIAL_FILTERS)
    setSortBy('')
    setSortDir('asc')
    setPage(1)
  }

  const handleSort = (key, dir) => {
    setSortBy(key)
    setSortDir(dir)
    setPage(1)
  }

  const handleExport = async (format) => {
    if (!canExport) return
    setExportingFormat(format)
    try {
      const clean = cleanParams(appliedFilters)
      const res = await generateExport({
        reportType,
        format,
        filters: clean,
        office_id: clean.office_id || undefined,
      })
      const fallback = `dsims_${reportType}.${format}`
      const filename = extractFilename(res?.headers?.['content-disposition'], fallback)
      downloadBlob(res, filename)
      toast.success(`Exported ${filename}`)
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.detail ||
        `Failed to export ${format.toUpperCase()} report.`
      toast.error(msg)
    } finally {
      setExportingFormat(null)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (!isValidReport) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Report Not Found"
          actions={
            <Link to={ROUTES.REPORTS}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                Back to Reports Center
              </Button>
            </Link>
          }
        />
        <GlassCard className="p-6">
          <ErrorState message={`Unknown report type: "${reportType}".`} />
        </GlassCard>
      </div>
    )
  }

  const officeScopeLabel =
    reportData.office_scope ||
    (appliedFilters.office_id
      ? offices.find((o) => o.id === appliedFilters.office_id)?.name || 'Selected Office'
      : isSystemAdmin
      ? 'All Offices (District Consolidated)'
      : user?.office?.name || 'Current Office')

  const inputClass =
    'w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-white dark:bg-[#0E1D19] border border-slate-200 dark:border-emerald-500/20 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-forest-500/40'

  return (
    <div className="space-y-5">
      <PageHeader
        title={reportData.title || meta.title}
        subtitle={t('reports.viewer.subtitle', 'Official register view, filtering, and export')}
        className="print:hidden"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to={ROUTES.REPORTS}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                Back
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Printer size={14} />}
              onClick={handlePrint}
            >
              Print
            </Button>
            {canExport && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Download size={14} />}
                  isLoading={exportingFormat === EXPORT_FORMATS.CSV}
                  disabled={Boolean(exportingFormat)}
                  onClick={() => handleExport(EXPORT_FORMATS.CSV)}
                >
                  CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Download size={14} />}
                  isLoading={exportingFormat === EXPORT_FORMATS.XLSX}
                  disabled={Boolean(exportingFormat)}
                  onClick={() => handleExport(EXPORT_FORMATS.XLSX)}
                >
                  XLSX
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Download size={14} />}
                  isLoading={exportingFormat === EXPORT_FORMATS.PDF}
                  disabled={Boolean(exportingFormat)}
                  onClick={() => handleExport(EXPORT_FORMATS.PDF)}
                >
                  PDF
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Official Report Header Card */}
      <GlassCard className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-forest-600 dark:text-forest-400">
              District Panchayat, Gir Somnath, Veraval
            </p>
            <h2 className="text-lg sm:text-xl font-bold text-forest-950 dark:text-forest-50 mt-0.5">
              {reportData.title || meta.title}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
            <div className="inline-flex items-center gap-1.5">
              <Building2 size={14} className="text-forest-600 dark:text-forest-400" />
              <span>
                Scope: <strong className="font-semibold">{officeScopeLabel}</strong>
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <Calendar size={14} className="text-forest-600 dark:text-forest-400" />
              <span>
                Generated:{' '}
                <strong className="font-semibold">
                  {reportData.generated_at ? formatDateTime(reportData.generated_at) : '—'}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Dynamic Filter Bar */}
      <GlassCard className="p-4 print:hidden">
        <form onSubmit={handleApplyFilters} className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-forest-800 dark:text-forest-200">
            <Filter size={14} />
            <span>Report Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {enabledFilters.has('search') && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={draftFilters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Search code, name, reference..."
                    className={`${inputClass} pl-8`}
                  />
                </div>
              </div>
            )}

            {enabledFilters.has('dateRange') && (
              <>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Date From
                  </label>
                  <input
                    type="date"
                    value={draftFilters.date_from}
                    onChange={(e) => handleFilterChange('date_from', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Date To
                  </label>
                  <input
                    type="date"
                    value={draftFilters.date_to}
                    onChange={(e) => handleFilterChange('date_to', e.target.value)}
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {isSystemAdmin && enabledFilters.has('office') && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Office
                </label>
                <select
                  value={draftFilters.office_id}
                  onChange={(e) => handleFilterChange('office_id', e.target.value)}
                  className={inputClass}
                >
                  <option value="">All Offices</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {enabledFilters.has('category') && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Category
                </label>
                <select
                  value={draftFilters.category_id}
                  onChange={(e) => handleFilterChange('category_id', e.target.value)}
                  className={inputClass}
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {enabledFilters.has('location') && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Location
                </label>
                <select
                  value={draftFilters.location_id}
                  onChange={(e) => handleFilterChange('location_id', e.target.value)}
                  className={inputClass}
                >
                  <option value="">All Locations</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.room_number || loc.name || loc.code}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {enabledFilters.has('supplier') && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Supplier
                </label>
                <select
                  value={draftFilters.supplier_id}
                  onChange={(e) => handleFilterChange('supplier_id', e.target.value)}
                  className={inputClass}
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {enabledFilters.has('classification') && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Classification
                </label>
                <select
                  value={draftFilters.classification}
                  onChange={(e) => handleFilterChange('classification', e.target.value)}
                  className={inputClass}
                >
                  <option value="">All Classifications</option>
                  {Object.entries(CLASSIFICATION_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {enabledFilters.has('status') && meta.statusOptions && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Status
                </label>
                <select
                  value={draftFilters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className={inputClass}
                >
                  <option value="">All Statuses</option>
                  {Object.entries(meta.statusOptions).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {enabledFilters.has('transactionType') && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Transaction Type
                </label>
                <select
                  value={draftFilters.transaction_type}
                  onChange={(e) => handleFilterChange('transaction_type', e.target.value)}
                  className={inputClass}
                >
                  <option value="">All Types</option>
                  {Object.values(TRANSACTION_TYPES).map((val) => (
                    <option key={val} value={val}>
                      {titleCase(val)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {enabledFilters.has('disposalMethod') && (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Disposal Method
                </label>
                <select
                  value={draftFilters.disposal_method}
                  onChange={(e) => handleFilterChange('disposal_method', e.target.value)}
                  className={inputClass}
                >
                  <option value="">All Methods</option>
                  {Object.entries(DISPOSAL_METHOD_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw size={13} />}
              onClick={handleResetFilters}
            >
              Reset
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Apply Filters
            </Button>
          </div>
        </form>
      </GlassCard>

      {/* Summary KPI Strip */}
      {Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(summary).map(([key, val]) => {
            const isCurrency = CURRENCY_KEY_RE.test(key) && !isNaN(Number(val))
            const isNum = typeof val === 'number' || (!isNaN(Number(val)) && val !== '' && typeof val !== 'boolean')
            return (
              <GlassCard key={key} className="p-3.5">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {titleCase(key)}
                </p>
                <p className="text-base sm:text-lg font-bold text-forest-950 dark:text-forest-50 mt-0.5 tabular-nums">
                  {isCurrency
                    ? formatCurrency(Number(val))
                    : isNum
                    ? formatNumber(Number(val))
                    : String(val ?? '—')}
                </p>
              </GlassCard>
            )
          })}
        </div>
      )}

      {/* Report Data Table */}
      {isError ? (
        <GlassCard className="p-4">
          <ErrorState
            message={
              error?.response?.data?.error?.message ||
              error?.message ||
              'Failed to load report data.'
            }
            onRetry={refetch}
          />
        </GlassCard>
      ) : (
        <DataTable
          columns={tableColumns}
          data={tableRows}
          isLoading={isLoading}
          page={page}
          limit={limit}
          total={totalRecords}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={(newLimit) => {
            setLimit(newLimit)
            setPage(1)
          }}
          sortBy={sortBy}
          sortOrder={sortDir}
          onSort={handleSort}
          onRowClick={(row) => {
            if (row.__rowLink) {
              navigate(row.__rowLink)
            }
          }}
          emptyTitle="No report records found"
          emptyDescription="Try adjusting your date range or filter criteria."
        />
      )}
    </div>
  )
}
