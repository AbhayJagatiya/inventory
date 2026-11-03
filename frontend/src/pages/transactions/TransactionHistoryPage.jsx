import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Eye, Filter, ArrowUpDown, Download, ArrowLeftRight,
  RotateCcw, Truck, FileText, ArrowRight, ShieldCheck, PlusCircle
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { getTransactions } from '../../api/transactions.api'
import { formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'

export default function TransactionHistoryPage() {
  const navigate = useNavigate()

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
            className="font-mono text-sm font-semibold text-blue-700 hover:underline cursor-pointer"
            onClick={() => navigate(row.detail_url)}
          >
            {val}
          </span>
          <span className="block text-xs text-slate-400 mt-0.5">{formatDate(row.date)}</span>
        </div>
      ),
    },
    {
      key: 'transaction_type',
      header: 'Movement Type',
      render: (val) => {
        let badgeColor = 'bg-blue-50 text-blue-800 border-blue-200'
        let icon = <FileText size={12} />

        if (val === 'RECEIPT') {
          badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200'
          icon = <ShieldCheck size={12} />
        } else if (val === 'ISSUE') {
          badgeColor = 'bg-indigo-50 text-indigo-800 border-indigo-200'
          icon = <ArrowLeftRight size={12} />
        } else if (val === 'RETURN') {
          badgeColor = 'bg-amber-50 text-amber-800 border-amber-200'
          icon = <RotateCcw size={12} />
        } else if (val === 'TRANSFER') {
          badgeColor = 'bg-purple-50 text-purple-800 border-purple-200'
          icon = <Truck size={12} />
        }

        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border ${badgeColor}`}>
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
          <span className="text-xs text-slate-900 font-medium block truncate" title={val}>
            {val}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {row.item_count} {row.item_count === 1 ? 'line' : 'lines'}
          </span>
        </div>
      ),
    },
    {
      key: 'route',
      header: 'Source ➔ Destination',
      render: (_, row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700 max-w-sm">
          <span className="truncate max-w-[120px]" title={row.source}>
            {row.source}
          </span>
          <ArrowRight size={12} className="text-blue-600 shrink-0" />
          <span className="font-semibold text-slate-900 truncate max-w-[140px]" title={row.destination}>
            {row.destination}
          </span>
        </div>
      ),
    },
    {
      key: 'initiated_by',
      header: 'Handled By',
      render: (val) => <span className="text-xs text-slate-700">{val || 'Store Staff'}</span>,
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
          <Button variant="ghost" size="sm" leftIcon={<Eye size={14} />}>
            Voucher
          </Button>
        </Link>
      ),
    },
  ]

  const paginatedData = ledger.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(ledger.length / pageSize) || 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unified Stock Movement Ledger"
        subtitle="Chronological audit history of all store receipts, issues, returns, and inter-office transfers"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download size={14} />}
              onClick={handleExportCSV}
            >
              Export Ledger CSV
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by voucher, item, party..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Filter size={13} /> Movement Type:
          </div>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Types</option>
            <option value="RECEIPT">Receipts (Goods Inward)</option>
            <option value="ISSUE">Issues (Departmental)</option>
            <option value="RETURN">Returns (Inward Redeposit)</option>
            <option value="TRANSFER">Transfers (Inter-Office)</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={paginatedData}
        loading={isLoading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyMessage="No stock transactions found matching the filter criteria."
      />
    </div>
  )
}

