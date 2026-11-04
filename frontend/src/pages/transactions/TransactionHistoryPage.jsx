import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Eye, Filter, Download, ArrowLeftRight,
  RotateCcw, Truck, FileText, ArrowRight, ShieldCheck
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import CardView from '../../components/tables/CardView'
import ViewToggle from '../../components/common/ViewToggle'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { getTransactions } from '../../api/transactions.api'
import { formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { motion } from 'framer-motion'

export default function TransactionHistoryPage() {
  const navigate = useNavigate()

  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('dsims_transactions_view') || 'table'
    } catch {
      return 'table'
    }
  })

  const handleViewChange = (mode) => {
    setViewMode(mode)
    try {
      localStorage.setItem('dsims_transactions_view', mode)
    } catch {}
  }

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 12

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ['unified-transactions-ledger', { search, typeFilter, statusFilter }],
    queryFn: () => getTransactions({ search, type: typeFilter, status: statusFilter }),
  })

  const ledger = ledgerData?.data || []

  const handleExportCSV = () => {
    if (ledger.length === 0) return
    const headers = ['Voucher Number', 'Transaction Type', 'Date', 'Items Summary', 'Source', 'Destination', 'Initiated By', 'Status']
    const rows = ledger.map((t) => [
      t.voucher_number,
      t.transaction_type,
      t.date,
      `"${(t.item_summary || '').replace(/"/g, '""')}"`,
      `"${(t.source || '').replace(/"/g, '""')}"`,
      `"${(t.destination || '').replace(/"/g, '""')}"`,
      `"${(t.initiated_by || '').replace(/"/g, '""')}"`,
      t.status,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `store-transactions-ledger-${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const columns = [
    {
      key: 'voucher_number',
      header: 'Voucher Ref No.',
      render: (val, row) => (
        <div>
          <span
            className="font-mono text-xs font-bold text-forest-700 dark:text-forest-300 hover:underline cursor-pointer"
            onClick={() => navigate(row.detail_url)}
          >
            {val}
          </span>
          <span className="block text-[11px] text-forest-500 mt-0.5">{formatDate(row.date)}</span>
        </div>
      ),
    },
    {
      key: 'transaction_type',
      header: 'Movement Type',
      render: (val) => {
        let badgeColor = 'bg-forest-500/10 text-forest-800 dark:text-forest-200 border-forest-500/20'
        let icon = <FileText size={12} />

        if (val === 'RECEIPT') {
          badgeColor = 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
          icon = <ShieldCheck size={12} />
        } else if (val === 'ISSUE') {
          badgeColor = 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30'
          icon = <ArrowLeftRight size={12} />
        } else if (val === 'RETURN') {
          badgeColor = 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
          icon = <RotateCcw size={12} />
        } else if (val === 'TRANSFER') {
          badgeColor = 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30'
          icon = <Truck size={12} />
        }

        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeColor}`}>
            {icon}
            {val}
          </span>
        )
      },
    },
    {
      key: 'item_summary',
      header: 'Inventory Items',
      render: (val, row) => (
        <div className="max-w-xs">
          <span className="text-xs text-forest-950 dark:text-forest-50 font-semibold block truncate" title={val}>
            {val}
          </span>
          <span className="text-[11px] text-forest-500 font-mono">
            {row.item_count} {row.item_count === 1 ? 'line item' : 'line items'}
          </span>
        </div>
      ),
    },
    {
      key: 'route',
      header: 'Source ➔ Destination',
      render: (_, row) => (
        <div className="flex items-center gap-1.5 text-xs text-forest-700 dark:text-forest-300 max-w-sm">
          <span className="truncate max-w-[120px]" title={row.source}>
            {row.source}
          </span>
          <ArrowRight size={12} className="text-forest-500 shrink-0" />
          <span className="font-bold text-forest-950 dark:text-forest-50 truncate max-w-[140px]" title={row.destination}>
            {row.destination}
          </span>
        </div>
      ),
    },
    {
      key: 'initiated_by',
      header: 'Handled By',
      render: (val) => <span className="text-xs text-forest-600 dark:text-forest-300">{val || 'Store Staff'}</span>,
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
        <Link to={row.detail_url}>
          <Button variant="ghost" size="xs" leftIcon={<Eye size={13} />}>
            Voucher
          </Button>
        </Link>
      ),
    },
  ]

  const paginatedData = ledger.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(ledger.length / pageSize) || 1

  const renderTransactionCard = (tx) => (
    <GlassCard
      key={tx.id || tx.voucher_number}
      level={1}
      interactive={true}
      cursorLight={true}
      onClick={() => navigate(tx.detail_url)}
      className="p-5 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="font-mono text-xs font-bold text-forest-700 dark:text-forest-300 bg-forest-500/10 px-2 py-0.5 rounded-lg border border-forest-500/20">
            {tx.voucher_number}
          </span>
          <StatusBadge status={tx.status} size="xs" />
        </div>

        <div className="text-xs font-semibold text-forest-950 dark:text-forest-50 line-clamp-2 mb-2">
          {tx.item_summary}
        </div>

        <div className="py-2 border-y border-forest-500/10 dark:border-forest-300/10 space-y-1 text-xs text-forest-600 dark:text-forest-300">
          <div className="flex items-center justify-between">
            <span className="text-forest-500">Movement:</span>
            <span className="font-bold">{tx.transaction_type}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-forest-500">Date:</span>
            <span>{formatDate(tx.date)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-forest-500">Handled by:</span>
            <span>{tx.initiated_by}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 flex items-center justify-between text-xs">
        <span className="text-[11px] text-forest-500 truncate max-w-[180px]">
          {tx.destination}
        </span>
        <Link to={tx.detail_url} onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="xs" leftIcon={<Eye size={12} />}>
            Voucher
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
        title="Unified Stock Movement Ledger"
        subtitle="Chronological audit trail of all store receipts, departmental issues, returns, and inter-office transfers"
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <ViewToggle view={viewMode} onViewChange={handleViewChange} />
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download size={14} />}
              onClick={handleExportCSV}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <GlassCard level={1} className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-400" />
          <input
            type="text"
            placeholder="Search voucher, items, officer..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-10 pr-3 py-2 bg-forest-50/50 dark:bg-forest-950/50 border border-forest-500/15 dark:border-forest-400/20 rounded-xl text-xs sm:text-sm text-forest-950 dark:text-forest-50 placeholder:text-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold text-forest-700 dark:text-forest-300">
            <Filter size={13} /> Movement:
          </div>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-1.5 bg-forest-50/70 dark:bg-forest-950/70 border border-forest-500/15 dark:border-forest-400/20 rounded-xl text-xs text-forest-900 dark:text-forest-100 font-medium focus:outline-none focus:ring-1 focus:ring-forest-500"
          >
            <option value="ALL">All Types</option>
            <option value="RECEIPT">Receipts (Goods Inward)</option>
            <option value="ISSUE">Issues (Departmental)</option>
            <option value="RETURN">Returns (Inward Redeposit)</option>
            <option value="TRANSFER">Transfers (Inter-Office)</option>
          </select>
        </div>
      </GlassCard>

      {/* Main Content Presentation */}
      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={paginatedData}
          isLoading={isLoading}
          page={page}
          limit={pageSize}
          total={ledger.length}
          totalPages={totalPages}
          onPageChange={setPage}
          emptyTitle="No stock transactions found"
          emptyDescription="There are no transaction records matching your search or movement filter."
        />
      ) : (
        <CardView
          data={paginatedData}
          renderCard={renderTransactionCard}
          isLoading={isLoading}
          page={page}
          limit={pageSize}
          total={ledger.length}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </motion.div>
  )
}
