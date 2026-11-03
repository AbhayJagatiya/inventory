import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  PlusCircle, Search, Eye, Filter, CheckCircle2,
  FileText, Clock, Building, ArrowUpDown, Download
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { getReceipts } from '../../api/transactions.api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'

export default function ReceiptListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data: receiptsData, isLoading, refetch } = useQuery({
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
          <span className="font-mono text-sm font-semibold text-blue-700 hover:underline cursor-pointer" onClick={() => navigate(ROUTES.RECEIPT_DETAIL(row.id))}>
            {val}
          </span>
          <span className="block text-xs text-slate-400 mt-0.5">PO: {row.po_number || 'Direct Proc.'}</span>
        </div>
      ),
    },
    {
      key: 'receipt_date',
      header: 'Receipt Date',
      render: (val) => <span className="text-sm text-slate-700 font-medium">{formatDate(val)}</span>,
    },
    {
      key: 'supplier_name',
      header: 'Supplier / Vendor',
      render: (val, row) => (
        <div>
          <span className="text-sm font-medium text-slate-900">{val}</span>
          {row.invoice_number && (
            <span className="block text-xs text-slate-500 font-mono">Inv: {row.invoice_number}</span>
          )}
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Received Items',
      render: (items) => (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs font-medium">
          <FileText size={12} className="text-slate-500" />
          {items?.length || 0} line {items?.length === 1 ? 'item' : 'items'}
        </span>
      ),
    },
    {
      key: 'total_accepted_value',
      header: 'Accepted Value',
      render: (val) => (
        <span className="font-mono text-sm font-semibold text-slate-800">
          {val ? formatCurrency(val) : '—'}
        </span>
      ),
    },
    {
      key: 'receiving_office',
      header: 'Receiving Office / Bay',
      render: (val, row) => (
        <div>
          <span className="text-xs text-slate-700 block max-w-xs truncate">{val}</span>
          <span className="text-[11px] text-slate-400 font-medium">{row.receiving_location || 'Store Room'}</span>
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
            <Button variant="ghost" size="sm" leftIcon={<Eye size={14} />}>
              View
            </Button>
          </Link>
        </div>
      ),
    },
  ]

  // Pagination slice
  const paginatedData = receipts.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(receipts.length / pageSize) || 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Receipts / Goods Inward Register"
        subtitle="Record procurement arrivals, supplier delivery challans, and goods receipt notes (GRN)"
        actions={
          <div className="flex items-center gap-3">
            {canCreate && (
              <Link to={ROUTES.RECEIPTS_NEW}>
                <Button variant="primary" size="md" leftIcon={<PlusCircle size={16} />}>
                  + New Goods Inward
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by voucher, supplier, PO..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Filter size={14} /> Status:
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted (Confirmed)</option>
          </select>
        </div>
      </div>

      {/* Receipts Table */}
      <DataTable
        columns={columns}
        data={paginatedData}
        loading={isLoading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyMessage="No stock receipts found matching your query."
      />
    </div>
  )
}
