import { useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  QrCode, ArrowLeft, CheckCircle, AlertTriangle, ShieldCheck,
  Clock, MapPin, Tag, RefreshCw, Send, AlertCircle, FileText,
  Camera, Keyboard, Search, Download, Printer, UserCheck, Zap
} from 'lucide-react'
import {
  getVerificationSession,
  getVerificationItems,
  getVerificationScans,
  lookupBarcode,
  scanItem,
  reconcileSession,
  completeVerificationSession,
  downloadVerificationReport
} from '../../api/verification.api'
import { getLocations } from '../../api/inventory.api'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import Modal from '../../components/common/Modal'
import StatusBadge from '../../components/common/StatusBadge'
import QrCameraScanner from '../../components/verification/QrCameraScanner'
import ErrorState from '../../components/feedback/ErrorState'
import EmptyState from '../../components/feedback/EmptyState'
import { CardSkeleton } from '../../components/feedback/LoadingSkeleton'
import { formatNumber, formatDate, formatDateTime } from '../../utils/formatters'
import { ROUTES } from '../../constants/routes'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import toast from 'react-hot-toast'
import { useLanguage } from '../../i18n'
import { translateEnum, translateMasterName } from '../../i18n/enumLabels'

export default function VerificationSessionDetailPage() {
  const { id } = useParams()
  const { user, hasPermission } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const officeId = user?.office?.id || user?.office_id

  const conditionOptions = [
    { value: 'NEW', label: t('verification.sessionDetail.condNew') },
    { value: 'GOOD', label: t('verification.sessionDetail.condGood') },
    { value: 'FAIR', label: t('verification.sessionDetail.condFair') },
    { value: 'POOR', label: t('verification.sessionDetail.condPoor') },
    { value: 'DAMAGED', label: t('verification.sessionDetail.condDamaged') },
    { value: 'SCRAP', label: t('verification.sessionDetail.condScrap') },
  ]

  // Active Tab: 'SCANNER' | 'DISCREPANCIES' | 'FINALIZE'
  const [activeTab, setActiveTab] = useState('SCANNER')

  // Input Mode & Guided vs Rapid mode
  const [inputMode, setInputMode] = useState('MANUAL') // 'MANUAL' | 'CAMERA'
  const [rapidMode, setRapidMode] = useState(false)

  // Scanner Input & Guided Preview State
  const [scannedBarcode, setScannedBarcode] = useState('')
  const [previewedAsset, setPreviewedAsset] = useState(null)
  const [previewLookupError, setPreviewLookupError] = useState('')
  const [scannedLocationId, setScannedLocationId] = useState('')
  const [observedCondition, setObservedCondition] = useState('GOOD')
  const [scanQuantity, setScanQuantity] = useState(1)
  const [scanRemarks, setScanRemarks] = useState('')
  const [latestScanResult, setLatestScanResult] = useState(null)
  const barcodeInputRef = useRef(null)

  // Reconciliation Modal State
  const [reconcileModalItem, setReconcileModalItem] = useState(null)
  const [reconcileStatusChoice, setReconcileStatusChoice] = useState('RESOLVED')
  const [reconcileRemarks, setReconcileRemarks] = useState('')
  const [discrepancyFilter, setDiscrepancyFilter] = useState('ALL')
  const [itemSearch, setItemSearch] = useState('')

  // Finalization & Download State
  const [completeSummary, setCompleteSummary] = useState('')
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
  const [isDownloadingReport, setIsDownloadingReport] = useState(false)

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
  const { data: itemsRes, refetch: refetchItems } = useQuery({
    queryKey: ['verification-session-items', id],
    queryFn: () => getVerificationItems(id),
    enabled: Boolean(id),
  })
  const itemsList = itemsRes?.data || []

  // Fetch scan events log
  const { data: scansRes, refetch: refetchScans } = useQuery({
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

  const effectiveLocationId =
    scannedLocationId || previewedAsset?.location_id || session?.location_id || locationsList[0]?.id || ''

  // Asset Lookup Mutation (Step 1 of Guided Audit Flow)
  const lookupMutation = useMutation({
    mutationFn: (barcode) => lookupBarcode({ barcode }),
    onSuccess: (res) => {
      const asset = res?.data || res
      setPreviewLookupError('')
      setPreviewedAsset(asset)
      setObservedCondition(asset.condition || 'GOOD')
      setScannedLocationId(session?.location_id || asset.location_id || locationsList[0]?.id || '')
      setScanQuantity(asset.item_type === 'DURABLE_ASSET' ? 1 : (asset.available_qty || 1))
      toast.success(t('verification.lookup.toastFound', { name: asset.item_code || asset.item_name }))
    },
    onError: (err, queriedCode) => {
      setPreviewedAsset(null)
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        t('verification.sessionDetail.errAssetNotFound', { code: queriedCode })
      setPreviewLookupError(msg)
      toast.error(msg)
    },
  })

  // Scan Mutation (Step 2 — Submit Verification & Option B live update)
  const scanMutation = useMutation({
    mutationFn: (payload) => scanItem(id, payload),
    onSuccess: (res) => {
      const data = res?.data || res
      setLatestScanResult(data)
      setScannedBarcode('')
      setPreviewedAsset(null)
      setPreviewLookupError('')
      setScanRemarks('')
      queryClient.invalidateQueries({ queryKey: ['verification-session', id] })
      queryClient.invalidateQueries({ queryKey: ['verification-session-items', id] })
      queryClient.invalidateQueries({ queryKey: ['verification-session-scans', id] })
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['item'] })
      queryClient.invalidateQueries({ queryKey: ['item-history'] })

      if (data.is_duplicate_scan) {
        toast.error(t('verification.sessionDetail.toastDupScan', { msg: data.message }))
      } else if (data.item_updated) {
        toast.success(data.message || t('verification.sessionDetail.toastScanSuccess'))
      } else if (data.discrepancy_detected && data.discrepancy_detected !== 'NONE') {
        toast(
          t('verification.sessionDetail.toastDiscrepancy', {
            type: translateEnum(t, data.discrepancy_detected),
          }),
          { icon: '⚠️' }
        )
      } else {
        toast.success(data.message || t('verification.sessionDetail.toastScanSuccess'))
      }

      if (barcodeInputRef.current && inputMode === 'MANUAL') {
        barcodeInputRef.current.focus()
      }
    },
    onError: (err) => {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        t('verification.sessionDetail.toastScanFail')
      toast.error(msg)
      if (barcodeInputRef.current && inputMode === 'MANUAL') {
        barcodeInputRef.current.focus()
      }
    },
  })

  // Reconcile Mutation
  const reconcileMutation = useMutation({
    mutationFn: (payload) => reconcileSession(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-session', id] })
      queryClient.invalidateQueries({ queryKey: ['verification-session-items', id] })
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['item'] })
      queryClient.invalidateQueries({ queryKey: ['item-history'] })
      toast.success(t('verification.sessionDetail.toastResolved'))
      setReconcileModalItem(null)
      setReconcileRemarks('')
    },
    onError: (err) => {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        t('verification.sessionDetail.toastReconcileFail')
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
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        t('verification.sessionDetail.toastFinalizeFail')
      toast.error(msg)
    },
  })

  const submitScanDirectly = (codeOverride) => {
    const clean = (codeOverride ?? scannedBarcode).trim()
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
      device_info: inputMode === 'CAMERA' ? 'Web Camera QR Scanner' : 'Manual / Optical Gun',
      remarks: scanRemarks.trim() || null,
    })
  }

  const handleCodeDetected = (decodedCode) => {
    const clean = (decodedCode || '').trim()
    if (!clean) return
    setScannedBarcode(clean)
    if (rapidMode) {
      submitScanDirectly(clean)
    } else {
      lookupMutation.mutate(clean)
    }
  }

  const handleFindAsset = (e) => {
    e.preventDefault()
    handleCodeDetected(scannedBarcode)
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
          resolution_status: reconcileStatusChoice,
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

  const handleDownloadReport = async () => {
    try {
      setIsDownloadingReport(true)
      const res = await downloadVerificationReport(id)
      const url = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `verification-report-${session?.session_number || id}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success(t('verification.sessionDetail.exportSuccess'))
    } catch {
      toast.error(t('verification.sessionDetail.exportError'))
    } finally {
      setIsDownloadingReport(false)
    }
  }

  // Snapshot check for previewed asset
  const previewSnapshotMatch = previewedAsset
    ? itemsList.find((it) => it.item_id === previewedAsset.item_id)
    : null

  // Filter items in Discrepancy / Checklist Tab
  const filteredItems = itemsList.filter((item) => {
    const matchesDiscrepancy =
      discrepancyFilter === 'ALL'
        ? true
        : discrepancyFilter === 'DISCREPANCIES_ONLY'
        ? item.discrepancy_type !== 'NONE'
        : item.discrepancy_type === discrepancyFilter

    if (!matchesDiscrepancy) return false
    if (!itemSearch.trim()) return true
    const q = itemSearch.toLowerCase().trim()
    return (
      item.item_code?.toLowerCase().includes(q) ||
      item.item_name?.toLowerCase().includes(q) ||
      item.barcode_number?.toLowerCase().includes(q) ||
      item.expected_location_name?.toLowerCase().includes(q)
    )
  })

  const isSessionClosed = session?.status === 'COMPLETED' || session?.status === 'CANCELLED'
  const canScan = !isSessionClosed && hasPermission(PERMISSIONS.VERIFY_SCAN)

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

  const expectedCount = session.total_expected_items || itemsList.length || 0
  const scannedCount = session.total_scanned_items || 0
  const discrepancyCount = session.discrepancy_count || 0
  const progressPct =
    expectedCount > 0 ? Math.min(100, Math.round((scannedCount / expectedCount) * 100)) : 0

  const translatedScope = `${translateEnum(t, session.scope_type)}${
    session.location_name
      ? ` (${session.location_name})`
      : session.category_name
      ? ` (${translateMasterName(t, 'category', session.category_code, session.category_name)})`
      : ''
  }`

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={t('verification.sessionDetail.titlePrefix', { number: session.session_number })}
        subtitle={t('verification.sessionDetail.subtitle', {
          scope: translatedScope,
          date: formatDate(session.created_at),
        })}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
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
            <Button
              variant="secondary"
              size="sm"
              loading={isDownloadingReport}
              leftIcon={<Download size={14} />}
              onClick={handleDownloadReport}
            >
              {t('verification.sessionDetail.exportCsv')}
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-base font-bold text-slate-900 dark:text-emerald-400">
                  {session.session_number}
                </span>
                <StatusBadge status={session.status} size="xs" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {session.notes || t('verification.sessionDetail.defaultNotes')}
              </p>
            </div>
          </div>

          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
            <div>
              {t('verification.sessionDetail.leadVerifierLabel')}{' '}
              <strong>{session.lead_verifier_name || t('auditEvents.loggedByFallback')}</strong>
            </div>
            <div>
              {t('verification.sessionDetail.started')}{' '}
              <strong>{session.started_at ? formatDateTime(session.started_at) : formatDate(session.created_at)}</strong>
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
            <span className="text-slate-500 dark:text-slate-400">
              {t('verification.sessionDetail.baselineExpected')}
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              {formatNumber(expectedCount)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              {t('verification.sessionDetail.pendingFlagsLabel')}
            </span>
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
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-emerald-500/20 text-xs font-semibold">
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
          {canScan ? (
            <GlassCard level={1} className="p-6 space-y-5">
              {/* Top Controls: Manual vs Camera + Guided vs Rapid */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-emerald-500/15 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={inputMode === 'MANUAL' ? 'primary' : 'secondary'}
                    size="xs"
                    leftIcon={<Keyboard size={13} />}
                    onClick={() => setInputMode('MANUAL')}
                  >
                    {t('verification.lookup.manualModeBtn')}
                  </Button>
                  <Button
                    type="button"
                    variant={inputMode === 'CAMERA' ? 'primary' : 'secondary'}
                    size="xs"
                    leftIcon={<Camera size={13} />}
                    onClick={() => setInputMode('CAMERA')}
                  >
                    {t('verification.sessionDetail.scanWithCamera')}
                  </Button>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rapidMode}
                    onChange={(e) => {
                      setRapidMode(e.target.checked)
                      setPreviewedAsset(null)
                      setPreviewLookupError('')
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <Zap size={13} className="text-amber-500" />
                  {rapidMode
                    ? t('verification.sessionDetail.modeRapid')
                    : t('verification.sessionDetail.modeGuided')}
                </label>
              </div>

              {/* Step 1: Identify Asset (Manual or Camera) */}
              <form onSubmit={handleFindAsset} className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('verification.sessionDetail.step1Title')} <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 min-w-[240px]">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                      <QrCode size={16} />
                    </div>
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      autoFocus={inputMode === 'MANUAL'}
                      value={scannedBarcode}
                      onChange={(e) => setScannedBarcode(e.target.value)}
                      placeholder={t('verification.sessionDetail.barcodePlaceholder')}
                      className="w-full pl-9 pr-3 py-2.5 text-sm font-mono bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant={rapidMode ? 'primary' : 'secondary'}
                    size="sm"
                    loading={lookupMutation.isPending || (rapidMode && scanMutation.isPending)}
                    leftIcon={rapidMode ? <Send size={13} /> : <Search size={13} />}
                  >
                    {rapidMode
                      ? t('verification.sessionDetail.rapidSubmitBtn')
                      : lookupMutation.isPending
                      ? t('verification.sessionDetail.lookingUp')
                      : t('verification.sessionDetail.lookupBtn')}
                  </Button>
                </div>
              </form>

              {inputMode === 'CAMERA' && (
                <QrCameraScanner
                  autoStart
                  compact
                  label={t('verification.lookup.cameraScannerLabel')}
                  onScanSuccess={(decodedCode) => handleCodeDetected(decodedCode)}
                  onError={(msg) => toast.error(msg)}
                />
              )}

              {/* Step 2: Asset Preview Banner (when in Guided Mode) */}
              {!rapidMode && previewedAsset && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-extrabold text-emerald-800 dark:text-emerald-300">
                          {previewedAsset.item_code}
                        </span>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/80 dark:bg-[#0A1513] text-slate-700 dark:text-emerald-300 border border-emerald-500/20">
                          {previewedAsset.barcode_number}
                        </span>
                        <StatusBadge status={previewedAsset.condition} size="xs" />
                        <StatusBadge status={previewedAsset.operational_status} size="xs" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                        {previewedAsset.item_name}
                      </h4>
                    </div>

                    {previewSnapshotMatch ? (
                      previewSnapshotMatch.counted_qty > 0 ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25">
                          {t('verification.sessionDetail.alreadyAuditedTag')}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                          {t('verification.sessionDetail.scopeExpectedTag')}
                        </span>
                      )
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                        {t('verification.sessionDetail.scopeUnexpectedTag')}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={13} className="text-emerald-600 dark:text-emerald-400" />
                      <span>
                        {t('verification.sessionDetail.expectedRoomTag', {
                          room: previewedAsset.location_name || t('inventory.detail.notAssigned'),
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <UserCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                      <span>
                        {t('verification.sessionDetail.custodianLabel')}{' '}
                        <strong>{previewedAsset.current_custodian || t('verification.lookup.storeCustody')}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Tag size={13} className="text-emerald-600 dark:text-emerald-400" />
                      <span>
                        {t('verification.sessionDetail.categoryLabel')}{' '}
                        <strong>
                          {translateMasterName(t, 'category', previewedAsset.category_code, previewedAsset.category_name)}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!rapidMode && previewLookupError && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>{previewLookupError}</span>
                </div>
              )}

              {/* Step 3: Physical Check & Live Update Form */}
              {(rapidMode || previewedAsset || previewLookupError) && (
                <div className="pt-3 border-t border-slate-100 dark:border-emerald-500/15 space-y-4">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {t('verification.sessionDetail.step2Title')}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                            {loc.building_name} - {loc.room_number}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {t('verification.sessionDetail.observedCondition')}
                      </label>
                      <select
                        value={observedCondition}
                        onChange={(e) => setObservedCondition(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        {conditionOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

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
                  </div>

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
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {t('verification.sessionDetail.lastUpdatedSummary')}
                    </p>
                  </div>

                  {!rapidMode && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setPreviewedAsset(null)
                          setPreviewLookupError('')
                          setScannedBarcode('')
                        }}
                      >
                        {t('verification.sessionDetail.clearSelection')}
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        loading={scanMutation.isPending}
                        leftIcon={<Send size={13} />}
                        onClick={() => submitScanDirectly()}
                      >
                        {t('verification.sessionDetail.submitUpdateBtn')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </GlassCard>
          ) : (
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/20 text-xs text-slate-600 dark:text-slate-300">
              {isSessionClosed
                ? t('verification.sessionDetail.closedBanner')
                : t('verification.sessionDetail.viewOnlyBanner')}
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
                  {translateEnum(t, latestScanResult.scan_result)}:{' '}
                  {latestScanResult.item_code || t('verification.sessionDetail.unregistered')}{' '}
                  {latestScanResult.item_name ? `– ${latestScanResult.item_name}` : ''}
                </p>
                <p>{latestScanResult.message}</p>
                {latestScanResult.item_updated && (
                  <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                    {t('verification.sessionDetail.masterUpdatedNotice', {
                      fields: (latestScanResult.updated_fields || []).join(', '),
                    })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Scans Log Table */}
          <GlassCard level={1} className="p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Clock size={14} className="text-emerald-600 dark:text-emerald-400" />
              {t('verification.sessionDetail.scanLogHeading', { count: scansList.length })}
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
                      <th>{t('verification.sessionDetail.colItem')}</th>
                      <th>{t('verification.sessionDetail.colObservedRoom')}</th>
                      <th>{t('verification.sessionDetail.colCondition')}</th>
                      <th>{t('verification.sessionDetail.colQty')}</th>
                      <th>{t('verification.sessionDetail.colScanResult')}</th>
                      <th>{t('verification.sessionDetail.colScannedBy')}</th>
                      <th>{t('verification.sessionDetail.colDuplicate')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scansList.map((scan) => (
                      <tr key={scan.id}>
                        <td className="font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDateTime(scan.scanned_at)}
                        </td>
                        <td>
                          <div className="font-mono font-semibold text-slate-900 dark:text-emerald-400">
                            {scan.item_code || scan.scanned_barcode}
                          </div>
                          {scan.item_name && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {scan.item_name}
                            </div>
                          )}
                        </td>
                        <td>{scan.scanned_location_name || '—'}</td>
                        <td>
                          {scan.observed_condition ? (
                            <StatusBadge status={scan.observed_condition} size="xs" />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="font-mono">{scan.counted_quantity}</td>
                        <td>
                          <StatusBadge status={scan.scan_result} size="xs" />
                        </td>
                        <td>{scan.scanned_by_name || '—'}</td>
                        <td>
                          {scan.is_duplicate_scan ? (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">
                              {t('verification.sessionDetail.yesLabel')}
                            </span>
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

      {/* TAB 2: ASSET CHECKLIST & DISCREPANCY INVESTIGATION */}
      {activeTab === 'DISCREPANCIES' && (
        <div className="space-y-4">
          <GlassCard level={1} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder={t('verification.sessionDetail.searchItemsPlaceholder')}
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {t('verification.sessionDetail.filterByDiscrepancy')}
                </label>
                <select
                  value={discrepancyFilter}
                  onChange={(e) => setDiscrepancyFilter(e.target.value)}
                  className="bg-white dark:bg-[#0A1513] border border-slate-300 dark:border-emerald-500/25 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
            </div>

            <span className="text-slate-500 dark:text-slate-400">
              {t('verification.sessionDetail.showingItems', {
                shown: filteredItems.length,
                total: itemsList.length,
              })}
            </span>
          </GlassCard>

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
                    <th>{t('verification.sessionDetail.colItem')}</th>
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
                    const isReviewed = item.resolution_status === 'RESOLVED' || item.resolution_status === 'IGNORED'
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="font-mono font-bold text-slate-900 dark:text-emerald-400">
                            {item.item_code || String(item.item_id).slice(0, 12)}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300">
                            {item.item_name || '—'}
                          </div>
                        </td>
                        <td>{item.expected_location_name || '—'}</td>
                        <td>{item.observed_location_name || '—'}</td>
                        <td>
                          {item.expected_condition ? <StatusBadge status={item.expected_condition} size="xs" /> : '—'}
                        </td>
                        <td>
                          {item.observed_condition ? <StatusBadge status={item.observed_condition} size="xs" /> : '—'}
                        </td>
                        <td className="font-mono">
                          {item.counted_qty} / {item.expected_qty}
                        </td>
                        <td>
                          <StatusBadge status={item.discrepancy_type} size="xs" />
                        </td>
                        <td>
                          <StatusBadge status={item.resolution_status} size="xs" />
                        </td>
                        <td className="text-right space-x-2">
                          {canScan && item.counted_qty === 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('SCANNER')
                                setRapidMode(false)
                                handleCodeDetected(item.barcode_number || item.item_code)
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                            >
                              {t('verification.sessionDetail.verifyNowBtn')}
                            </button>
                          )}
                          {hasDiscrepancy && !isReviewed && !isSessionClosed && hasPermission(PERMISSIONS.VERIFY_RECONCILE) && (
                            <button
                              type="button"
                              onClick={() => {
                                setReconcileModalItem(item)
                                setReconcileStatusChoice('RESOLVED')
                                setReconcileRemarks('')
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
                            >
                              {t('verification.sessionDetail.resolveBtn')}
                            </button>
                          )}
                          {isReviewed && item.resolution_remarks && (
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-emerald-500/15 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('verification.sessionDetail.finalizeTitle')}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="xs"
                loading={isDownloadingReport}
                leftIcon={<Download size={13} />}
                onClick={handleDownloadReport}
              >
                {t('verification.sessionDetail.exportCsv')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                leftIcon={<Printer size={13} />}
                onClick={() => window.print()}
              >
                {t('verification.sessionDetail.printSummaryBtn')}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15 space-y-1">
              <span className="text-slate-500 dark:text-slate-400">
                {t('verification.sessionDetail.totalInScope')}
              </span>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {formatNumber(expectedCount)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15 space-y-1">
              <span className="text-slate-500 dark:text-slate-400">
                {t('verification.sessionDetail.successfullyCounted')}
              </span>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatNumber(scannedCount)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15 space-y-1">
              <span className="text-slate-500 dark:text-slate-400">
                {t('verification.sessionDetail.pendingUnresolved')}
              </span>
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
            hasPermission(PERMISSIONS.VERIFY_RECONCILE) ? (
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
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('verification.sessionDetail.officerRequiredNote')}
              </p>
            )
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
                {t('actions.cancel')}
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
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1513] border border-slate-200 dark:border-emerald-500/15 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-slate-900 dark:text-emerald-400 block">
                    {reconcileModalItem.item_code || String(reconcileModalItem.item_id).slice(0, 16)}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {reconcileModalItem.item_name}
                  </span>
                </div>
                <StatusBadge status={reconcileModalItem.discrepancy_type} size="xs" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <div>
                  {t('verification.sessionDetail.expectedRoomLabel')}{' '}
                  <strong>{reconcileModalItem.expected_location_name || '—'}</strong>
                </div>
                <div>
                  {t('verification.sessionDetail.observedRoomLabel')}{' '}
                  <strong>{reconcileModalItem.observed_location_name || '—'}</strong>
                </div>
                <div>
                  {t('verification.sessionDetail.expectedCondLabel')}{' '}
                  <strong>{translateEnum(t, reconcileModalItem.expected_condition)}</strong>
                </div>
                <div>
                  {t('verification.sessionDetail.observedCondLabel')}{' '}
                  <strong>
                    {reconcileModalItem.observed_condition
                      ? translateEnum(t, reconcileModalItem.observed_condition)
                      : '—'}
                  </strong>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('verification.sessionDetail.reviewDecisionLabel')} <span className="text-red-500">*</span>
              </label>
              <select
                value={reconcileStatusChoice}
                onChange={(e) => setReconcileStatusChoice(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="RESOLVED">{t('verification.sessionDetail.optResolved')}</option>
                <option value="IGNORED">{t('verification.sessionDetail.optIgnored')}</option>
              </select>
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
                {t('actions.cancel')}
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
