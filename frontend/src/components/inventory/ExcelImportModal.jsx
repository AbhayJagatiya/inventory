import { useState, useRef } from 'react'
import {
  Upload, Download, CheckCircle2, AlertTriangle,
  XCircle, ArrowRight, HelpCircle
} from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { bulkImportItems } from '../../api/inventory.api'
import { extractApiError } from '../../api/client'
import { useLanguage } from '../../i18n'
import { translateEnum } from '../../i18n/enumLabels'
import toast from 'react-hot-toast'

// Standard CSV template columns
const TEMPLATE_HEADERS = [
  'item_name',
  'item_type',
  'category_code',
  'room_number',
  'quantity',
  'uom',
  'unit_purchase_cost',
  'purchase_date',
  'condition',
  'brand',
  'model_number',
  'serial_number',
  'invoice_number',
  'current_custodian',
]

const SAMPLE_CSV_ROWS = [
  'HP LaserJet Pro 4104dw,DURABLE_ASSET,IT_EQUIPMENT,Room 102,1,NOS,38500,2024-03-15,GOOD,HP,MFP 4104dw,VNB3K94029,INV-2024-89,Store Section',
  'JK Copier A4 Paper,CONSUMABLE_STOCK,OFFICE_STATIONERY,Room 102,50,PACKET,285,2026-09-01,GOOD,JK Paper,75 GSM,,INV-2026-44,Store Section',
  'Godrej Steel Almirah,DURABLE_ASSET,OFFICE_FURNITURE,Room 102,1,NOS,21500,2020-02-14,FAIR,Godrej,Storewel,GDJ-2020-992,INV-GDJ-044,Store Section',
]

