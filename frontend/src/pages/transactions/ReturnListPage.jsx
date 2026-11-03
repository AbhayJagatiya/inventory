import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  PlusCircle, Search, Eye, RotateCcw, Building2,
  FileText, ShieldCheck, AlertTriangle
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { getReturns } from '../../api/transactions.api'
import { formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'

export default function ReturnListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

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
            className="font-mono text-sm font-semibold text-blue-700 hover:underline cursor-pointer"
            onClick={() => navigate(ROUTES.RETURN_DETAIL(row.id))}
          >
            {val}
          </span>
          <span className="block text-xs text-slate-400 mt-0.5">
            Ref: {row.original_issue_voucher || 'Linked Issue'}
          </span>
        </div>
      ),
    },
    {
      key: 'return_date',
      header: 'Return Date',
      render: (val) => <span className="text-sm text-slate-700 font-medium">{formatDate(val)}</span>,
    },
    {
      key: 'returning_department',
      header: 'Returning Department',
      render: (val) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded">
          <Building2 size={13} className="text-slate-500" />
          {val}
        </span>
      ),
    },
    {
      key: 'items',
      header: 'Returned Items',
      render: (items) => {
        const hasDamaged = items?.some((i) => i.condition === 'DAMAGED' || i.condition === 'SCRAP')
        return (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono text-xs font-medium">
              <RotateCcw size={12} />
              {items?.length || 0} line {items?.length === 1 ? 'item' : 'items'}
            </span>
            {hasDamaged && (
              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold flex items-center gap-1">
                <AlertTriangle size={11} /> Damaged
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'return_reason',
      header: 'Reason for Return',
      render: (val) => <span className="text-xs text-slate-600 max-w-xs truncate block">{val || 'Surplus re-deposit'}</span>,
    },
    {
      key: 'receiving_officer',
      header: 'Received By Store',
      render: (val) => <span className="text-xs text-slate-800 font-medium">{val || 'Store Officer'}</span>,
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
          <Link to={ROUTES.RETURN_DETAIL(row.id)}>
            <Button variant="ghost" size="sm" leftIcon={<Eye size={14} />}>
              View
            </Button>
          </Link>
        </div>
      ),
    },
  ]

  const paginatedData = returns.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(returns.length / pageSize) || 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Returns Register"
        subtitle="Manage inventory returns from departments, inspect physical condition, and re-admit stock"
        actions={
          <div className="flex items-center gap-3">
            {canCreate && (
              <Link to={ROUTES.RETURNS_NEW}>
                <Button variant="primary" size="md" leftIcon={<PlusCircle size={16} />}>
                  + Record Stock Return
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
            placeholder="Search by voucher, department, issue ref..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={paginatedData}
        loading={isLoading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyMessage="No stock return records found."
      />
    </div>
  )
}
