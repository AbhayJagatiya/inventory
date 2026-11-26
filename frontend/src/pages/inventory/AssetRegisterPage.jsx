import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  PlusCircle, Download, Trash2, Edit3, QrCode,
  FileSpreadsheet, MapPin, AlertTriangle
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import CardView from '../../components/tables/CardView'
import ViewToggle from '../../components/common/ViewToggle'
import FilterBar from '../../components/forms/FilterBar'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import StatusBadge from '../../components/common/StatusBadge'
import { getItems, getCategories, deleteItem, exportItems } from '../../api/inventory.api'
import { formatNumber } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import toast from 'react-hot-toast'
import ExcelImportModal from '../../components/inventory/ExcelImportModal'
import { motion } from 'framer-motion'
import { useLanguage } from '../../i18n'
import { translateEnum, translateMasterName } from '../../i18n/enumLabels'

export default function AssetRegisterPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const { t } = useLanguage()

  // View state: 'table' or 'card'
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('dsims_inventory_view') || 'table'
    } catch {
      return 'table'
    }
  })

  const handleViewChange = (mode) => {
    setViewMode(mode)
    try {
      localStorage.setItem('dsims_inventory_view', mode)
    } catch {
      // Ignore
    }
  }

  // Filter & Search State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [selectedType, setSelectedType] = useState('ALL')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [selectedClassification, setSelectedClassification] = useState('ALL')
  const [selectedCondition, setSelectedCondition] = useState('ALL')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sortBy, setSortBy] = useState('item_code')
  const [sortOrder, setSortOrder] = useState('asc')
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, name }
  const [isDeleting, setIsDeleting] = useState(false)

  // Categories query
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await getCategories()
      return res?.data || res || []
    },
  })

  // Items query
  const { data: itemsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['items', { page, limit, sortBy, sortOrder, searchQuery, selectedCategory, selectedType, selectedStatus, selectedClassification, selectedCondition }],
    queryFn: () => getItems({
      page,
      limit,
      sort_by: sortBy,
      sort_order: sortOrder,
      search: searchQuery || undefined,
      category_id: selectedCategory !== 'ALL' ? selectedCategory : undefined,
      item_type: selectedType !== 'ALL' ? selectedType : undefined,
      operational_status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
      classification: selectedClassification !== 'ALL' ? selectedClassification : undefined,
      condition: selectedCondition !== 'ALL' ? selectedCondition : undefined,
    }),
  })

  const rawList = itemsData?.data || (Array.isArray(itemsData) ? itemsData : [])
  const total = itemsData?.meta?.total ?? rawList.length
  const totalPages = itemsData?.meta?.total_pages ?? Math.ceil(total / limit) ?? 1

  // Delete handler
  const handleDeleteClick = (e, row) => {
    e.stopPropagation()
    setConfirmDelete({ id: row.id, name: row.item_name, code: row.item_code })
  }

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return
    setIsDeleting(true)
    try {
      await deleteItem(confirmDelete.id)
      toast.success(t('inventory.messages.assetDeleted'))
      setConfirmDelete(null)
      refetch()
    } catch (err) {
      const msg = err?.response?.data?.error?.message || t('toast.error')
      toast.error(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  // Table Columns Definition
  const columns = useMemo(
    () => [
      {
        key: 'item_code',
        header: t('inventory.table.assetCode'),
        sortable: true,
        width: '180px',
        render: (code, row) => (
          <div>
            <span className="font-mono text-xs font-bold text-forest-700 dark:text-forest-300 block">
              {code}
            </span>
            {row.barcode_number && (
              <span className="font-mono text-[10px] text-forest-500/80 dark:text-forest-400/80">
                {row.barcode_number}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'item_name',
        header: t('inventory.table.name'),
        sortable: true,
        render: (name, row) => (
          <div>
            <p className="font-semibold text-forest-950 dark:text-forest-50 text-sm">{name}</p>
            <p className="text-xs text-forest-600 dark:text-forest-400">
              {row.brand} {row.model_number && `· ${row.model_number}`} {row.serial_number && `· S/N: ${row.serial_number}`}
            </p>
          </div>
        ),
      },
      {
        key: 'category',
        header: t('inventory.table.category'),
        render: (_, row) => (
          <span className="text-xs text-forest-700 dark:text-forest-300 font-medium">
            {translateMasterName(t, 'category', row.category?.code, row.category?.name) || '—'}
          </span>
        ),
      },
      {
        key: 'item_type',
        header: t('labels.type'),
        width: '130px',
        render: (type) => (
          <span className="text-xs text-forest-600 dark:text-forest-400">
            {translateEnum(t, type)}
          </span>
        ),
      },
      {
        key: 'quantity',
        header: `${t('inventory.table.quantity')} / ${t('labels.unit')}`,
        align: 'right',
        width: '110px',
        render: (qty, row) => (
          <span className="text-sm font-bold text-forest-900 dark:text-forest-100">
            {formatNumber(qty)}{' '}
            <span className="text-xs font-normal text-forest-500">
              {translateMasterName(t, 'uom', row.uom, row.uom)}
            </span>
          </span>
        ),
      },
      {
        key: 'location',
        header: `${t('inventory.table.location')} / ${t('inventory.detail.currentCustodian')}`,
        render: (_, row) => (
          <div>
            <p className="text-xs text-forest-900 dark:text-forest-100 font-semibold">
              {row.location?.room_number || t('inventory.register.unassigned')}
            </p>
            <p className="text-[11px] text-forest-500 dark:text-forest-400 truncate max-w-[150px]">
              {row.current_custodian || row.location?.description || t('inventory.register.unassigned')}
            </p>
          </div>
        ),
      },
      {
        key: 'condition',
        header: t('inventory.table.condition'),
        width: '100px',
        render: (condition) => <StatusBadge status={condition} size="xs" />,
      },
      {
        key: 'operational_status',
        header: t('inventory.table.status'),
        width: '130px',
        render: (status) => <StatusBadge status={status} size="xs" />,
      },
      {
        key: 'classification',
        header: t('inventory.table.classification'),
        width: '120px',
        render: (classification) => <StatusBadge status={classification} size="xs" />,
      },
      {
        key: 'actions',
        header: t('inventory.table.actions'),
        align: 'right',
        width: '100px',
        render: (_, row) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {hasPermission(PERMISSIONS.INVENTORY_EDIT) && row.operational_status !== 'DISPOSED' && (
              <Link
                to={`/inventory/${row.id}/edit`}
                className="p-1.5 text-forest-600 dark:text-forest-300 hover:bg-forest-500/10 rounded-lg transition-colors"
                title={t('inventory.register.editAssetTitle')}
              >
                <Edit3 size={15} />
              </Link>
            )}
            <Link
              to={ROUTES.BARCODE_LOOKUP}
              className="p-1.5 text-forest-600 dark:text-forest-300 hover:bg-forest-500/10 rounded-lg transition-colors"
              title={t('inventory.detail.printLabel')}
            >
              <QrCode size={15} />
            </Link>
            {hasPermission(PERMISSIONS.INVENTORY_EDIT) && row.operational_status !== 'DISPOSED' && (
              <button
                onClick={(e) => handleDeleteClick(e, row)}
                className="p-1.5 text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                title={t('inventory.register.deleteAssetTitle')}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ),
      },
    ],
    [hasPermission, t]
  )

  const handleExportCSV = async () => {
    try {
      const res = await exportItems({
        search: searchQuery || undefined,
        category_id: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        item_type: selectedType !== 'ALL' ? selectedType : undefined,
        operational_status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        classification: selectedClassification !== 'ALL' ? selectedClassification : undefined,
        condition: selectedCondition !== 'ALL' ? selectedCondition : undefined,
      })
      const url = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `dsims_inventory_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success(t('inventory.register.exportSuccess'))
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('inventory.register.exportError'))
    }
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setSelectedCategory('ALL')
    setSelectedType('ALL')
    setSelectedStatus('ALL')
    setSelectedClassification('ALL')
    setSelectedCondition('ALL')
    setPage(1)
  }

  // Render individual card for Card View
  const renderItemCard = (item) => (
    <GlassCard
      key={item.id}
      level={1}
      interactive={true}
      cursorLight={true}
      onClick={() => navigate(`/inventory/${item.id}`)}
      className="p-5 flex flex-col justify-between"
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <span className="font-mono text-xs font-bold text-forest-700 dark:text-forest-300 bg-forest-500/10 px-2 py-0.5 rounded-lg border border-forest-500/20">
            {item.item_code}
          </span>
          <StatusBadge status={item.operational_status} size="xs" />
        </div>

        {/* Title & Brand */}
        <h3 className="font-bold text-forest-950 dark:text-forest-50 text-sm leading-snug line-clamp-2 mb-1">
          {item.item_name}
        </h3>
        <p className="text-xs text-forest-600 dark:text-forest-400 mb-3 line-clamp-1">
          {item.brand} {item.model_number && `· ${item.model_number}`}
        </p>

        {/* Key Attributes */}
        <div className="space-y-1.5 py-2.5 border-y border-forest-500/10 dark:border-forest-300/10 text-xs text-forest-700 dark:text-forest-300">
          <div className="flex items-center justify-between">
            <span className="text-forest-500">{t('labels.quantity')}:</span>
            <span className="font-bold font-mono text-forest-900 dark:text-forest-100">
              {formatNumber(item.quantity)} {translateMasterName(t, 'uom', item.uom, item.uom)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-forest-500">{t('labels.category')}:</span>
            <span className="font-medium truncate max-w-[140px]">
              {translateMasterName(t, 'category', item.category?.code, item.category?.name) || '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-forest-500 flex items-center gap-1">
              <MapPin size={12} /> {t('labels.location')}:
            </span>
            <span className="font-medium truncate max-w-[140px]">
              {item.location?.room_number || t('inventory.register.unassigned')}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Badges & Actions */}
      <div className="mt-4 pt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={item.condition} size="xs" />
          <StatusBadge status={item.classification} size="xs" />
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {hasPermission(PERMISSIONS.INVENTORY_EDIT) && item.operational_status !== 'DISPOSED' && (
            <Link
              to={`/inventory/${item.id}/edit`}
              className="p-1.5 text-forest-600 dark:text-forest-300 hover:bg-forest-500/10 rounded-lg transition-colors"
              title={t('inventory.register.editAssetTitle')}
            >
              <Edit3 size={15} />
            </Link>
          )}
          {hasPermission(PERMISSIONS.INVENTORY_EDIT) && item.operational_status !== 'DISPOSED' && (
            <button
              onClick={(e) => handleDeleteClick(e, item)}
              className="p-1.5 text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
              title={t('inventory.register.deleteAssetTitle')}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </GlassCard>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <PageHeader
        title={t('inventory.title')}
        subtitle={t('app.fullName')}
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View Mode Switcher */}
            <ViewToggle view={viewMode} onViewChange={handleViewChange} />

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download size={14} />}
              onClick={handleExportCSV}
            >
              {t('actions.export')}
            </Button>
            {hasPermission(PERMISSIONS.INVENTORY_IMPORT) && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<FileSpreadsheet size={14} />}
                onClick={() => setIsImportModalOpen(true)}
              >
                {t('inventory.register.importBulk')}
              </Button>
            )}
            {hasPermission(PERMISSIONS.INVENTORY_CREATE) && (
              <Link to={ROUTES.INVENTORY_NEW}>
                <Button variant="primary" size="sm" leftIcon={<PlusCircle size={15} />}>
                  {t('inventory.addAsset')}
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Filter Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q)
          setPage(1)
        }}
        searchPlaceholder={t('inventory.searchPlaceholder')}
        onClearFilters={handleClearFilters}
        filters={[
          {
            key: 'category',
            value: selectedCategory,
            onChange: (val) => { setSelectedCategory(val); setPage(1); },
            options: [
              { value: 'ALL', label: t('inventory.filters.allCategories') },
              ...categories.map((c) => ({
                value: c.id,
                label: translateMasterName(t, 'category', c.code, c.name),
              })),
            ],
          },
          {
            key: 'item_type',
            value: selectedType,
            onChange: (val) => { setSelectedType(val); setPage(1); },
            options: [
              { value: 'ALL', label: t('inventory.filters.allTypes') },
              { value: 'DURABLE_ASSET', label: t('itemType.durableAsset') },
              { value: 'CONSUMABLE_STOCK', label: t('itemType.consumableStock') },
            ],
          },
          {
            key: 'status',
            value: selectedStatus,
            onChange: (val) => { setSelectedStatus(val); setPage(1); },
            options: [
              { value: 'ALL', label: t('inventory.filters.allStatuses') },
              { value: 'AVAILABLE_IN_STORE', label: t('operationalStatus.availableInStore') },
              { value: 'IN_USE', label: t('operationalStatus.inUse') },
              { value: 'UNDER_MAINTENANCE', label: t('operationalStatus.underMaintenance') },
              { value: 'NON_FUNCTIONAL', label: t('operationalStatus.nonFunctional') },
              { value: 'PENDING_CONDEMNATION', label: t('operationalStatus.pendingCondemnation') },
              { value: 'PENDING_DISPOSAL', label: t('operationalStatus.pendingDisposal') },
              { value: 'DISPOSED', label: t('operationalStatus.disposed') },
            ],
          },
          {
            key: 'classification',
            value: selectedClassification,
            onChange: (val) => { setSelectedClassification(val); setPage(1); },
            options: [
              { value: 'ALL', label: t('inventory.filters.allClassifications') },
              { value: 'ACTIVE', label: t('classification.active') },
              { value: 'SLOW_MOVING', label: t('classification.slowMoving') },
              { value: 'NON_MOVING', label: t('classification.nonMoving') },
              { value: 'OBSOLETE', label: t('classification.obsolete') },
            ],
          },
          {
            key: 'condition',
            value: selectedCondition,
            onChange: (val) => { setSelectedCondition(val); setPage(1); },
            options: [
              { value: 'ALL', label: t('inventory.filters.allConditions') },
              { value: 'NEW', label: t('condition.new') },
              { value: 'GOOD', label: t('condition.good') },
              { value: 'FAIR', label: t('condition.fair') },
              { value: 'POOR', label: t('condition.poor') },
              { value: 'DAMAGED', label: t('condition.damaged') },
              { value: 'SCRAP', label: t('condition.scrap') },
            ],
          },
        ]}
      />

      {/* Main Content Presentation: Table or Card View */}
      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={rawList}
          isLoading={isLoading}
          page={page}
          limit={limit}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={(newLimit) => {
            setLimit(newLimit)
            setPage(1)
          }}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={(key, order) => {
            setSortBy(key)
            setSortOrder(order)
          }}
          onRowClick={(row) => navigate(`/inventory/${row.id}`)}
        />
      ) : (
        <CardView
          data={rawList}
          renderCard={renderItemCard}
          isLoading={isLoading}
          page={page}
          limit={limit}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={(newLimit) => {
            setLimit(newLimit)
            setPage(1)
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  {t('inventory.register.confirmDeleteTitle')}
                </h3>
                <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400">{confirmDelete.code}</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-5">
              {t('inventory.register.confirmDeleteMessage', { name: confirmDelete.name })}
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmDelete(null)}
                disabled={isDeleting}
              >
                {t('actions.cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
                isLoading={isDeleting}
                leftIcon={<Trash2 size={14} />}
              >
                {isDeleting ? t('inventory.register.deleting') : t('actions.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Excel / CSV Import Modal */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => refetch()}
      />
    </motion.div>
  )
}
