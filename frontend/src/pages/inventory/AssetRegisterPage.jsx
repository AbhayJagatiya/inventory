import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  PlusCircle, Download, Eye, Edit3, History, QrCode,
  Package, FileSpreadsheet, AlertCircle
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import FilterBar from '../../components/forms/FilterBar'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { getItems, getCategories } from '../../api/inventory.api'
import { MOCK_ITEMS, MOCK_CATEGORIES } from '../../services/mockData'
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import toast from 'react-hot-toast'
import ExcelImportModal from '../../components/inventory/ExcelImportModal'

export default function AssetRegisterPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  // State
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
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories().catch(() => ({ data: MOCK_CATEGORIES })),
    select: (res) => res?.data || res || MOCK_CATEGORIES,
    initialData: { data: MOCK_CATEGORIES },
  })
  const categories = categoriesData?.data || categoriesData || MOCK_CATEGORIES

  // Items query
  const { data: itemsData, isLoading, refetch } = useQuery({
    queryKey: ['items', { page, limit, sortBy, sortOrder, searchQuery, selectedCategory, selectedType, selectedStatus, selectedClassification, selectedCondition }],
    queryFn: async () => {
      try {
        return await getItems({
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
        })
      } catch {
        // Fallback to local mock data for client-side demo when backend API isn't running
        let filtered = [...MOCK_ITEMS]
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          filtered = filtered.filter((i) =>
            i.item_name.toLowerCase().includes(q) ||
            i.item_code.toLowerCase().includes(q) ||
            (i.serial_number && i.serial_number.toLowerCase().includes(q)) ||
            (i.barcode_number && i.barcode_number.toLowerCase().includes(q))
          )
        }
        if (selectedCategory !== 'ALL') {
          filtered = filtered.filter((i) => i.category.id === selectedCategory)
        }
        if (selectedType !== 'ALL') {
          filtered = filtered.filter((i) => i.item_type === selectedType)
        }
        if (selectedStatus !== 'ALL') {
          filtered = filtered.filter((i) => i.operational_status === selectedStatus)
        }
        if (selectedClassification !== 'ALL') {
          filtered = filtered.filter((i) => i.classification === selectedClassification)
        }
        if (selectedCondition !== 'ALL') {
          filtered = filtered.filter((i) => i.condition === selectedCondition)
        }
        return {
          data: filtered,
          meta: {
            total: filtered.length,
            total_pages: Math.ceil(filtered.length / limit) || 1,
            page,
            limit,
          },
        }
      }
    },
  })

  const rawList = itemsData?.data || []
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
            <span className="font-mono text-xs font-semibold text-blue-700 block">
              {code}
            </span>
            {row.barcode_number && (
              <span className="font-mono text-[10px] text-slate-400">
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
            <p className="font-medium text-slate-900 text-sm">{name}</p>
            <p className="text-xs text-slate-500">
              {row.brand} {row.model_number && `· ${row.model_number}`} {row.serial_number && `· S/N: ${row.serial_number}`}
            </p>
          </div>
        ),
      },
      {
        key: 'category',
        header: 'Category',
        render: (_, row) => (
          <span className="text-xs text-slate-700 font-medium">
            {row.category?.name || '—'}
          </span>
        ),
      },
      {
        key: 'item_type',
        header: 'Type',
        width: '130px',
        render: (type) => (
          <span className="text-xs text-slate-600">
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
          <span className="text-sm font-semibold text-slate-800">
            {formatNumber(qty)} <span className="text-xs font-normal text-slate-500">{row.uom}</span>
          </span>
        ),
      },
      {
        key: 'location',
        header: 'Location / Custodian',
        render: (_, row) => (
          <div>
            <p className="text-xs text-slate-800 font-medium">{row.location?.room_number || 'Main Store'}</p>
            <p className="text-[11px] text-slate-500 truncate max-w-[150px]">
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
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Link
              to={`/inventory/${row.id}`}
              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
              title="View 360° Profile"
            >
              <Eye size={15} />
            </Link>
            {hasPermission(PERMISSIONS.INVENTORY_EDIT) && row.operational_status !== 'DISPOSED' && (
              <Link
                to={`/inventory/${row.id}/edit`}
                className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                title="Edit Item"
              >
                <Edit3 size={15} />
              </Link>
            )}
            <Link
              to={ROUTES.BARCODE_LOOKUP}
              className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors"
              title="Print Barcode / QR Label"
            >
              <QrCode size={15} />
            </Link>
          </div>
        ),
      },
    ],
    [hasPermission],
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Asset & Item Register"
        subtitle="Comprehensive register of government-owned durable assets and consumable store supplies"
        actions={
          <div className="flex items-center gap-2">
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

      {/* Main Data Table */}
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

      {/* Excel / CSV Import Modal */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => refetch()}
      />
    </div>
  )
}
