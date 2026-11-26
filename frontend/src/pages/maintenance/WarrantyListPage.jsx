import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck, Plus, Search, RotateCcw, Clock, AlertTriangle,
  XCircle, PackageX, Edit3, Upload, Wrench
} from 'lucide-react'
import {
  getWarrantySummary,
  getWarranties,
  getExpiringWarranties,
  createWarranty,
  updateWarranty,
} from '../../api/maintenance.api'
import { getItems } from '../../api/inventory.api'
import { getSuppliers } from '../../api/suppliers.api'
import { uploadDocument } from '../../api/administration.api'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import Modal from '../../components/common/Modal'
import StatusBadge from '../../components/common/StatusBadge'
import { DataTable } from '../../components/tables/DataTable'
import ErrorState from '../../components/feedback/ErrorState'
import { formatNumber, formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { PERMISSIONS } from '../../constants/permissions'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../i18n'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'ALL', label: 'All Warranties' },
  { key: 'EXPIRING_30', label: 'Expiring 30d', leadDays: 30 },
  { key: 'EXPIRING_60', label: 'Expiring 60d', leadDays: 60 },
  { key: 'EXPIRING_90', label: 'Expiring 90d', leadDays: 90 },
  { key: 'EXPIRED', label: 'Expired' },
]

