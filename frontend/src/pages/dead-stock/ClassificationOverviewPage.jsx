import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Archive, Play, RefreshCw, AlertTriangle, ShieldAlert,
  Clock, CheckCircle, ArrowRight, Layers, FileText, Info
} from 'lucide-react'
import { getClassificationSummary, runClassificationEngine } from '../../api/disposal.api'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import ErrorState from '../../components/feedback/ErrorState'
import { CardSkeleton } from '../../components/feedback/LoadingSkeleton'
import { formatNumber, formatDateTime } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import toast from 'react-hot-toast'

export default function ClassificationOverviewPage() {
  const { user, hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const officeId = user?.office?.id || user?.office_id

  const {
    data: summaryRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['classification-summary', officeId],
    queryFn: () => getClassificationSummary(officeId ? { office_id: officeId } : {}),
  })

  const summary = summaryRes?.data || summaryRes

  const runMutation = useMutation({
    mutationFn: () => runClassificationEngine({ office_id: officeId }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['classification-summary'] })
      queryClient.invalidateQueries({ queryKey: ['dead-stock-register'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      const result = res?.data || res
      toast.success(
        `Classification run completed! Evaluated: ${result?.evaluated_count ?? 0}, Updated: ${result?.updated_count ?? 0}`
      )
    },
    onError: (err) => {
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || 'Classification engine run failed.'
      toast.error(msg)
    },
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Dead Stock Classification Engine"
        subtitle="Algorithmic categorization into Active, Slow-Moving, Non-Moving, and Obsolete stock"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              onClick={() => refetch()}
              loading={isLoading}
            >
              Refresh
            </Button>
            {hasPermission(PERMISSIONS.CLASSIFY_RUN) && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Play size={14} />}
                loading={runMutation.isPending}
                onClick={() => runMutation.mutate()}
              >
                Run Classification
              </Button>
            )}
            <Link to={ROUTES.DEAD_STOCK_REGISTER}>
              <Button variant="secondary" size="sm" rightIcon={<ArrowRight size={14} />}>
                Dead Stock Register
              </Button>
            </Link>
          </div>
        }
      />

      {/* Error State */}
      {isError && (
        <ErrorState
          title="Failed to Load Classification Engine"
          message={
            error?.response?.data?.error?.message ||
            error?.response?.data?.detail ||
            'Unable to connect to the backend classification service. Ensure the FastAPI backend is running.'
          }
          onRetry={refetch}
        />
      )}

      {/* Loading Skeleton */}
      {isLoading && !isError && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {/* Summary KPI Cards */}
      {!isLoading && !isError && summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Evaluated */}
            <GlassCard level={1} className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-forest-600/90 dark:text-forest-300/80">
                  Total Evaluated Assets
                </p>
                <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-forest-500/10 text-forest-600 dark:text-forest-300 border-forest-500/20">
                  <Layers size={19} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-forest-900 dark:text-forest-100 tracking-tight">
                {formatNumber(summary.total_evaluated ?? 0)}
              </div>
              <p className="text-xs text-forest-600 dark:text-forest-400 font-medium mt-2">
                Last calculated: {summary.calculated_at ? formatDateTime(summary.calculated_at) : 'Not calculated yet'}
              </p>
            </GlassCard>

            {/* Active Items */}
            <GlassCard level={1} className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600/90 dark:text-emerald-300/80">
                  Active Store Stock
                </p>
                <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20">
                  <CheckCircle size={19} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-800 dark:text-emerald-200 tracking-tight">
                {formatNumber(summary.active_count ?? 0)}
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2">
                Regular circulation & healthy movement
              </p>
            </GlassCard>

            {/* Non-Moving Pool */}
            <GlassCard level={1} className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600/90 dark:text-amber-300/80">
                  Non-Moving Stock
                </p>
                <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20">
                  <Clock size={19} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-800 dark:text-amber-200 tracking-tight">
                {formatNumber(summary.non_moving_count ?? 0)}
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-2">
                Inactive beyond category threshold
              </p>
            </GlassCard>

            {/* Obsolete Pool */}
            <GlassCard level={1} className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-600/90 dark:text-rose-300/80">
                  Obsolete / Dead Stock
                </p>
                <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/20">
                  <ShieldAlert size={19} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-rose-800 dark:text-rose-200 tracking-tight">
                {formatNumber(summary.obsolete_count ?? 0)}
              </div>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-2">
                Exceeded useful life or damaged/scrap
              </p>
            </GlassCard>
          </div>

          {/* Secondary stats & Override counter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassCard level={2} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
                  <AlertTriangle size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Slow-Moving Sluggish Stock
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Approaching non-moving inactivity threshold
                  </p>
                </div>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-slate-50">
                {formatNumber(summary.slow_moving_count ?? 0)}
              </span>
            </GlassCard>

            <GlassCard level={2} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                  <FileText size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Authorized Officer Overrides
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Items manually reclassified with audit justifications
                  </p>
                </div>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-slate-50">
                {formatNumber(summary.overridden_count ?? 0)}
              </span>
            </GlassCard>
          </div>
        </>
      )}

      {/* Statutory Classification Rules Precedence */}
      <GlassCard level={1} className="p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-forest-500/10 dark:border-forest-300/10 pb-3">
          <Archive size={18} className="text-forest-600 dark:text-forest-400" />
          <h2 className="text-sm font-bold text-forest-950 dark:text-forest-50">
            Statutory Rule Precedence Architecture (Gujarat GFR Rules)
          </h2>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          The classification engine evaluates every inventory item against category-configured lifespan parameters
          in strict order of precedence. Automated classifications serve as statutory indicators for Survey Committee
          review and do not automatically dispose of assets.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20 space-y-1.5">
            <span className="text-[10px] font-bold tracking-wider text-rose-700 dark:text-rose-400 uppercase">
              Precedence 1
            </span>
            <h4 className="text-xs font-bold text-rose-950 dark:text-rose-100">Physical Condition</h4>
            <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80 leading-normal">
              Items recorded with condition <strong>DAMAGED</strong> or <strong>SCRAP</strong> are immediately classified as <strong>OBSOLETE</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20 space-y-1.5">
            <span className="text-[10px] font-bold tracking-wider text-rose-700 dark:text-rose-400 uppercase">
              Precedence 2
            </span>
            <h4 className="text-xs font-bold text-rose-950 dark:text-rose-100">Lifespan Obsolescence</h4>
            <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80 leading-normal">
              Item age exceeds category <strong>obsolescence_years</strong> AND inactive &gt; slow-moving threshold ➔ <strong>OBSOLETE</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 space-y-1.5">
            <span className="text-[10px] font-bold tracking-wider text-amber-700 dark:text-amber-400 uppercase">
              Precedence 3
            </span>
            <h4 className="text-xs font-bold text-amber-950 dark:text-amber-100">Inactivity Threshold</h4>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-normal">
              Days without movement &gt;= category <strong>inactivity_threshold_days</strong> (e.g. 180 days) ➔ <strong>NON_MOVING</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 space-y-1.5">
            <span className="text-[10px] font-bold tracking-wider text-blue-700 dark:text-blue-400 uppercase">
              Precedence 4
            </span>
            <h4 className="text-xs font-bold text-blue-950 dark:text-blue-100">Sluggish Movement</h4>
            <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-normal">
              Days without movement &gt;= category <strong>slow_moving_threshold_days</strong> (e.g. 90 days) ➔ <strong>SLOW_MOVING</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1.5">
            <span className="text-[10px] font-bold tracking-wider text-emerald-700 dark:text-emerald-400 uppercase">
              Precedence 5
            </span>
            <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-100">Active Circulation</h4>
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 leading-normal">
              Items regularly moved, healthy stock within standard shelf-life ➔ <strong>ACTIVE</strong>.
            </p>
          </div>
        </div>

        {/* Regulatory Governance Banner */}
        <div className="p-3.5 rounded-xl bg-forest-500/10 dark:bg-forest-950/50 border border-forest-500/20 flex items-start gap-2.5 text-xs text-forest-800 dark:text-forest-200">
          <Info size={16} className="text-forest-600 dark:text-forest-400 shrink-0 mt-0.5" />
          <div>
            <strong>Legal Governance Note:</strong> Identification by the classification engine flags items for official Survey
            Committee inspection under Gujarat Panchayat Service Rules. It does not write off or authorize disposal of an asset.
            Disposal requires formal survey, DDO sanction order, and public condemnation proceedings.
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
