import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Package, ArrowLeft, Save, AlertCircle, Building2,
  FileText, ShieldCheck, DollarSign, CheckCircle2, QrCode
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import { createItem, updateItem, getItem, getCategories, getLocations, getUOMs } from '../../api/inventory.api'
import { getSuppliers } from '../../api/suppliers.api'
import { ROUTES } from '../../constants/routes'
import { extractApiError } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { useLanguage } from '../../i18n'

const assetSchema = z.object({
  item_type: z.enum(['DURABLE_ASSET', 'CONSUMABLE_STOCK']),
  item_name: z.string().min(2, 'Item name is required'),
  category_id: z.string().min(1, 'Please select a category'),
  location_id: z.string().min(1, 'Please select a storage room / location'),
  uom: z.string().min(1, 'Unit of measure is required'),
  brand: z.string().optional(),
  model_number: z.string().optional(),
  serial_number: z.string().optional(),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  unit_purchase_cost: z.coerce.number().min(0, 'Unit cost must be non-negative'),
  purchase_date: z.string().min(1, 'Acquisition date is required'),
  invoice_number: z.string().optional(),
  supplier_name: z.string().optional(),
  condition: z.enum(['GOOD', 'FAIR', 'DAMAGED', 'SCRAP']),
  current_custodian: z.string().optional(),
  current_department: z.string().optional(),
  min_stock_level: z.coerce.number().optional(),
  is_legacy: z.boolean().default(false),
  remarks: z.string().optional(),
})