export default function WarrantyListPage() {
  const { hasPermission } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const canManageWarranty =
    hasPermission(PERMISSIONS.WARRANTY_MANAGE) ||
    hasPermission(PERMISSIONS.MAINTENANCE_UPDATE)

  // Filters & Table State
  const [activeTab, setActiveTab] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('end_date')
  const [sortOrder, setSortOrder] = useState('asc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingWarranty, setEditingWarranty] = useState(null)
  const [itemId, setItemId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [providerName, setProviderName] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [coverageDetails, setCoverageDetails] = useState('')
  const [supportContact, setSupportContact] = useState('')
  const [warrantyFile, setWarrantyFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Summary KPIs
  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ['warranty-summary'],
    queryFn: getWarrantySummary,
  })
  const summary = summaryRes?.data || summaryRes || {}

  const activeTabObj = TABS.find((tb) => tb.key === activeTab)
  const isExpiringTab = Boolean(activeTabObj?.leadDays)

  // List Query
  const {
    data: listRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'warranties-list',
      activeTab,
      searchQuery,
      supplierFilter,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
      page,
      limit,
    ],
    queryFn: () => {
      if (isExpiringTab) {
        return getExpiringWarranties({ lead_days: activeTabObj.leadDays })
      }
      const params = {
        page,
        limit,
        sort_by: sortBy,
        sort_dir: sortOrder,
      }
      if (activeTab === 'EXPIRED') params.status = 'EXPIRED'
      if (supplierFilter) params.supplier_id = supplierFilter
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      return getWarranties(params)
    },
  })

  const rawWarranties = listRes?.data || []

  // For expiring tabs (which return a flat array from /warranties/expiring), apply client-side filters & pagination cleanly
  const displayedWarranties = useMemo(() => {
    if (!isExpiringTab) return rawWarranties

    let filtered = rawWarranties
    if (supplierFilter) {
      filtered = filtered.filter((w) => w.supplier_id === supplierFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (w) =>
          w.item_code?.toLowerCase().includes(q) ||
          w.item_name?.toLowerCase().includes(q) ||
          w.provider_name?.toLowerCase().includes(q) ||
          w.supplier_name?.toLowerCase().includes(q)
      )
    }
    if (dateFrom) {
      filtered = filtered.filter((w) => w.end_date >= dateFrom)
    }
    if (dateTo) {
      filtered = filtered.filter((w) => w.end_date <= dateTo)
    }
    const startIdx = (page - 1) * limit
    return filtered.slice(startIdx, startIdx + limit)
  }, [isExpiringTab, rawWarranties, supplierFilter, searchQuery, dateFrom, dateTo, page, limit])

  const totalRecords = isExpiringTab
    ? rawWarranties.length
    : listRes?.meta?.total ?? rawWarranties.length
  const totalPages = isExpiringTab
    ? Math.max(1, Math.ceil(totalRecords / limit))
    : listRes?.meta?.total_pages ?? Math.max(1, Math.ceil(totalRecords / limit))

  // Dropdowns
  const { data: suppliersRes } = useQuery({
    queryKey: ['suppliers-dropdown'],
    queryFn: () => getSuppliers({ limit: 100 }),
  })
  const suppliers = suppliersRes?.data || []

  const { data: itemsRes } = useQuery({
    queryKey: ['items-for-warranty'],
    queryFn: () => getItems({ limit: 100 }),
    enabled: isModalOpen && !editingWarranty,
  })
  const items = itemsRes?.data || []

  const openCreateModal = () => {
    setEditingWarranty(null)
    setItemId('')
    setSupplierId('')
    setProviderName('')
    setStartDate(new Date().toISOString().split('T')[0])
    setEndDate('')
    setCoverageDetails('')
    setSupportContact('')
    setWarrantyFile(null)
    setIsModalOpen(true)
  }

  const openEditModal = (row) => {
    setEditingWarranty(row)
    setItemId(row.item_id || '')
    setSupplierId(row.supplier_id || '')
    setProviderName(row.provider_name || '')
    setStartDate(row.start_date ? String(row.start_date).split('T')[0] : '')
    setEndDate(row.end_date ? String(row.end_date).split('T')[0] : '')
    setCoverageDetails(row.coverage_details || '')
    setSupportContact(row.support_contact || '')
    setWarrantyFile(null)
    setIsModalOpen(true)
  }

  const handleSaveSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!editingWarranty && !itemId) {
      toast.error('Please select an asset')
      return
    }
    if (!providerName.trim() || providerName.trim().length < 2) {
      toast.error('Warranty provider name must be at least 2 characters')
      return
    }
    if (!startDate || !endDate) {
      toast.error('Start date and end date are required')
      return
    }
    if (endDate < startDate) {
      toast.error('End date must be on or after start date')
      return
    }

    setIsSubmitting(true)
    try {
      let uploadedDocId = editingWarranty?.document_id || undefined

      if (warrantyFile) {
        try {
          const fd = new FormData()
          fd.append('file', warrantyFile)
          fd.append('related_entity_type', 'WARRANTY')
          fd.append('document_category', 'WARRANTY_CARD')
          if (itemId) fd.append('item_id', itemId)
          if (editingWarranty?.id) fd.append('related_entity_id', editingWarranty.id)
          const docRes = await uploadDocument(fd)
          uploadedDocId = docRes?.data?.id || docRes?.id || uploadedDocId
        } catch {
          toast.error('Warranty card upload failed; please try again or save without file')
          setIsSubmitting(false)
          return
        }
      }

      const payload = {
        provider_name: providerName.trim(),
        start_date: startDate,
        end_date: endDate,
        supplier_id: supplierId || null,
        coverage_details: coverageDetails.trim() || null,
        support_contact: supportContact.trim() || null,
      }
      if (uploadedDocId) payload.document_id = uploadedDocId

      if (editingWarranty) {
        await updateWarranty(editingWarranty.id, payload)
        toast.success('Warranty updated successfully')
      } else {
        await createWarranty({ ...payload, item_id: itemId })
        toast.success('Warranty registered successfully')
      }

      queryClient.invalidateQueries({ queryKey: ['warranties-list'] })
      queryClient.invalidateQueries({ queryKey: ['warranty-summary'] })
      setIsModalOpen(false)
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        'Failed to save warranty record'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetFilters = () => {
    setActiveTab('ALL')
    setSearchQuery('')
    setSupplierFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const columns = [
    {
      key: 'item_name',
      header: 'Asset',
      render: (_, row) => (
        <div className="max-w-[200px]">
          <Link
            to={ROUTES.INVENTORY_DETAIL(row.item_id)}
            className="font-semibold text-forest-700 dark:text-emerald-400 hover:underline truncate block"
          >
            {row.item_name || '—'}
          </Link>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {row.item_code || ''}
          </span>
        </div>
      ),
    },
    {
      key: 'supplier_name',
      header: 'Supplier',
      render: (_, row) => (
        <span className="text-xs text-slate-700 dark:text-slate-300">
          {row.supplier_name || '—'}
        </span>
      ),
    },
    {
      key: 'provider_name',
      header: 'Warranty Provider',
      render: (_, row) => (
        <div>
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            {row.provider_name}
          </p>
          {row.support_contact && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              {row.support_contact}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'start_date',
      header: 'Start Date',
      sortable: !isExpiringTab,
      render: (_, row) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
          {formatDate(row.start_date)}
        </span>
      ),
    },
    {
      key: 'end_date',
      header: 'End Date',
      sortable: !isExpiringTab,
      render: (_, row) => (
        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
          {formatDate(row.end_date)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (_, row) => <StatusBadge status={row.status} size="xs" />,
    },
    {
      key: 'remaining_days',
      header: 'Remaining',
      align: 'right',
      render: (_, row) => {
        const days = Number(row.remaining_days ?? 0)
        return (
          <span
            className={`font-mono text-xs font-semibold ${
              days < 0
                ? 'text-rose-600 dark:text-rose-400'
                : days <= 30
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days} days`}
          </span>
        )
      },
    },
    {
      key: 'linked_counts',
      header: 'Maint. / RMA',
      align: 'center',
      render: (_, row) => (
        <div className="inline-flex items-center gap-2 text-xs font-mono">
          <span
            className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-forest-900 text-slate-700 dark:text-slate-300"
            title="Linked Maintenance Tickets"
          >
            M: {row.maintenance_count ?? 0}
          </span>
          <span
            className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-forest-900 text-slate-700 dark:text-slate-300"
            title="Linked Supplier RMAs"
          >
            RMA: {row.rma_count ?? 0}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) =>
        canManageWarranty ? (
          <Button
            variant="ghost"
            size="xs"
            leftIcon={<Edit3 size={13} />}
            onClick={() => openEditModal(row)}
          >
            Edit
          </Button>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Warranty Management & Expiry Watch"
        subtitle="Monitor OEM coverage, service level agreements, and upcoming expiration windows"
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.MAINTENANCE}>
              <Button variant="secondary" size="sm" leftIcon={<Wrench size={14} />}>
                Maintenance Log
              </Button>
            </Link>
            {canManageWarranty && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={openCreateModal}
              >
                Register Warranty
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <GlassCard level={1} className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total
            </p>
            <ShieldCheck size={16} className="text-forest-600 dark:text-forest-300" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            {summaryLoading ? '—' : formatNumber(summary.total_warranties ?? 0)}
          </p>
        </GlassCard>

        <GlassCard level={1} className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Active
            </p>
            <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
            {summaryLoading ? '—' : formatNumber(summary.active_count ?? 0)}
          </p>
        </GlassCard>

        <GlassCard level={1} className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Expiring 30d
            </p>
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">
            {summaryLoading ? '—' : formatNumber(summary.expiring_30_count ?? 0)}
          </p>
        </GlassCard>

        <GlassCard level={1} className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
              Expiring 60d
            </p>
            <Clock size={16} className="text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-2xl font-extrabold text-orange-700 dark:text-orange-300 mt-1">
            {summaryLoading ? '—' : formatNumber(summary.expiring_60_count ?? 0)}
          </p>
        </GlassCard>

        <GlassCard level={1} className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Expiring 90d
            </p>
            <Clock size={16} className="text-sky-600 dark:text-sky-400" />
          </div>
          <p className="text-2xl font-extrabold text-sky-700 dark:text-sky-300 mt-1">
            {summaryLoading ? '—' : formatNumber(summary.expiring_90_count ?? 0)}
          </p>
        </GlassCard>

        <GlassCard level={1} className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Expired
            </p>
            <XCircle size={16} className="text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-2xl font-extrabold text-rose-700 dark:text-rose-300 mt-1">
            {summaryLoading ? '—' : formatNumber(summary.expired_count ?? 0)}
          </p>
        </GlassCard>

        <GlassCard level={1} className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Uninsured
            </p>
            <PackageX size={16} className="text-slate-500 dark:text-slate-400" />
          </div>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-200 mt-1">
            {summaryLoading ? '—' : formatNumber(summary.items_without_warranty ?? 0)}
          </p>
        </GlassCard>
      </div>

      {/* Tabs + Filters */}
      <GlassCard level={1} className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-emerald-500/15 pb-3">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key)
                  setPage(1)
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-forest-500 text-white dark:bg-emerald-500 dark:text-forest-950 shadow-xs'
                    : 'bg-slate-100 dark:bg-[#0A1513] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-forest-800/60'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Search asset code, name, provider, supplier..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={supplierFilter}
            onChange={(e) => {
              setSupplierFilter(e.target.value)
              setPage(1)
            }}
            className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((sup) => (
              <option key={sup.id} value={sup.id}>
                {sup.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">End From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
              className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw size={13} />}
            onClick={handleResetFilters}
          >
            {t('actions.reset')}
          </Button>
        </div>
      </GlassCard>

      {/* Main Table */}
      {isError ? (
        <ErrorState
          title="Unable to load warranties"
          message={
            error?.response?.data?.error?.message ||
            error?.response?.data?.detail ||
            'An error occurred while fetching warranty records.'
          }
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={displayedWarranties}
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
          sortOrder={sortOrder}
          onSort={
            isExpiringTab
              ? undefined
              : (key, order) => {
                  setSortBy(key)
                  setSortOrder(order)
                  setPage(1)
                }
          }
          emptyTitle="No warranty records found"
          emptyDescription="Register a warranty or switch expiry tabs to view records."
        />
      )}

      {/* Create / Edit Warranty Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => !isSubmitting && setIsModalOpen(false)}
          title={editingWarranty ? 'Edit Warranty Record' : 'Register Asset Warranty'}
          size="lg"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={isSubmitting}
                onClick={() => setIsModalOpen(false)}
              >
                {t('actions.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                onClick={handleSaveSubmit}
              >
                {editingWarranty ? 'Save Changes' : 'Register Warranty'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Asset <span className="text-red-500">*</span>
                </label>
                {editingWarranty ? (
                  <div className="px-3 py-2 border border-slate-200 dark:border-emerald-500/20 rounded-xl bg-slate-50 dark:bg-[#0A1513] text-slate-700 dark:text-slate-300 font-medium">
                    {editingWarranty.item_code} — {editingWarranty.item_name}
                  </div>
                ) : (
                  <select
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  >
                    <option value="">Select an asset...</option>
                    {items.map((itm) => (
                      <option key={itm.id} value={itm.id}>
                        {itm.item_code} — {itm.item_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier (Optional)
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">None / Direct OEM</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Warranty Provider Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="e.g., Dell ProSupport / HP Care Pack"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Support Contact (Optional)
                </label>
                <input
                  type="text"
                  value={supportContact}
                  onChange={(e) => setSupportContact(e.target.value)}
                  placeholder="Toll-free number or email"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Coverage Details (Optional)
              </label>
              <textarea
                rows={3}
                value={coverageDetails}
                onChange={(e) => setCoverageDetails(e.target.value)}
                placeholder="On-site parts & labor, SLA response time, exclusions..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Warranty Card / AMC Document (Optional)
              </label>
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 dark:border-emerald-500/30 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-forest-900/40">
                <Upload size={15} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-slate-600 dark:text-slate-300">
                  {warrantyFile ? warrantyFile.name : 'Upload warranty card or AMC PDF...'}
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setWarrantyFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
