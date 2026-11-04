import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  PlusCircle, Search, Eye, Filter, CheckCircle2,
  FileText, Building2, Download
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import CardView from '../../components/tables/CardView'
import ViewToggle from '../../components/common/ViewToggle'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { getReceipts } from '../../api/transactions.api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import { motion } from 'framer-motion'

export default function ReceiptListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('dsims_receipts_view') || 'table'
    } catch {
      return 'table'
    }
  })

  const handleViewChange = (mode) => {
    setViewMode(mode)
    try {
      localStorage.setItem('dsims_receipts_view', mode)
    } catch {}
  }

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data: receiptsData, isLoading } = useQuery({
    queryKey: ['receipts', { search, statusFilter }],
    queryFn: () => getReceipts({ search, status: statusFilter }),
  })

  const receipts = receiptsData?.data || []
  const canCreate = hasPermission(PERMISSIONS.STOCK_RECEIPT_CREATE)

  const columns = [
    {
      key: 'voucher_number',
      header: 'Voucher Number',
      render: (val, row) => (
        <div>
          <span
            className="font-mono text-xs font-bold text-forest-700 dark:text-forest-300 hover:underline cursor-pointer"
            onClick={() => navigate(ROUTES.RECEIPT_DETAIL(row.id))}
          >
            {val}
          </span>
          <span className="block text-[11px] text-forest-500 mt-0.5">PO: {row.po_number || 'Direct Proc.'}</span>
        </div>
      ),
    },
    {
      key: 'receipt_date',
      header: 'Receipt Date',
      render: (val) => <span className="text-xs text-forest-800 dark:text-forest-200 font-semibold">{formatDate(val)}</span>,
    },
    {
      key: 'supplier_name',
      header: 'Supplier / Vendor',
      render: (val, row) => (
        <div>
          <span className="text-xs font-bold text-forest-950 dark:text-forest-50">{val}</span>
          {row.invoice_number && (
            <span className="block text-[11px] text-forest-500 font-mono">Inv: {row.invoice_number}</span>
          )}
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Received Items',
      render: (items) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-forest-500/10 text-forest-800 dark:text-forest-200 font-mono text-[11px] font-semibold">
          <FileText size={12} className="text-forest-500" />
          {items?.length || 0} line {items?.length === 1 ? 'item' : 'items'}
        </span>
      ),
    },
    {
      key: 'total_accepted_value',
      header: 'Accepted Value',
      render: (val) => (
        <span className="font-mono text-xs font-bold text-forest-900 dark:text-forest-100">
          {val ? formatCurrency(val) : '—'}
        </span>
      ),
    },
    {
      key: 'receiving_office',
      header: 'Receiving Office / Bay',
      render: (val, row) => (
        <div>
          <span className="text-xs text-forest-700 dark:text-forest-300 block max-w-xs truncate">{val}</span>
          <span className="text-[11px] text-forest-500 font-medium">{row.receiving_location || 'Store Room'}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (val) => <StatusBadge status={val} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <Link to={ROUTES.RECEIPT_DETAIL(row.id)}>
            <Button variant="ghost" size="xs" leftIcon={<Eye size={13} />}>
              View
            </Button>
          </Link>
        </div>
      ),
    },
  ]

  const paginatedData = receipts.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(receipts.length / pageSize) || 1

  const renderReceiptCard = (row) => (
    <GlassCard
      key={row.id}
      level={1}
      interactive={true}
      cursorLight={true}
      onClick={() => navigate(ROUTES.RECEIPT_DETAIL(row.id))}
      className="p-5 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="font-mono text-xs font-bold text-forest-700 dark:text-forest-300 bg-forest-500/10 px-2 py-0.5 rounded-lg border border-forest-500/20">
            {row.voucher_number}
          </span>
          <StatusBadge status={row.status} size="xs" />
        </div>

        <h3 className="text-xs font-bold text-forest-950 dark:text-forest-50 mb-1">
          {row.supplier_name}
        </h3>
        <p className="text-[11px] text-forest-500 font-mono mb-2">
          PO: {row.po_number || 'Direct'} {row.invoice_number && `· Inv: ${row.invoice_number}`}
        </p>

        <div className="py-2 border-y border-forest-500/10 dark:border-forest-300/10 space-y-1 text-xs text-forest-700 dark:text-forest-300">
          <div className="flex items-center justify-between">
            <span className="text-forest-500">Receipt Date:</span>
            <span>{formatDate(row.receipt_date)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-forest-500">Items Count:</span>
            <span className="font-bold font-mono">{row.items?.length || 0} line items</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-forest-500">Accepted Value:</span>
            <span className="font-bold font-mono text-forest-950 dark:text-forest-50">
              {row.total_accepted_value ? formatCurrency(row.total_accepted_value) : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 flex items-center justify-between text-xs">
        <span className="text-[11px] text-forest-500 truncate max-w-[170px]">
          {row.receiving_office}
        </span>
        <Link to={ROUTES.RECEIPT_DETAIL(row.id)} onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="xs" leftIcon={<Eye size={12} />}>
            View
          </Button>
        </Link>
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
        title="Stock Receipts / Goods Inward Register"
        subtitle="Record procurement arrivals, supplier delivery challans, and goods receipt notes (GRN)"
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <ViewToggle view={viewMode} onViewChange={handleViewChange} />
            {canCreate && (
              <Link to={ROUTES.RECEIPTS_NEW}>
                <Button variant="primary" size="sm" leftIcon={<PlusCircle size={15} />}>
                  + New Inward Receipt
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <GlassCard level={1} className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-400" />
          <input
            type="text"
            placeholder="Search voucher, supplier, PO..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-10 pr-3 py-2 bg-forest-50/50 dark:bg-forest-950/50 border border-forest-500/15 dark:border-forest-400/20 rounded-xl text-xs sm:text-sm text-forest-950 dark:text-forest-50 placeholder:text-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs font-bold text-forest-700 dark:text-forest-300">
            <Filter size={14} /> Status:
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-1.5 bg-forest-50/70 dark:bg-forest-950/70 border border-forest-500/15 dark:border-forest-400/20 rounded-xl text-xs text-forest-900 dark:text-forest-100 font-medium focus:outline-none focus:ring-1 focus:ring-forest-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted (Confirmed)</option>
          </select>
        </div>
      </GlassCard>

      {/* Receipts Table / Card View */}
      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={paginatedData}
          isLoading={isLoading}
          page={page}
          limit={pageSize}
          total={receipts.length}
          totalPages={totalPages}
          onPageChange={setPage}
          emptyTitle="No stock receipts found"
          emptyDescription="There are no inward receipts matching your active search query."
        />
      ) : (
        <CardView
          data={paginatedData}
          renderCard={renderReceiptCard}
          isLoading={isLoading}
          page={page}
          limit={pageSize}
          total={receipts.length}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </motion.div>
  )
}
