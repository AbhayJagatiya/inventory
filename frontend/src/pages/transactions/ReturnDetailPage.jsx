import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Printer, ShieldCheck, Building2, User, FileText,
  RotateCcw, Wrench, AlertTriangle
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import LoadingSkeleton from '../../components/feedback/LoadingSkeleton'
import ErrorState from '../../components/feedback/ErrorState'
import { getReturn } from '../../api/transactions.api'
import { formatDate } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useLanguage } from '../../i18n'

export default function ReturnDetailPage() {
  const { id } = useParams()
  const { t } = useLanguage()

  const { data: returnData, isLoading, isError, refetch } = useQuery({
    queryKey: ['return', id],
    queryFn: () => getReturn(id),
  })

  const ret = returnData?.data || returnData || {}

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 rounded w-72 animate-pulse" />
        <LoadingSkeleton rows={5} />
      </div>
    )
  }

  if (isError || !ret.id) {
    return <ErrorState message={t('transactions.returns.detail.notFound')} onRetry={refetch} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('transactions.returns.detail.titlePrefix', { number: ret.voucher_number })}
        subtitle={t('transactions.returns.detail.subtitle', { date: formatDate(ret.return_date), dept: ret.returning_department })}
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.RETURNS}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                {t('transactions.returns.detail.backToRegister')}
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Printer size={14} />}
              onClick={() => window.print()}
            >
              {t('transactions.returns.detail.printVoucher')}
            </Button>
          </div>
        }
      />

      {/* Audit Banner */}
      <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-emerald-900 text-xs">
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck size={18} className="text-emerald-700" />
          <span>
            <strong>{t('transactions.returns.detail.returnPosted')}</strong>{' '}
            {t('transactions.returns.detail.postedDesc', {
              date: formatDate(ret.posted_at || ret.return_date),
              by: ret.posted_by || t('transactions.returns.detail.storeOfficer'),
            })}
          </span>
        </div>
        <StatusBadge status="POSTED" size="sm" />
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 dark:border-emerald-500/15 pb-2">
            <RotateCcw size={14} className="text-emerald-600 dark:text-emerald-400" />
            {t('transactions.returns.detail.sectionDeptRef')}
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.returns.detail.returningDept')}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{ret.returning_department}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.returns.detail.returningOfficer')}</span>
              <span className="font-medium text-slate-900 dark:text-white">{ret.returning_employee}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.returns.detail.originalVoucher')}</span>
              {ret.original_issue_id ? (
                <Link
                  to={ROUTES.ISSUE_DETAIL(ret.original_issue_id)}
                  className="font-mono text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                >
                  {ret.original_issue_voucher} ↗
                </Link>
              ) : (
                <span className="font-mono text-slate-800 dark:text-slate-200">{ret.original_issue_voucher || t('transactions.returns.detail.directReturn')}</span>
              )}
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.returns.detail.returnReason')}</span>
              <span className="text-slate-900 dark:text-white font-medium">{ret.return_reason}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 dark:border-emerald-500/15 pb-2">
            <Building2 size={14} className="text-emerald-600 dark:text-emerald-400" />
            {t('transactions.returns.detail.sectionCustody')}
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.returns.detail.receivingStore')}</span>
              <span className="font-medium text-slate-900 dark:text-white">{t('transactions.issues.detail.centralStoreName')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.returns.create.receivingStoreOfficer')}:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{ret.receiving_officer || t('transactions.returns.detail.storeOfficer')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-emerald-500/10">
              <span className="text-slate-500 dark:text-slate-400">{t('transactions.returns.detail.physicalInspection')}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{t('transactions.returns.detail.completedVerified')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Itemized Table */}
      <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-emerald-500/15 flex items-center justify-between bg-slate-50/70 dark:bg-[#0A1513]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText size={15} className="text-emerald-600 dark:text-emerald-400" />
            {t('transactions.returns.detail.scheduleTitle', { count: ret.items?.length || 0 })}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 dark:bg-[#0A1513] border-b border-slate-200 dark:border-emerald-500/20 text-slate-700 dark:text-emerald-300 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">#</th>
                <th className="py-2.5 px-4">{t('transactions.returns.detail.colItemNameCode')}</th>
                <th className="py-2.5 px-3 text-center">{t('transactions.returns.detail.colReturnedQty')}</th>
                <th className="py-2.5 px-3 text-center">{t('transactions.returns.detail.colCondition')}</th>
                <th className="py-2.5 px-4">{t('transactions.returns.detail.colRemarks')}</th>
                <th className="py-2.5 px-4">{t('transactions.returns.detail.colRouting')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-emerald-500/10 text-slate-800 dark:text-slate-200">
              {ret.items?.map((line, idx) => {
                const isDamaged = line.condition === 'DAMAGED' || line.condition === 'SCRAP'
                return (
                  <tr key={line.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 dark:text-white block text-xs">{line.item_name}</span>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{line.item_code}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                      {line.quantity_returned} {line.uom}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <StatusBadge status={line.condition} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs">{line.inspection_notes || '—'}</td>
                    <td className="py-3 px-4">
                      {isDamaged ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-[11px] font-semibold">
                          <Wrench size={12} /> {t('transactions.returns.detail.routedMaintenance')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold">
                          <ShieldCheck size={12} /> {t('transactions.returns.detail.restoredStock')}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
