import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  PlusCircle, Search, Eye, RotateCcw, Building2,
  FileText, ShieldCheck
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import CardView from '../../components/tables/CardView'
import ViewToggle from '../../components/common/ViewToggle'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { getReturns } from '../../api/transactions.api'
import { formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import { motion } from 'framer-motion'

export default function ReturnListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('dsims_returns_view') || 'table'
    } catch {
      return 'table'
    }
  })

  const handleViewChange = (mode) => {
    setViewMode(mode)
    try {
      localStorage.setItem('dsims_returns_view', mode)
    } catch {}
  }

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data: returnsData, isLoading } = useQuery({
    queryKey: ['returns', { search }],
    queryFn: () => getReturns({ search }),
  })

  const returns = returnsData?.data || []
  const canCreate = hasPermission(PERMISSIONS.STOCK_RETURN_CREATE)

  const columns = [
    {
      key: 'voucher_number',
      header: 'Return Voucher No.',
      render: (val, row) => (
        <div>
          <span
            className="font-mono text-xs font-bold text-forest-700 dark:text-forest-300 hover:underline cursor-pointer"
            onClick={() => navigate(ROUTES.RETURN_DETAIL(row.id))}
          >
            {val}
          </span>
          <span className="block text-[11px] text-forest-500 mt-0.5">
            Ref: {row.original_issue_voucher || 'Linked Issue'}
          </span>
        </div>
      ),
    },
    {
      key: 'return_date',
      header: 'Return Date',
      render: (val) => <span className="text-xs text-forest-800 dark:text-forest-200 font-semibold">{formatDate(val)}</span>,
    },
    {
      key: 'returning_department',
      header: 'Returning Department',
      render: (val) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-forest-900 dark:text-forest-100 bg-forest-500/10 px-2.5 py-1 rounded-lg border border-forest-500/15">
          <Building2 size={13} className="text-forest-600 dark:text-forest-400" />
          {val}
        </span>
      ),
    },
    {
      key: 'returned_by_person',
      header: 'Returned By',
      render: (val) => <span className="text-xs text-forest-900 dark:text-forest-100 font-semibold">{val}</span>,
    },
    {
      key: 'items',
      header: 'Returned Items',
      render: (items) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-forest-500/10 text-forest-800 dark:text-forest-200 font-mono text-[11px] font-semibold">
          <FileText size={12} className="text-forest-500" />
          {items?.length || 0} line items
        </span>
      ),
    },
    {
      key: 'return_reason',
      header: 'Return Reason',
      render: (val) => (
        <span className="text-xs text-forest-600 dark:text-forest-300 max-w-xs truncate block" title={val}>
          {val}
        </span>
      ),
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
        <Link to={ROUTES.RETURN_DETAIL(row.id)}>
          <Button variant="ghost" size="xs" leftIcon={<Eye size={13} />}>
            View
          </Button>
        </Link>
      ),
    },
  ]

  const paginatedData = returns.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(returns.length / pageSize) || 1

  const renderReturnCard = (row) => (
    <GlassCard
      key={row.id}
      level={1}
      interactive={true}
      cursorLight={true}
      onClick={() => navigate(ROUTES.RETURN_DETAIL(row.id))}
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
          {row.returning_department}
        </h3>
        <p className="text-[11px] text-forest-600 dark:text-forest-400 mb-2">
          Returned by: <span className="font-bold">{row.returned_by_person}</span>
        </p>

        <div className="py-2 border-y border-forest-500/10 dark:border-forest-300/10 space-y-1 text-xs text-forest-700 dark:text-forest-300">
          <div className="flex items-center justify-between">
            <span className="text-forest-500">Return Date:</span>
            <span>{formatDate(row.return_date)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-forest-500">Linked Issue:</span>
            <span className="font-mono">{row.original_issue_voucher || 'Direct'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-forest-500">Items:</span>
            <span className="font-bold font-mono">{row.items?.length || 0} line items</span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 flex items-center justify-between text-xs">
        <span className="text-[11px] text-forest-500 truncate max-w-[170px]">
          {row.return_reason}
        </span>
        <Link to={ROUTES.RETURN_DETAIL(row.id)} onClick={(e) => e.stopPropagation()}>
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
        title="Stock Return & Redeposit Register"
        subtitle="Manage returned equipment, unutilized consumables, and store restocking inspection"
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <ViewToggle view={viewMode} onViewChange={handleViewChange} />
            {canCreate && (
              <Link to={ROUTES.RETURNS_NEW}>
                <Button variant="primary" size="sm" leftIcon={<RotateCcw size={15} />}>
                  + New Stock Return
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
            placeholder="Search return voucher, officer, issue ref..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-10 pr-3 py-2 bg-forest-50/50 dark:bg-forest-950/50 border border-forest-500/15 dark:border-forest-400/20 rounded-xl text-xs sm:text-sm text-forest-950 dark:text-forest-50 placeholder:text-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-500"
          />
        </div>
      </GlassCard>

      {/* Return Table / Card View */}
      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={paginatedData}
          isLoading={isLoading}
          page={page}
          limit={pageSize}
          total={returns.length}
          totalPages={totalPages}
          onPageChange={setPage}
          emptyTitle="No stock returns found"
          emptyDescription="There are no stock return vouchers matching your search query."
        />
      ) : (
        <CardView
          data={paginatedData}
          renderCard={renderReturnCard}
          isLoading={isLoading}
          page={page}
          limit={pageSize}
          total={returns.length}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </motion.div>
  )
}
