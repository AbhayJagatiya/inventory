import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Printer, ShieldCheck, Building2, User, FileText, Package
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import LoadingSkeleton from '../../components/feedback/LoadingSkeleton'
import ErrorState from '../../components/feedback/ErrorState'
import { getIssue } from '../../api/transactions.api'
import { formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'

export default function IssueDetailPage() {
  const { id } = useParams()

  const { data: issueData, isLoading, isError, refetch } = useQuery({
    queryKey: ['issue', id],
    queryFn: () => getIssue(id),
  })

  const issue = issueData?.data || issueData || {}

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 rounded w-72 animate-pulse" />
        <LoadingSkeleton rows={5} />
      </div>
    )
  }

  if (isError || !issue.id) {
    return <ErrorState message="Could not locate issue voucher." onRetry={refetch} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Stock Issue: ${issue.voucher_number}`}
        subtitle={`Issued on: ${formatDate(issue.issue_date)} · Recipient: ${issue.department}`}
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.ISSUES}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                Back to Register
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Printer size={14} />}
              onClick={() => window.print()}
            >
              Print Issue Gate Pass
            </Button>
          </div>
        }
      />

      {/* Audit Banner */}
      <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-emerald-900 text-xs">
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck size={18} className="text-emerald-700" />
          <span>
            <strong>VOUCHER POSTED:</strong> Items legally issued and transferred to departmental custody on{' '}
            {formatDate(issue.posted_at || issue.issue_date)} by {issue.issued_by || 'Store Staff'}.
          </span>
        </div>
        <StatusBadge status="POSTED" size="sm" />
      </div>

      {/* Recipient Details & Sanction */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 dark:border-emerald-500/15 pb-2">
            <Building2 size={14} className="text-emerald-600 dark:text-emerald-400" />
            Recipient Branch & Custodian
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Destination Department:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{issue.department}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Receiving Custodian:</span>
              <span className="font-medium text-slate-900 dark:text-white flex items-center gap-1">
                <User size={12} className="text-slate-400" />
                {issue.receiving_employee}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Employee Designation:</span>
              <span className="text-slate-800 dark:text-slate-200">{issue.receiving_designation || 'Staff'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Sanction / Order Memo:</span>
              <span className="font-mono text-slate-900 dark:text-white font-semibold">{issue.sanction_order_number || 'Direct Sanction'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 dark:border-emerald-500/15 pb-2">
            <Package size={14} className="text-emerald-600 dark:text-emerald-400" />
            Issuing Authority & Purpose
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Issuing Store:</span>
              <span className="font-medium text-slate-900 dark:text-white">District Panchayat Central Store, Veraval</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Issued By Officer:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{issue.issued_by || 'Store Staff'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Issue Purpose:</span>
              <span className="font-medium text-slate-900 dark:text-white">{issue.purpose}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">Handover Remarks:</span>
              <span className="text-slate-600 dark:text-slate-300">{issue.remarks || 'Items inspected and handed over.'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Itemized List */}
      <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-emerald-500/15 flex items-center justify-between bg-slate-50/70 dark:bg-[#0A1513]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText size={15} className="text-emerald-600 dark:text-emerald-400" />
            Issued Inventory Schedule ({issue.items?.length || 0})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 dark:bg-[#0A1513] border-b border-slate-200 dark:border-emerald-500/20 text-slate-700 dark:text-emerald-300 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">#</th>
                <th className="py-2.5 px-4">Item Name & Code</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-4">Serial Number</th>
                <th className="py-2.5 px-3 text-center">Issued Qty</th>
                <th className="py-2.5 px-3 text-center text-emerald-700 dark:text-emerald-400">Returned Qty</th>
                <th className="py-2.5 px-3 text-center text-amber-700 dark:text-amber-400">Outstanding Balance</th>
                <th className="py-2.5 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-emerald-500/10 text-slate-800 dark:text-slate-200">
              {issue.items?.map((line, idx) => (
                <tr key={line.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 dark:text-white block text-xs">{line.item_name}</span>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{line.item_code}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-[#081210] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-emerald-500/20">
                      {line.item_type === 'DURABLE_ASSET' ? 'Durable' : 'Consumable'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">{line.serial_number || 'N/A'}</td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                    {line.quantity_issued} {line.uom}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                    {line.quantity_returned || 0} {line.uom}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50/40 dark:bg-amber-950/20">
                    {line.remaining_unreturned ?? (line.quantity_issued - (line.quantity_returned || 0))} {line.uom}
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">{line.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custodian Sign-off Box */}
      <div className="bg-slate-50/70 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/20 rounded-2xl p-6 grid grid-cols-2 gap-8 text-xs text-slate-700 dark:text-slate-300">
        <div className="border-t border-slate-400 dark:border-emerald-500/40 pt-2 text-center mt-12">
          <p className="font-semibold text-slate-900 dark:text-white">Issuing Store Officer / Staff</p>
          <p className="text-slate-500 dark:text-slate-400">Store Department, Gir Somnath</p>
        </div>
        <div className="border-t border-slate-400 dark:border-emerald-500/40 pt-2 text-center mt-12">
          <p className="font-semibold text-slate-900 dark:text-white">Receiving Custodian Officer Signature</p>
          <p className="text-slate-500 dark:text-slate-400">{issue.receiving_employee} ({issue.department})</p>
        </div>
      </div>
    </div>
  )
}
