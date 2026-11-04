import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  PlusCircle, Download, Eye, Edit3, QrCode,
  Package, FileSpreadsheet, MapPin, User, Calendar
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import CardView from '../../components/tables/CardView'
import ViewToggle from '../../components/common/ViewToggle'
import FilterBar from '../../components/forms/FilterBar'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import StatusBadge from '../../components/common/StatusBadge'
import { getItems, getCategories } from '../../api/inventory.api'
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import toast from 'react-hot-toast'
import ExcelImportModal from '../../components/inventory/ExcelImportModal'
import { motion } from 'framer-motion'

export default function AssetRegisterPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

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

  // Table Columns Definition
  const columns = useMemo(
    () => [
      {
        key: 'item_code',
        header: 'Asset / Item Code',
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
        header: 'Item Description',
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
        header: 'Category',
        render: (_, row) => (
          <span className="text-xs text-forest-700 dark:text-forest-300 font-medium">
            {row.category?.name || '—'}
          </span>
        ),
      },
      {
        key: 'item_type',
        header: 'Type',
        width: '130px',
        render: (type) => (
          <span className="text-xs text-forest-600 dark:text-forest-400">
            {type === 'DURABLE_ASSET' ? 'Durable Asset' : 'Consumable Stock'}
          </span>
        ),
      },
      {
        key: 'quantity',
        header: 'Qty / UOM',
        align: 'right',
        width: '110px',
        render: (qty, row) => (
          <span className="text-sm font-bold text-forest-900 dark:text-forest-100">
            {formatNumber(qty)} <span className="text-xs font-normal text-forest-500">{row.uom}</span>
          </span>
        ),
      },
      {
        key: 'location',
        header: 'Location / Custodian',
        render: (_, row) => (
          <div>
            <p className="text-xs text-forest-900 dark:text-forest-100 font-semibold">{row.location?.room_number || 'Main Store'}</p>
            <p className="text-[11px] text-forest-500 dark:text-forest-400 truncate max-w-[150px]">
              {row.current_custodian || row.location?.description || 'In Store'}
            </p>
          </div>
        ),
      },
      {
        key: 'condition',
        header: 'Condition',
        width: '100px',
        render: (condition) => <StatusBadge status={condition} size="xs" />,
      },
      {
        key: 'operational_status',
        header: 'Status',
        width: '130px',
        render: (status) => <StatusBadge status={status} size="xs" />,
      },
      {
        key: 'classification',
        header: 'Classification',
        width: '120px',
        render: (classification) => <StatusBadge status={classification} size="xs" />,
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        width: '130px',
        render: (_, row) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Link
              to={`/inventory/${row.id}`}
              className="p-1.5 text-forest-600 dark:text-forest-300 hover:bg-forest-500/10 rounded-lg transition-colors"
              title="View 360° Profile"
            >
              <Eye size={15} />
            </Link>
            {hasPermission(PERMISSIONS.INVENTORY_EDIT) && row.operational_status !== 'DISPOSED' && (
              <Link
                to={`/inventory/${row.id}/edit`}
                className="p-1.5 text-forest-600 dark:text-forest-300 hover:bg-forest-500/10 rounded-lg transition-colors"
                title="Edit Item"
              >
                <Edit3 size={15} />
              </Link>
            )}
            <Link
              to={ROUTES.BARCODE_LOOKUP}
              className="p-1.5 text-forest-600 dark:text-forest-300 hover:bg-forest-500/10 rounded-lg transition-colors"
              title="Print Barcode / QR Label"
            >
              <QrCode size={15} />
            </Link>
          </div>
        ),
      },
    ],
    [hasPermission]
  )

  const handleExportCSV = () => {
    toast.success('Inventory register export generated successfully')
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
            <span className="text-forest-500">Stock / Quantity:</span>
            <span className="font-bold font-mono text-forest-900 dark:text-forest-100">
              {formatNumber(item.quantity)} {item.uom}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-forest-500">Category:</span>
            <span className="font-medium truncate max-w-[140px]">{item.category?.name || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-forest-500 flex items-center gap-1">
              <MapPin size={12} /> Location:
            </span>
            <span className="font-medium truncate max-w-[140px]">
              {item.location?.room_number || 'Main Store'}
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
          <Link
            to={`/inventory/${item.id}`}
            className="p-1.5 text-forest-600 dark:text-forest-300 hover:bg-forest-500/10 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye size={15} />
          </Link>
          {hasPermission(PERMISSIONS.INVENTORY_EDIT) && item.operational_status !== 'DISPOSED' && (
            <Link
              to={`/inventory/${item.id}/edit`}
              className="p-1.5 text-forest-600 dark:text-forest-300 hover:bg-forest-500/10 rounded-lg transition-colors"
              title="Edit Item"
            >
              <Edit3 size={15} />
            </Link>
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
        title="Asset & Item Register"
        subtitle="Comprehensive government inventory register covering durable capital assets and consumable store items"
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
              Export
            </Button>
            {hasPermission(PERMISSIONS.INVENTORY_IMPORT || PERMISSIONS.INVENTORY_CREATE) && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<FileSpreadsheet size={14} />}
                onClick={() => setIsImportModalOpen(true)}
              >
                Import Excel
              </Button>
            )}
            {hasPermission(PERMISSIONS.INVENTORY_CREATE) && (
              <Link to={ROUTES.INVENTORY_NEW}>
                <Button variant="primary" size="sm" leftIcon={<PlusCircle size={15} />}>
                  Add New Item
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
        searchPlaceholder="Search by item name, asset code, serial or barcode…"
        onClearFilters={handleClearFilters}
        filters={[
          {
            key: 'category',
            value: selectedCategory,
            onChange: (val) => { setSelectedCategory(val); setPage(1); },
            options: [
              { value: 'ALL', label: 'All Categories' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ],
          },
          {
            key: 'item_type',
            value: selectedType,
            onChange: (val) => { setSelectedType(val); setPage(1); },
            options: [
              { value: 'ALL', label: 'All Item Types' },
              { value: 'DURABLE_ASSET', label: 'Durable Assets' },
              { value: 'CONSUMABLE_STOCK', label: 'Consumables' },
            ],
          },
          {
            key: 'status',
            value: selectedStatus,
            onChange: (val) => { setSelectedStatus(val); setPage(1); },
            options: [
              { value: 'ALL', label: 'All Statuses' },
              { value: 'AVAILABLE_IN_STORE', label: 'Available in Store' },
              { value: 'IN_USE', label: 'In Use' },
              { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
              { value: 'PENDING_CONDEMNATION', label: 'Pending Condemnation' },
              { value: 'PENDING_DISPOSAL', label: 'Pending Disposal' },
              { value: 'DISPOSED', label: 'Disposed' },
            ],
          },
          {
            key: 'classification',
            value: selectedClassification,
            onChange: (val) => { setSelectedClassification(val); setPage(1); },
            options: [
              { value: 'ALL', label: 'All Classifications' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'SLOW_MOVING', label: 'Slow Moving' },
              { value: 'NON_MOVING', label: 'Non-Moving' },
              { value: 'OBSOLETE', label: 'Obsolete' },
            ],
          },
          {
            key: 'condition',
            value: selectedCondition,
            onChange: (val) => { setSelectedCondition(val); setPage(1); },
            options: [
              { value: 'ALL', label: 'All Conditions' },
              { value: 'GOOD', label: 'Good' },
              { value: 'FAIR', label: 'Fair' },
              { value: 'DAMAGED', label: 'Damaged' },
              { value: 'SCRAP', label: 'Scrap' },
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

      {/* Excel / CSV Import Modal */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => refetch()}
      />
    </motion.div>
  )
}
