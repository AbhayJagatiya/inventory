import { useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  QrCode, ArrowLeft, CheckCircle, AlertTriangle, ShieldCheck,
  Clock, MapPin, Tag, RefreshCw, Send, AlertCircle, FileText,
  UserCheck, ShieldAlert, Check, X, ExternalLink
} from 'lucide-react'
import {
  getVerificationSession,
  getVerificationItems,
  getVerificationScans,
  scanItem,
  reconcileSession,
  completeVerificationSession
} from '../../api/verification.api'
import { getLocations } from '../../api/inventory.api'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import Modal from '../../components/common/Modal'
import { DataTable } from '../../components/tables/DataTable'
import ErrorState from '../../components/feedback/ErrorState'
import EmptyState from '../../components/feedback/EmptyState'
import { CardSkeleton } from '../../components/feedback/LoadingSkeleton'
import { formatNumber, formatDate, formatDateTime } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import { useLanguage } from '../../i18n'
import toast from 'react-hot-toast'

export default function VerificationSessionDetailPage() {
  const { id } = useParams()
  const { user, hasPermission } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const officeId = user?.office?.id || user?.office_id

  // Active Tab: 'SCANNER' | 'DISCREPANCIES' | 'FINALIZE'
  const [activeTab, setActiveTab] = useState('SCANNER')

  // Scanner Input State
  const [scannedBarcode, setScannedBarcode] = useState('')
  const [scannedLocationId, setScannedLocationId] = useState('')
  const [observedCondition, setObservedCondition] = useState('GOOD')
  const [scanQuantity, setScanQuantity] = useState(1)
  const [scanRemarks, setScanRemarks] = useState('')
  const [latestScanResult, setLatestScanResult] = useState(null)
  const barcodeInputRef = useRef(null)

  // Reconciliation Modal State
  const [reconcileModalItem, setReconcileModalItem] = useState(null)
  const [reconcileRemarks, setReconcileRemarks] = useState('')
  const [discrepancyFilter, setDiscrepancyFilter] = useState('ALL')

  // Finalization State
  const [completeSummary, setCompleteSummary] = useState('')
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)

  // Fetch session details
  const {
    data: sessionRes,
    isLoading: isSessionLoading,
    isError: isSessionError,
    error: sessionError,
    refetch: refetchSession,
  } = useQuery({
    queryKey: ['verification-session', id],
    queryFn: () => getVerificationSession(id),
    enabled: Boolean(id),
  })
  const session = sessionRes?.data || sessionRes

  // Fetch session snapshot items
  const {
    data: itemsRes,
    isLoading: isItemsLoading,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['verification-session-items', id],
    queryFn: () => getVerificationItems(id),
    enabled: Boolean(id),
  })
  const itemsList = itemsRes?.data || []

  // Fetch scan events log
  const {
    data: scansRes,
    isLoading: isScansLoading,
    refetch: refetchScans,
  } = useQuery({
    queryKey: ['verification-session-scans', id],
    queryFn: () => getVerificationScans(id, { limit: 50 }),
    enabled: Boolean(id),
  })
  const scansList = scansRes?.data || []

  // Fetch locations for observed location dropdown
  const { data: locationsRes } = useQuery({
    queryKey: ['locations', officeId],
    queryFn: () => getLocations(officeId ? { office_id: officeId } : {}),
  })
  const locationsList = locationsRes?.data || []

  // Auto-default scannedLocationId to session location or first room
  const effectiveLocationId =
    scannedLocationId || session?.location_id || locationsList[0]?.id || ''

  // Scan Mutation
  const scanMutation = useMutation({
    mutationFn: (payload) => scanItem(id, payload),
    onSuccess: (res) => {
      const data = res?.data || res
      setLatestScanResult(data)
      setScannedBarcode('')
      setScanRemarks('')
      queryClient.invalidateQueries({ queryKey: ['verification-session', id] })
      queryClient.invalidateQueries({ queryKey: ['verification-session-items', id] })
      queryClient.invalidateQueries({ queryKey: ['verification-session-scans', id] })

      if (data.is_duplicate_scan) {
        toast.error(t('verification.sessionDetail.toastDupScan', { msg: data.message || t('verification.sessionDetail.toastAlreadyScanned') }))
      } else if (data.discrepancy_detected && data.discrepancy_detected !== 'NONE') {
        toast(t('verification.sessionDetail.toastDiscrepancy', { type: data.discrepancy_detected }), { icon: '⚠️' })
      } else {
        toast.success(data.message || t('verification.sessionDetail.toastScanSuccess'))
      }

      if (barcodeInputRef.current) barcodeInputRef.current.focus()
    },
    onError: (err) => {
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || t('verification.sessionDetail.toastScanFail')
      toast.error(msg)
      if (barcodeInputRef.current) barcodeInputRef.current.focus()
    },
  })

  // Reconcile Mutation
  const reconcileMutation = useMutation({
    mutationFn: (payload) => reconcileSession(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-session', id] })
      queryClient.invalidateQueries({ queryKey: ['verification-session-items', id] })
      toast.success(t('verification.sessionDetail.toastResolved'))
      setReconcileModalItem(null)
      setReconcileRemarks('')
    },
    onError: (err) => {
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || t('verification.sessionDetail.toastReconcileFail')
      toast.error(msg)
    },
  })

  // Complete Session Mutation
  const completeMutation = useMutation({
    mutationFn: (payload) => completeVerificationSession(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-session', id] })
      queryClient.invalidateQueries({ queryKey: ['verification-sessions'] })
      toast.success(t('verification.sessionDetail.toastFinalized'))
      setIsCompleteModalOpen(false)
    },
    onError: (err) => {
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || t('verification.sessionDetail.toastFinalizeFail')
      toast.error(msg)
    },
  })

  const handleScanSubmit = (e) => {
    e.preventDefault()
    const clean = scannedBarcode.trim()
    if (!clean) {
      toast.error(t('verification.sessionDetail.errBarcode'))
      return
    }
    if (!effectiveLocationId) {
      toast.error(t('verification.sessionDetail.errLocation'))
      return
    }

    scanMutation.mutate({
      scanned_barcode: clean,
      scanned_location_id: effectiveLocationId,
      observed_condition: observedCondition,
      counted_quantity: Number(scanQuantity) || 1,
      remarks: scanRemarks.trim() || null,
    })
  }

  const handleReconcileSubmit = (e) => {
    e.preventDefault()
    if (!reconcileRemarks.trim() || reconcileRemarks.trim().length < 3) {
      toast.error(t('verification.sessionDetail.errReconcileRemarks'))
      return
    }

    reconcileMutation.mutate({
      resolutions: [
        {
          verification_item_id: reconcileModalItem.id,
          resolution_status: 'RESOLVED',
          remarks: reconcileRemarks.trim(),
        },
      ],
    })
  }

  const handleCompleteSubmit = (e) => {
    e.preventDefault()
    if (!completeSummary.trim() || completeSummary.trim().length < 5) {
      toast.error(t('verification.sessionDetail.errCompleteRemarks'))
      return
    }

    completeMutation.mutate({
      summary_remarks: completeSummary.trim(),
    })
  }

  // Filter items in Discrepancy Tab
  const filteredItems = itemsList.filter((item) => {
    if (discrepancyFilter === 'ALL') return true
    if (discrepancyFilter === 'DISCREPANCIES_ONLY') return item.discrepancy_type !== 'NONE'
    return item.discrepancy_type === discrepancyFilter
  })

  const isSessionClosed = session?.status === 'COMPLETED' || session?.status === 'CANCELLED'

  if (isSessionLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <PageHeader title={t('verification.sessionDetail.loadingTitle')} />
        <CardSkeleton />
      </div>
    )
  }

  if (isSessionError || !session) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <PageHeader title={t('verification.sessionDetail.defaultTitle')} />
        <ErrorState
          title={t('verification.sessionDetail.notFoundTitle')}
          message={
            sessionError?.response?.data?.error?.message ||
            sessionError?.response?.data?.detail ||
            t('verification.sessionDetail.notFoundMsg')
          }
          onRetry={refetchSession}
        />
      </div>
    )
  }

  // Progress calculations
  const expectedCount = session.total_expected_items || itemsList.length || 0
  const scannedCount = session.total_scanned_items || 0
  const discrepancyCount = session.discrepancy_count || 0
  const progressPct =
    expectedCount > 0 ? Math.min(100, Math.round((scannedCount / expectedCount) * 100)) : 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={t('verification.sessionDetail.titlePrefix', { number: session.session_number })}
        subtitle={t('verification.sessionDetail.subtitle', { scope: session.scope_type, date: formatDate(session.created_at) })}
        actions={
          <div className="flex items-center gap-3">
            <Link to={ROUTES.VERIFICATION_SESSIONS}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                {t('verification.sessionDetail.allSessions')}
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              onClick={() => {
                refetchSession()
                refetchItems()
                refetchScans()
              }}
            >
              {t('verification.sessionDetail.refresh')}
            </Button>
            {!isSessionClosed && hasPermission(PERMISSIONS.VERIFY_RECONCILE) && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<ShieldCheck size={14} />}
                onClick={() => setIsCompleteModalOpen(true)}
              >
                {t('verification.sessionDetail.finalizeAudit')}
              </Button>
            )}
          </div>
        }
      />

      {/* Audit Header Status Card */}
      <GlassCard level={1} className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-500/10 text-forest-600 dark:text-forest-300 border border-forest-500/20 flex items-center justify-center">
              <QrCode size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-slate-900 dark:text-emerald-400">
                  {session.session_number}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  {session.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {session.notes || t('verification.sessionDetail.defaultNotes')}
              </p>
            </div>
          </div>

          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
            <div>
              {t('verification.sessionDetail.started')} <strong>{session.started_at ? formatDateTime(session.started_at) : formatDate(session.created_at)}</strong>
            </div>
            {session.completed_at && (
              <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {t('verification.sessionDetail.completed')} {formatDateTime(session.completed_at)}
              </div>
            )}
          </div>
        </div>

        {/* Progress & KPI Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-emerald-500/15">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {t('verification.sessionDetail.auditProgress', { pct: progressPct })}
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {t('verification.sessionDetail.verifiedCount', { scanned: scannedCount, expected: expectedCount })}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-emerald-950/40 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15 text-xs">
            <span className="text-slate-500 dark:text-slate-400">{t('verification.sessionDetail.baselineExpected')}</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              {formatNumber(expectedCount)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15 text-xs">
            <span className="text-slate-500 dark:text-slate-400">{t('verification.sessionDetail.pendingDiscrepancies')}</span>
            <span
              className={`font-bold text-sm ${
                discrepancyCount > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {t('verification.sessionDetail.flaggedCount', { count: discrepancyCount })}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-emerald-500/20 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('SCANNER')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'SCANNER'
              ? 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <QrCode size={14} />
          {t('verification.sessionDetail.tabScanner')}
        </button>

        <button
          onClick={() => setActiveTab('DISCREPANCIES')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'DISCREPANCIES'
              ? 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <AlertTriangle size={14} />
          {t('verification.sessionDetail.tabDiscrepancies', { count: itemsList.length })}
        </button>

        <button
          onClick={() => setActiveTab('FINALIZE')}
          className={`pb-3 px-3 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'FINALIZE'
              ? 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <ShieldCheck size={14} />
          {t('verification.sessionDetail.tabFinalize')}
        </button>
      </div>

      {/* TAB 1: LIVE SCANNER */}
      {activeTab === 'SCANNER' && (
        <div className="space-y-6">
          {!isSessionClosed ? (
            <GlassCard level={1} className="p-6">
              <form onSubmit={handleScanSubmit} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-emerald-500/15 pb-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                  <QrCode size={15} className="text-emerald-600 dark:text-emerald-400" />
                  {t('verification.sessionDetail.scannerTitle')}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Barcode Input */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('verification.sessionDetail.barcodeLabel')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      autoFocus
                      value={scannedBarcode}
                      onChange={(e) => setScannedBarcode(e.target.value)}
                      placeholder={t('verification.sessionDetail.barcodePlaceholder')}
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Observed Location */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('verification.sessionDetail.observedLocation')} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={effectiveLocationId}
                      onChange={(e) => setScannedLocationId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      required
                    >
                      {locationsList.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.room_number} - {loc.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Observed Condition */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('verification.sessionDetail.observedCondition')}
                    </label>
                    <select
                      value={observedCondition}
                      onChange={(e) => setObservedCondition(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="GOOD">{t('verification.sessionDetail.condGood')}</option>
                      <option value="FAIR">{t('verification.sessionDetail.condFair')}</option>
                      <option value="DAMAGED">{t('verification.sessionDetail.condDamaged')}</option>
                      <option value="SCRAP">{t('verification.sessionDetail.condScrap')}</option>
                    </select>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('verification.sessionDetail.countedQty')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={scanQuantity}
                      onChange={(e) => setScanQuantity(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Remarks */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('verification.sessionDetail.scanRemarks')}
                    </label>
                    <input
                      type="text"
                      value={scanRemarks}
                      onChange={(e) => setScanRemarks(e.target.value)}
                      placeholder={t('verification.sessionDetail.scanRemarksPlaceholder')}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('verification.sessionDetail.enterHint')}
                  </span>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={scanMutation.isPending}
                    leftIcon={<Send size={13} />}
                  >
                    {t('verification.sessionDetail.recordScanBtn')}
                  </Button>
                </div>
              </form>
            </GlassCard>
          ) : (
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/20 text-xs text-slate-600 dark:text-slate-300">
              {t('verification.sessionDetail.closedBanner')}
            </div>
          )}

          {/* Latest Scan Event Result Feedback */}
          {latestScanResult && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                latestScanResult.is_duplicate_scan
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-200'
                  : latestScanResult.discrepancy_detected && latestScanResult.discrepancy_detected !== 'NONE'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {latestScanResult.is_duplicate_scan ? (
                  <AlertCircle size={16} />
                ) : latestScanResult.discrepancy_detected && latestScanResult.discrepancy_detected !== 'NONE' ? (
                  <AlertTriangle size={16} />
                ) : (
                  <CheckCircle size={16} />
                )}
              </div>
              <div className="space-y-0.5">
                <p className="font-bold">
                  {latestScanResult.scan_result}: {latestScanResult.item_code} – {latestScanResult.item_name}
                </p>
                <p>{latestScanResult.message}</p>
                {latestScanResult.discrepancy_detected && latestScanResult.discrepancy_detected !== 'NONE' && (
                  <p className="font-semibold text-rose-700 dark:text-rose-300">
                    {t('verification.sessionDetail.discrepancyPrefix')} {latestScanResult.discrepancy_detected}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Scans Log Table */}
          <GlassCard level={1} className="p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Clock size={14} className="text-emerald-600 dark:text-emerald-400" />
              {t('verification.sessionDetail.scanLogTitle', { count: scansList.length })}
            </h3>

            {scansList.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                {t('verification.sessionDetail.noScans')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs data-table">
                  <thead>
                    <tr>
                      <th>{t('verification.sessionDetail.colTime')}</th>
                      <th>{t('verification.sessionDetail.colBarcode')}</th>
                      <th>{t('verification.sessionDetail.colCondition')}</th>
                      <th>{t('verification.sessionDetail.colQty')}</th>
                      <th>{t('verification.sessionDetail.colScanResult')}</th>
                      <th>{t('verification.sessionDetail.colDuplicate')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scansList.map((scan) => (
                      <tr key={scan.id}>
                        <td className="font-mono text-slate-500 dark:text-slate-400">
                          {formatDateTime(scan.scanned_at)}
                        </td>
                        <td className="font-mono font-semibold text-slate-900 dark:text-emerald-400">
                          {scan.scanned_barcode}
                        </td>
                        <td>{scan.observed_condition}</td>
                        <td className="font-mono">{scan.counted_quantity}</td>
                        <td>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              scan.scan_result === 'MATCHED_VERIFIED'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {scan.scan_result}
                          </span>
                        </td>
                        <td>
                          {scan.is_duplicate_scan ? (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">{t('verification.sessionDetail.yesIgnored')}</span>
                          ) : (
                            <span className="text-slate-400">{t('verification.sessionDetail.noLabel')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* TAB 2: DISCREPANCY INVESTIGATION & RESOLUTION */}
      {activeTab === 'DISCREPANCIES' && (
        <div className="space-y-4">
          <GlassCard level={1} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-700 dark:text-slate-300">{t('verification.sessionDetail.filterByDiscrepancy')}</label>
              <select
                value={discrepancyFilter}
                onChange={(e) => setDiscrepancyFilter(e.target.value)}
                className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-2.5 py-1 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">{t('verification.sessionDetail.filterAll', { count: itemsList.length })}</option>
                <option value="DISCREPANCIES_ONLY">{t('verification.sessionDetail.filterDiscrepanciesOnly')}</option>
                <option value="NOT_FOUND">{t('verification.sessionDetail.filterNotFound')}</option>
                <option value="LOCATION_MISMATCH">{t('verification.sessionDetail.filterLocationMismatch')}</option>
                <option value="CONDITION_MISMATCH">{t('verification.sessionDetail.filterConditionMismatch')}</option>
                <option value="UNEXPECTED_ITEM">{t('verification.sessionDetail.filterUnexpected')}</option>
                <option value="NONE">{t('verification.sessionDetail.filterNone')}</option>
              </select>
            </div>

            <span className="text-slate-500 dark:text-slate-400">
              {t('verification.sessionDetail.showingItems', { shown: filteredItems.length, total: itemsList.length })}
            </span>
          </GlassCard>

          {/* Items Table */}
          {itemsList.length === 0 ? (
            <EmptyState
              title={t('verification.sessionDetail.noSnapshotTitle')}
              description={t('verification.sessionDetail.noSnapshotDesc')}
            />
          ) : (
            <div className="overflow-x-auto bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/15 overflow-hidden">
              <table className="w-full text-left text-xs data-table">
                <thead>
                  <tr>
                    <th>{t('verification.sessionDetail.colItemId')}</th>
                    <th>{t('verification.sessionDetail.colExpectedRoom')}</th>
                    <th>{t('verification.sessionDetail.colObservedRoom')}</th>
                    <th>{t('verification.sessionDetail.colExpectedCond')}</th>
                    <th>{t('verification.sessionDetail.colObservedCond')}</th>
                    <th>{t('verification.sessionDetail.colExpectedVsCounted')}</th>
                    <th>{t('verification.sessionDetail.colDiscrepancy')}</th>
                    <th>{t('verification.sessionDetail.colResolution')}</th>
                    <th className="text-right">{t('verification.sessionDetail.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const hasDiscrepancy = item.discrepancy_type !== 'NONE'
                    const isResolved = item.resolution_status === 'RESOLVED'
                    return (
                      <tr key={item.id}>
                        <td className="font-mono font-bold text-slate-900 dark:text-emerald-400">
                          {String(item.item_id).slice(0, 13)}…
                        </td>
                        <td>{String(item.expected_location_id).slice(0, 8)}…</td>
                        <td>
                          {item.observed_location_id
                            ? `${String(item.observed_location_id).slice(0, 8)}…`
                            : '—'}
                        </td>
                        <td>{item.expected_condition}</td>
                        <td>{item.observed_condition || '—'}</td>
                        <td className="font-mono">
                          {item.counted_qty} / {item.expected_qty}
                        </td>
                        <td>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              !hasDiscrepancy
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {item.discrepancy_type}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isResolved
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : hasDiscrepancy
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {item.resolution_status}
                          </span>
                        </td>
                        <td className="text-right">
                          {hasDiscrepancy && !isResolved && hasPermission(PERMISSIONS.VERIFY_RECONCILE) && (
                            <button
                              onClick={() => {
                                setReconcileModalItem(item)
                                setReconcileRemarks('')
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
                            >
                              {t('verification.sessionDetail.resolveBtn')}
                            </button>
                          )}
                          {isResolved && item.resolution_remarks && (
                            <span
                              className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[150px] inline-block"
                              title={item.resolution_remarks}
                            >
                              {item.resolution_remarks}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FINALIZE AUDIT */}
      {activeTab === 'FINALIZE' && (
        <GlassCard level={1} className="p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-emerald-500/15 pb-3">
            <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('verification.sessionDetail.finalizeTitle')}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15 space-y-1">
              <span className="text-slate-500 dark:text-slate-400">{t('verification.sessionDetail.totalInScope')}</span>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {formatNumber(expectedCount)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15 space-y-1">
              <span className="text-slate-500 dark:text-slate-400">{t('verification.sessionDetail.successfullyCounted')}</span>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatNumber(scannedCount)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15 space-y-1">
              <span className="text-slate-500 dark:text-slate-400">{t('verification.sessionDetail.pendingUnresolved')}</span>
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
                {formatNumber(discrepancyCount)}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-forest-500/10 dark:bg-forest-950/50 border border-forest-500/20 text-xs text-forest-800 dark:text-forest-200 space-y-2">
            <p className="font-bold flex items-center gap-1.5">
              <FileText size={15} /> {t('verification.sessionDetail.certTitle')}
            </p>
            <p>
              {t('verification.sessionDetail.certBody', { number: session.session_number })}
            </p>
          </div>

          {!isSessionClosed ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('verification.sessionDetail.finalRemarksLabel')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={completeSummary}
                  onChange={(e) => setCompleteSummary(e.target.value)}
                  placeholder={t('verification.sessionDetail.finalRemarksPlaceholder')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  loading={completeMutation.isPending}
                  onClick={handleCompleteSubmit}
                  leftIcon={<CheckCircle size={14} />}
                >
                  {t('verification.sessionDetail.signFinalizeBtn')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-200 font-semibold">
              {t('verification.sessionDetail.closedStatus', { date: formatDateTime(session.completed_at) })}
            </div>
          )}
        </GlassCard>
      )}

      {/* Discrepancy Resolution Modal */}
      {reconcileModalItem && (
        <Modal
          isOpen={Boolean(reconcileModalItem)}
          onClose={() => setReconcileModalItem(null)}
          title={t('verification.sessionDetail.reconcileModalTitle')}
          size="md"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setReconcileModalItem(null)}
              >
                {t('transactions.transfers.create.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={reconcileMutation.isPending}
                onClick={handleReconcileSubmit}
              >
                {t('verification.sessionDetail.saveResolution')}
              </Button>
            </>
          }
        >
          <form onSubmit={handleReconcileSubmit} className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-900 dark:text-emerald-400">
                  {t('verification.sessionDetail.itemIdLabel')} {String(reconcileModalItem.item_id).slice(0, 16)}…
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400">
                  {reconcileModalItem.discrepancy_type}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <div>{t('verification.sessionDetail.expectedRoomLabel')} <strong>{String(reconcileModalItem.expected_location_id).slice(0, 8)}</strong></div>
                <div>{t('verification.sessionDetail.observedRoomLabel')} <strong>{String(reconcileModalItem.observed_location_id || '—').slice(0, 8)}</strong></div>
                <div>{t('verification.sessionDetail.expectedCondLabel')} <strong>{reconcileModalItem.expected_condition}</strong></div>
                <div>{t('verification.sessionDetail.observedCondLabel')} <strong>{reconcileModalItem.observed_condition || '—'}</strong></div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('verification.sessionDetail.resolutionRemarksLabel')} <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={reconcileRemarks}
                onChange={(e) => setReconcileRemarks(e.target.value)}
                placeholder={t('verification.sessionDetail.resolutionPlaceholder')}
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Confirmation Modal for Finalize */}
      {isCompleteModalOpen && (
        <Modal
          isOpen={isCompleteModalOpen}
          onClose={() => setIsCompleteModalOpen(false)}
          title={t('verification.sessionDetail.completeModalTitle')}
          size="md"
          footer={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsCompleteModalOpen(false)}
              >
                {t('transactions.transfers.create.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={completeMutation.isPending}
                onClick={handleCompleteSubmit}
              >
                {t('verification.sessionDetail.confirmSealBtn')}
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-700 dark:text-slate-300">
              {t('verification.sessionDetail.confirmFinalizeMsg', { number: session.session_number })}
            </p>
            {discrepancyCount > 0 && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-200">
                <strong>{t('verification.sessionDetail.warningLabel')}</strong>{' '}
                {t('verification.sessionDetail.unresolvedWarning', { count: discrepancyCount })}
              </div>
            )}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('verification.sessionDetail.concludingRemarks')} <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={completeSummary}
                onChange={(e) => setCompleteSummary(e.target.value)}
                placeholder={t('verification.sessionDetail.concludingPlaceholder')}
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