export function ExcelImportModal({ isOpen, onClose, onSuccess }) {
  const { t } = useLanguage()
  const [activeStep, setActiveStep] = useState(1) // 1: Upload, 2: Preview & Validation
  const [file, setFile] = useState(null)
  const [parsedRows, setParsedRows] = useState([])
  const [validationErrors, setValidationErrors] = useState([])
  const [isValidating, setIsValidating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef(null)

  const handleReset = () => {
    setActiveStep(1)
    setFile(null)
    setParsedRows([])
    setValidationErrors([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Download standard CSV template
  const handleDownloadTemplate = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [TEMPLATE_HEADERS.join(','), ...SAMPLE_CSV_ROWS].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'dsims_inventory_import_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(t('inventory.importModal.templateDownloaded'))
  }

  // Validate CSV/XLSX against real backend dry-run
  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setFile(selectedFile)
    setIsValidating(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('dry_run', 'true')

      const res = await bulkImportItems(formData)
      const result = res?.data || res
      const preview = result?.preview || []

      if (preview.length === 0) {
        toast.error(t('inventory.importModal.noDataRows'))
        setIsValidating(false)
        return
      }

      const rows = preview.map((p) => ({
        rowNumber: p.row,
        data: {
          item_name: p.item_name,
          item_type: p.item_type,
          serial_number: p.serial_number,
        },
        errors: p.errors || [],
        isValid: Boolean(p.is_valid),
      }))

      const errs = rows.filter((r) => !r.isValid)
      setParsedRows(rows)
      setValidationErrors(errs)
      setActiveStep(2)
    } catch (err) {
      toast.error(extractApiError(err) || t('inventory.importModal.parseError'))
    } finally {
      setIsValidating(false)
    }
  }

  // Download error report
  const handleDownloadErrorReport = () => {
    if (validationErrors.length === 0) return
    const errorHeaders = ['Row_Number', 'Item_Name', 'Serial_Number', 'Errors']
    const errorRows = validationErrors.map((err) =>
      [
        err.rowNumber,
        `"${err.data.item_name || ''}"`,
        `"${err.data.serial_number || ''}"`,
        `"${err.errors.join('; ')}"`,
      ].join(',')
    )
    const csvContent =
      'data:text/csv;charset=utf-8,' + [errorHeaders.join(','), ...errorRows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `dsims_import_errors_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Execute Real Database Import
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid)
    if (validRows.length === 0) {
      toast.error(t('inventory.importModal.noValidRows'))
      return
    }

    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('dry_run', 'false')

      const res = await bulkImportItems(formData)
      const result = res?.data || res
      const importedCount = result?.rows_imported ?? result?.imported ?? validRows.length
      toast.success(t('inventory.importModal.importSuccessCount', { count: importedCount }))
      if (onSuccess) onSuccess()
      handleReset()
      onClose()
    } catch (err) {
      toast.error(extractApiError(err) || t('inventory.importModal.importFail'))
    } finally {
      setIsImporting(false)
    }
  }

  const validCount = parsedRows.filter((r) => r.isValid).length
  const errorCount = validationErrors.length

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        handleReset()
        onClose()
      }}
      title={t('inventory.importModal.modalTitle')}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {activeStep === 2 && (
              <Button variant="secondary" size="sm" onClick={handleReset} disabled={isImporting}>
                {t('inventory.importModal.chooseAnother')}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                handleReset()
                onClose()
              }}
              disabled={isImporting}
            >
              {t('actions.cancel')}
            </Button>
            {activeStep === 2 && (
              <Button
                variant="primary"
                onClick={handleExecuteImport}
                isLoading={isImporting}
                disabled={validCount === 0}
              >
                {t('inventory.importModal.confirmImport', { count: validCount })}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* Step Tabs Header */}
      <div className="flex items-center justify-between mb-5 border-b border-slate-200 dark:border-emerald-500/20 pb-3">
        <div className="flex items-center gap-3 text-xs font-medium">
          <span
            className={`px-3 py-1 rounded-full ${
              activeStep === 1
                ? 'bg-emerald-600 text-white font-semibold'
                : 'bg-slate-100 dark:bg-[#081210] text-slate-600 dark:text-slate-400'
            }`}
          >
            1. {t('inventory.import.uploadFile')}
          </span>
          <ArrowRight size={12} className="text-slate-400" />
          <span
            className={`px-3 py-1 rounded-full ${
              activeStep === 2
                ? 'bg-emerald-600 text-white font-semibold'
                : 'bg-slate-100 dark:bg-[#081210] text-slate-600 dark:text-slate-400'
            }`}
          >
            2. {t('inventory.import.preview')}
          </span>
        </div>

        <Button
          variant="secondary"
          size="xs"
          leftIcon={<Download size={13} />}
          onClick={handleDownloadTemplate}
        >
          {t('inventory.importModal.downloadCsvTemplate')}
        </Button>
      </div>

      {/* Step 1: Upload Zone */}
      {activeStep === 1 && (
        <div className="space-y-6">
          <div
            onClick={() => !isValidating && fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-emerald-500/30 hover:border-emerald-500 bg-slate-50/70 dark:bg-[#081210] hover:bg-emerald-50/20 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mb-3">
              <Upload size={24} />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">
              {isValidating
                ? t('inventory.importModal.validatingFile')
                : t('inventory.importModal.clickToSelect')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('inventory.importModal.supportedExt')}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Guidelines Box */}
          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs text-slate-700 dark:text-slate-300 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200">
              <HelpCircle size={15} />
              <span>{t('inventory.importModal.guidelinesTitle')}</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300 leading-relaxed">
              <li>
                <strong>{t('inventory.importModal.guideline1Label')}</strong> {t('inventory.importModal.guideline1Body')}
              </li>
              <li>
                <strong>{t('inventory.importModal.guideline2Label')}</strong> {t('inventory.importModal.guideline2Body')}
              </li>
              <li>
                <strong>{t('inventory.importModal.guideline3Label')}</strong> {t('inventory.importModal.guideline3Body')}
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 2: Validation Preview */}
      {activeStep === 2 && (
        <div className="space-y-4">
          {/* Summary Badges */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-[#081210] rounded-xl border border-slate-200 dark:border-emerald-500/20 text-center">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                {t('inventory.importModal.totalAnalyzed')}
              </span>
              <span className="text-lg font-bold text-slate-800 dark:text-white block">{parsedRows.length}</span>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 text-center">
              <span className="text-xs text-emerald-700 dark:text-emerald-300 block">
                {t('inventory.importModal.validReady')}
              </span>
              <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 block">{validCount}</span>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-500/20 text-center">
              <span className="text-xs text-rose-700 dark:text-rose-400 block">
                {t('inventory.importModal.rowsWithIssues')}
              </span>
              <span className="text-lg font-bold text-rose-700 dark:text-rose-400 block">{errorCount}</span>
            </div>
          </div>

          {/* Action Row for Error Report */}
          {errorCount > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-500/30 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  {t('inventory.importModal.validationSummary', { errors: errorCount, valid: validCount })}
                </span>
              </div>
              <Button
                variant="secondary"
                size="xs"
                leftIcon={<Download size={13} />}
                onClick={handleDownloadErrorReport}
              >
                {t('inventory.importModal.downloadErrorReport')}
              </Button>
            </div>
          )}

          {/* Preview Table */}
          <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-emerald-500/20 rounded-xl scrollbar-thin">
            <table className="w-full text-left text-xs data-table">
              <thead>
                <tr>
                  <th className="w-12">{t('inventory.importModal.colRow')}</th>
                  <th>{t('inventory.importModal.colStatus')}</th>
                  <th>{t('inventory.importModal.colItemDesc')}</th>
                  <th>{t('inventory.importModal.colType')}</th>
                  <th>{t('inventory.importModal.colSerial')}</th>
                  <th>{t('inventory.importModal.colResult')}</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((r) => (
                  <tr key={r.rowNumber} className={r.isValid ? '' : 'bg-rose-50/30 dark:bg-rose-950/20'}>
                    <td className="font-mono text-slate-500 dark:text-slate-400">{r.rowNumber}</td>
                    <td>
                      {r.isValid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 size={13} /> {t('inventory.importModal.badgeValid')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                          <XCircle size={13} /> {t('inventory.importModal.badgeError')}
                        </span>
                      )}
                    </td>
                    <td className="font-medium text-slate-800 dark:text-slate-200">{r.data.item_name || '—'}</td>
                    <td className="text-slate-600 dark:text-slate-300">
                      {r.data.item_type ? translateEnum(t, r.data.item_type) : '—'}
                    </td>
                    <td className="font-mono text-slate-600 dark:text-slate-400">{r.data.serial_number || '—'}</td>
                    <td>
                      {r.isValid ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {t('inventory.importModal.passedChecks')}
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-medium">
                          {r.errors.join('; ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ExcelImportModal
