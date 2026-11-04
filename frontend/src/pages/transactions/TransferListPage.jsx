import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  PlusCircle, Search, Eye, Filter, Building2,
  FileText, Truck, ArrowRight
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import CardView from '../../components/tables/CardView'
import ViewToggle from '../../components/common/ViewToggle'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { getTransfers } from '../../api/transactions.api'
import { formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import { motion } from 'framer-motion'

export default function TransferListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('dsims_transfers_view') || 'table'
    } catch {
      return 'table'
    }
  })

  const handleViewChange = (mode) => {
    setViewMode(mode)
    try {
      localStorage.setItem('dsims_transfers_view', mode)
    } catch { }
  }

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data: transfersData, isLoading } = useQuery({
    queryKey: ['transfers', { search, statusFilter }],
    queryFn: () => getTransfers({ search, status: statusFilter }),
  })

  const transfers = transfersData?.data || []
  const canRequest = hasPermission(PERMISSIONS.STOCK_TRANSFER_REQ)

  const columns = [
    {
      key: 'transfer_number',
      header: 'Transfer Ref No.',
      render: (val, row) => (
        <div>
          <span
            className="font-mono text-xs font-bold text-forest-700 dark:text-forest-300 hover:underline cursor-pointer"
            onClick={() => navigate(ROUTES.TRANSFER_DETAIL(row.id))}
          >
            {val}
          </span>
          <span className="block text-[11px] text-forest-500 mt-0.5">Order: {row.order_reference || 'Inter-store'}</span>
        </div>
      ),
    },
    {
      key: 'request_date',
      header: 'Date',
      render: (val) => <span className="text-xs text-forest-800 dark:text-forest-200 font-semibold">{formatDate(val)}</span>,
    },
    {
      key: 'transfer_type',
      header: 'Type',
      render: (val) => (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-forest-500/10 text-forest-800 dark:text-forest-200 border border-forest-500/15">
          {val === 'INTER_OFFICE' ? 'Inter-Office' : 'Intra-Office'}
        </span>
      ),
    },
    {
      key: 'route',
      header: 'Transfer Route (From ➔ To)',
      render: (_, row) => (
        <div className="flex items-center gap-1.5 text-xs text-forest-700 dark:text-forest-300 max-w-sm">
          <span className="truncate max-w-[120px]" title={row.from_office_name}>
            {row.from_office_name}
          </span>
          <ArrowRight size={12} className="text-forest-500 shrink-0" />
          <span className="font-bold text-forest-950 dark:text-forest-50 truncate max-w-[140px]" title={row.to_office_name}>
            {row.to_office_name}
          </span>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (items) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-forest-500/10 text-forest-800 dark:text-forest-200 font-mono text-[11px] font-semibold">
          <FileText size={12} className="text-forest-500" />
          {items?.length || 0} line items
        </span>
      ),
    },
    {
      key: 'initiated_by_name',
      header: 'Requested By',
      render: (val) => <span className="text-xs text-forest-600 dark:text-forest-400 font-medium">{val}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (val) => <StatusBadge status={val} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (_, row) => (
        <Link to={ROUTES.TRANSFER_DETAIL(row.id)}>
          <Button variant="ghost" size="xs" leftIcon={<Eye size={13} />}>
            Track
          </Button>
        </Link>
      ),
    },
  ]

  const paginatedData = transfers.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(transfers.length / pageSize) || 1

  const renderTransferCard = (row) => (
    <GlassCard
      key={row.id}
      level={1}
      interactive={true}
      cursorLight={true}
      onClick={() => navigate(ROUTES.TRANSFER_DETAIL(row.id))}
      className="p-5 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="font-mono text-xs font-bold text-forest-700 dark:text-forest-300 bg-forest-500/10 px-2 py-0.5 rounded-lg border border-forest-500/20">
            {row.transfer_number}
          </span>
          <StatusBadge status={row.status} size="xs" />
        </div>

        <div className="flex items-center gap-1.5 text-xs font-bold text-forest-950 dark:text-forest-50 mb-2">
          <span className="truncate">{row.from_office_name}</span>
          <ArrowRight size={12} className="text-forest-500 shrink-0" />
          <span className="truncate">{row.to_office_name}</span>
        </div>

        <div className="py-2 border-y border-forest-500/10 dark:border-forest-300/10 space-y-1 text-xs text-forest-700 dark:text-forest-300">
          <div className="flex items-center justify-between">
            <span className="text-forest-500">Date:</span>
            <span>{formatDate(row.request_date)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-forest-500">Type:</span>
            <span className="font-semibold">{row.transfer_type}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-forest-500">Items:</span>
            <span className="font-bold font-mono">{row.items?.length || 0} line items</span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 flex items-center justify-between text-xs">
        <span className="text-[11px] text-forest-500 truncate max-w-[170px]">
          By: {row.initiated_by_name}
        </span>
        <Link to={ROUTES.TRANSFER_DETAIL(row.id)} onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="xs" leftIcon={<Eye size={12} />}>
            Track
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
        title="Inter-Store Stock Transfers"
        subtitle="Track multi-stage inventory transit, authorizations, gate-passes, and destination receipt verifications"
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <ViewToggle view={viewMode} onViewChange={handleViewChange} />
            {canRequest && (
              <Link to={ROUTES.TRANSFERS_NEW}>
                <Button variant="primary" size="sm" leftIcon={<PlusCircle size={15} />}>
                  + New Transfer Request
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
            placeholder="Search transfer ref, order, office..."
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
            <option value="SUBMITTED">Submitted (Pending Approval)</option>
            <option value="APPROVED">Approved (Pending Dispatch)</option>
            <option value="IN_TRANSIT">In Transit (Dispatched)</option>
            <option value="COMPLETED">Completed (Acknowledged)</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </GlassCard>

      {/* Transfers Presentation */}
      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={paginatedData}
          isLoading={isLoading}
          page={page}
          limit={pageSize}
          total={transfers.length}
          totalPages={totalPages}
          onPageChange={setPage}
          emptyTitle="No stock transfers found"
          emptyDescription="There are no transfer records matching your active filters."
        />
      ) : (
        <CardView
          data={paginatedData}
          renderCard={renderTransferCard}
          isLoading={isLoading}
          page={page}
          limit={pageSize}
          total={transfers.length}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </motion.div>
  )
}