export default function AddEditAssetPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { t } = useLanguage()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [apiError, setApiError] = useState('')

  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [uoms, setUoms] = useState([])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      item_type: 'DURABLE_ASSET',
      quantity: 1,
      unit_purchase_cost: 0,
      condition: 'GOOD',
      uom: 'NOS',
      is_legacy: false,
      purchase_date: new Date().toISOString().split('T')[0],
    },
  })

  const watchItemType = watch('item_type')
  const watchQty = watch('quantity') || 0
  const watchUnitCost = watch('unit_purchase_cost') || 0
  const watchIsLegacy = watch('is_legacy')
  const calculatedTotalCost = watchQty * watchUnitCost

  // Load Master Data (and Item if editing) in sequence so select options exist before reset
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const [catRes, locRes, uomRes] = await Promise.all([
          getCategories().catch(() => []),
          getLocations().catch(() => []),
          getUOMs().catch(() => []),
        ])
        if (cancelled) return
        const catList = catRes?.data || catRes || []
        const locList = locRes?.data || locRes || []
        const uomList = uomRes?.data || uomRes || []
        setCategories(catList)
        setLocations(locList)
        setUoms(uomList)

        if (isEdit) {
          const itemRes = await getItem(id)
          if (cancelled) return
          const item = itemRes?.data || itemRes
          const resolvedUom =
            item.uom ||
            uomList.find((u) => u.id === item.uom_id)?.code ||
            'NOS'
          reset({
            item_type: item.item_type || 'DURABLE_ASSET',
            item_name: item.item_name || '',
            category_id: item.category?.id || item.category_id || '',
            location_id: item.location?.id || item.location_id || '',
            uom: resolvedUom,
            brand: item.brand || '',
            model_number: item.model_number || '',
            serial_number: item.serial_number || '',
            quantity: item.quantity || 1,
            unit_purchase_cost: item.unit_purchase_cost ?? 0,
            purchase_date: item.purchase_date || new Date().toISOString().split('T')[0],
            invoice_number: item.invoice_number || '',
            condition: item.condition || 'GOOD',
            current_custodian: item.current_custodian || '',
            current_department: item.current_department || '',
            min_stock_level: item.min_stock_level ?? 0,
            is_legacy: Boolean(item.is_legacy),
          })
        }
      } catch (err) {
        if (!cancelled) {
          setApiError(extractApiError(err) || 'Unable to retrieve item record from database.')
        }
      }
    }
    loadData()
    return () => {
      cancelled = true
    }
  }, [id, isEdit, reset])

  const onSubmit = async (data) => {
    setApiError('')
    try {
      const selectedUom = uoms.find((u) => u.code === data.uom)
      const payload = {
        ...data,
        brand: data.brand || null,
        model_number: data.model_number || null,
        serial_number: data.serial_number || null,
        invoice_number: data.invoice_number || null,
        current_custodian: data.current_custodian || null,
        current_department: data.current_department || null,
        supplier_name: data.supplier_name || null,
        purchase_date: data.purchase_date || null,
        office_id: user?.office_id,
        uom_id: selectedUom?.id,
        initial_quantity: Number(data.quantity || 1),
      }

      if (isEdit) {
        await updateItem(id, payload)
        toast.success(t('inventory.messages.assetUpdated'))
      } else {
        await createItem(payload)
        toast.success(t('inventory.messages.assetCreated'))
      }
      navigate(ROUTES.INVENTORY)
    } catch (err) {
      const msg = extractApiError(err) || t('inventory.assetForm.saveError')
      setApiError(msg)
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title={isEdit ? t('inventory.assetForm.editTitle') : t('inventory.assetForm.createTitle')}
        subtitle={
          isEdit
            ? t('inventory.assetForm.editSubtitle')
            : t('inventory.assetForm.createSubtitle')
        }
        actions={
          <Link to={ROUTES.INVENTORY}>
            <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
              {t('actions.cancel')}
            </Button>
          </Link>
        }
      />

      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-sm text-red-700">
          <AlertCircle size={18} className="shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Item Classification & Core Identity */}
        <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-6 shadow-sm space-y-5 transition-colors">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-emerald-500/15">
            <Package size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('inventory.assetForm.section1')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tracking Mode */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('inventory.assetForm.trackingMode')} <span className="text-red-500">*</span>
              </label>
              <select
                {...register('item_type')}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                disabled={isEdit}
              >
                <option value="DURABLE_ASSET" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">
                  {t('inventory.assetForm.durableOption')}
                </option>
                <option value="CONSUMABLE_STOCK" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">
                  {t('inventory.assetForm.consumableOption')}
                </option>
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {watchItemType === 'DURABLE_ASSET'
                  ? t('inventory.assetForm.durableHint')
                  : t('inventory.assetForm.consumableHint')}
              </p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('inventory.assetForm.itemCategory')} <span className="text-red-500">*</span>
              </label>
              <select
                {...register('category_id')}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">{t('inventory.assetForm.selectCategoryOpt')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              {errors.category_id && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.category_id.message}</p>
              )}
            </div>
          </div>

          {/* Item Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('inventory.assetForm.officialName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('item_name')}
              placeholder={t('inventory.assetForm.officialNamePlaceholder')}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            {errors.item_name && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.item_name.message}</p>
            )}
          </div>

          {/* Technical Specs (If Durable) */}
          {watchItemType === 'DURABLE_ASSET' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-emerald-500/15">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('inventory.assetForm.brand')}</label>
                <input
                  type="text"
                  {...register('brand')}
                  placeholder={t('inventory.assetForm.brandPlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('inventory.assetForm.model')}</label>
                <input
                  type="text"
                  {...register('model_number')}
                  placeholder={t('inventory.assetForm.modelPlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('inventory.assetForm.serialNumber')}</label>
                <input
                  type="text"
                  {...register('serial_number')}
                  placeholder={t('inventory.assetForm.serialPlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Storage Location & Initial Custodian */}
        <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-6 shadow-sm space-y-4 transition-colors">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-emerald-500/15">
            <Building2 size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('inventory.assetForm.section2')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('inventory.assetForm.storageRoom')} <span className="text-red-500">*</span>
              </label>
              <select
                {...register('location_id')}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">{t('inventory.assetForm.selectRoomOpt')}</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id} className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">
                    {loc.room_number} - {loc.description}
                  </option>
                ))}
              </select>
              {errors.location_id && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.location_id.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('inventory.assetForm.custodian')}
              </label>
              <input
                type="text"
                {...register('current_custodian')}
                placeholder={t('inventory.assetForm.custodianPlaceholder')}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('inventory.assetForm.physicalCondition')} <span className="text-red-500">*</span>
              </label>
              <select
                {...register('condition')}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="GOOD" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">{t('inventory.assetForm.condGood')}</option>
                <option value="FAIR" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">{t('inventory.assetForm.condFair')}</option>
                <option value="DAMAGED" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">{t('inventory.assetForm.condDamaged')}</option>
                <option value="SCRAP" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">{t('inventory.assetForm.condScrap')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Procurement & Financial Valuation */}
        <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-6 shadow-sm space-y-4 transition-colors">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-emerald-500/15">
            <DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('inventory.assetForm.section3')}</h2>
          </div>

          {/* Legacy Checkbox */}
          <div className="flex items-center gap-2 p-3 bg-slate-50/70 dark:bg-[#081210] rounded-xl border border-slate-200 dark:border-emerald-500/20 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              id="is_legacy"
              {...register('is_legacy')}
              className="rounded border-slate-300 dark:border-emerald-500/30 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="is_legacy" className="cursor-pointer">
              <strong>{t('inventory.assetForm.legacyTitle')}</strong> {t('inventory.assetForm.legacyDesc')}
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('inventory.assetForm.quantity')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                {...register('quantity')}
                min="1"
                disabled={watchItemType === 'DURABLE_ASSET'}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-[#081210] disabled:text-slate-500 dark:disabled:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              {watchItemType === 'DURABLE_ASSET' && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{t('inventory.assetForm.durableQtyHint')}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('inventory.assetForm.uom')} <span className="text-red-500">*</span>
              </label>
              <select
                {...register('uom')}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {uoms.map((u) => (
                  <option key={u.id} value={u.code} className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">
                    {u.code} - {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('inventory.assetForm.unitCost')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                {...register('unit_purchase_cost')}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('inventory.assetForm.totalValuation')}
              </label>
              <div className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-[#081210] border border-slate-200 dark:border-emerald-500/20 rounded-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                ₹{calculatedTotalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('inventory.assetForm.acquisitionDate')} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register('purchase_date')}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              {errors.purchase_date && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.purchase_date.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('inventory.assetForm.invoiceNumber')}
              </label>
              <input
                type="text"
                {...register('invoice_number')}
                placeholder={watchIsLegacy ? t('inventory.assetForm.invoiceLegacyPlaceholder') : t('inventory.assetForm.invoicePlaceholder')}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('inventory.assetForm.supplierName')}
              </label>
              <input
                type="text"
                {...register('supplier_name')}
                placeholder={watchIsLegacy ? t('inventory.assetForm.supplierLegacyPlaceholder') : t('inventory.assetForm.supplierPlaceholder')}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 shadow-sm transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('inventory.assetForm.submitHint')}
          </p>
          <div className="flex items-center gap-3">
            <Link to={ROUTES.INVENTORY}>
              <Button variant="secondary" size="md">
                {t('actions.cancel')}
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              leftIcon={<Save size={16} />}
            >
              {isEdit ? t('inventory.assetForm.updateRecord') : t('inventory.assetForm.registerItem')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
