import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  PlusCircle, Search, Eye, Filter, ArrowUpRight,
  FileText, Building2, User
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { getIssues } from '../../api/transactions.api'
import { formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'

export default function IssueListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data: issuesData, isLoading } = useQuery({
    queryKey: ['issues', { search, deptFilter }],
    queryFn: () => getIssues({ search }),
  })

  const issues = issuesData?.data || []
  const canCreate = hasPermission(PERMISSIONS.STOCK_ISSUE_CREATE)

  const columns = [
    {
      key: 'voucher_number',
      header: 'Issue Voucher No.',
      render: (val, row) => (
        <div>
          <span
            className="font-mono text-sm font-semibold text-blue-700 hover:underline cursor-pointer"
            onClick={() => navigate(ROUTES.ISSUE_DETAIL(row.id))}
          >
            {val}
          </span>
          <span className="block text-xs text-slate-400 mt-0.5">Order: {row.sanction_order_number || 'Internal'}</span>
        </div>
      ),
    },
    {
      key: 'issue_date',
      header: 'Issue Date',
      render: (val) => <span className="text-sm text-slate-700 font-medium">{formatDate(val)}</span>,
    },
    {
      key: 'department',
      header: 'Recipient Department',
      render: (val) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded">
          <Building2 size={13} className="text-slate-500" />
          {val}
        </span>
      ),
    },
    {
      key: 'receiving_employee',
      header: 'Receiving Custodian',
      render: (val, row) => (
        <div>
          <span className="text-sm font-medium text-slate-900 flex items-center gap-1">
            <User size={13} className="text-slate-400" />
            {val}
          </span>
          <span className="text-xs text-slate-500">{row.receiving_designation || 'Staff'}</span>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Issued Items',
      render: (items) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-xs font-medium">
          <FileText size={12} />
          {items?.length || 0} line {items?.length === 1 ? 'item' : 'items'}
        </span>
      ),
    },
    {
      key: 'purpose',
      header: 'Issue Purpose',
      render: (val) => <span className="text-xs text-slate-600 max-w-xs truncate block">{val || 'Official Duty'}</span>,
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
          <Link to={ROUTES.ISSUE_DETAIL(row.id)}>
            <Button variant="ghost" size="sm" leftIcon={<Eye size={14} />}>
              View
            </Button>
          </Link>
        </div>
      ),
    },
  ]

  const paginatedData = issues.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.ceil(issues.length / pageSize) || 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Issues Register"
        subtitle="Issue store inventory, stationary, and durable assets to panchayat departments and custodians"
        actions={
          <div className="flex items-center gap-3">
            {canCreate && (
              <Link to={ROUTES.ISSUES_NEW}>
                <Button variant="primary" size="md" leftIcon={<PlusCircle size={16} />}>
                  + New Stock Issue
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Filter and Search */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by voucher, department, custodian..."
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
        emptyMessage="No stock issue vouchers found."
      />
    </div>
  )
}
