import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  PlusCircle, Search, Eye, ArrowRightLeft, Building2,
  FileText, Truck, ArrowRight
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { getTransfers } from '../../api/transactions.api'
import { formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'

export default function TransferListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

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
            className="font-mono text-sm font-semibold text-blue-700 hover:underline cursor-pointer"
            onClick={() => navigate(ROUTES.TRANSFER_DETAIL(row.id))}
          >
            {val}
          </span>
          <span className="block text-xs text-slate-400 mt-0.5">Order: {row.order_reference || 'Inter-store'}</span>
        </div>
      ),
    },
    {
      key: 'request_date',
      header: 'Date',
      render: (val) => <span className="text-sm text-slate-700 font-medium">{formatDate(val)}</span>,
    },
    {
      key: 'transfer_type',
      header: 'Type',
      render: (val) => (
        <span
          className={`px-2 py-0.5 rounded text-xs font-semibold ${
            val === 'PERMANENT'
              ? 'bg-purple-50 text-purple-700 border border-purple-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          {val === 'PERMANENT' ? 'Permanent' : 'Temporary Loan'}
        </span>
      ),
    },
    {
      key: 'route',
      header: 'Relocation Route',
      render: (_, row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-800">
          <span className="font-medium max-w-[120px] truncate" title={row.source_office}>
            {row.source_office.split(',')[0]}
          </span>
          <ArrowRight size={12} className="text-blue-600 shrink-0" />
          <span className="font-semibold text-blue-900 max-w-[140px] truncate" title={row.destination_office}>
            {row.destination_office.split(',')[0]}
          </span>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Assets / Stock',
      render: (items) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs font-medium">
          <FileText size={12} />
          {items?.length || 0} line {items?.length === 1 ? 'item' : 'items'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Transfer Status',
      render: (val) => <StatusBadge status={val} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <Link to={ROUTES.TRANSFER_DETAIL(row.id)}>
            <Button variant="ghost" size="sm" leftIcon={<Eye size={14} />}>
              Lifecycle
            </Button>
          </Link>
        </div>
      ),
    },
  ]

  const paginatedData = transfers.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(transfers.length / pageSize) || 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inter-Office Transfers Register"
        subtitle="Track asset relocations across District and Taluka Panchayat store repositories"
        actions={
          <div className="flex items-center gap-3">
            {canRequest && (
              <Link to={ROUTES.TRANSFERS_NEW}>
                <Button variant="primary" size="md" leftIcon={<PlusCircle size={16} />}>
                  + New Transfer Request
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by transfer ref, office, order..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Submitted (Pending Review)</option>
            <option value="APPROVED">Approved</option>
            <option value="IN_TRANSIT">In Transit (Dispatched)</option>
            <option value="COMPLETED">Completed (Acknowledged)</option>
            <option value="REJECTED">Rejected</option>
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
        emptyMessage="No transfer vouchers found."
      />
    </div>
  )
}
