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

  // Load Master Data
  useEffect(() => {
    getCategories().then((res) => setCategories(res.data || res)).catch(() => {})
    getLocations().then((res) => setLocations(res.data || res)).catch(() => {})
    getUOMs().then((res) => setUoms(res.data || res)).catch(() => {})

    if (isEdit) {
      getItem(id)
        .then((res) => {
          const item = res.data || res
          reset({
            item_type: item.item_type || 'DURABLE_ASSET',
            item_name: item.item_name || '',
            category_id: item.category?.id || item.category_id || '',
            location_id: item.location?.id || item.location_id || '',
            uom: item.uom || 'NOS',
            brand: item.brand || '',
            model_number: item.model_number || '',
            serial_number: item.serial_number || '',
            quantity: item.quantity || 1,
            unit_purchase_cost: item.unit_purchase_cost || 0,
            purchase_date: item.purchase_date || '',
            invoice_number: item.invoice_number || '',
            condition: item.condition || 'GOOD',
            current_custodian: item.current_custodian || '',
            current_department: item.current_department || '',
            is_legacy: item.is_legacy || false,
          })
        })
        .catch((err) => {
          setApiError(extractApiError(err) || 'Unable to retrieve item record from database.')
        })
    }
  }, [id, isEdit, reset])

  const onSubmit = async (data) => {
    setApiError('')
    try {
      const selectedUom = uoms.find((u) => u.code === data.uom)
      const payload = {
        ...data,
        office_id: user?.office_id,
        uom_id: selectedUom?.id,
        initial_quantity: Number(data.quantity || 1),
      }

      if (isEdit) {
        await updateItem(id, payload)
        toast.success('Asset record updated successfully')
      } else {
        await createItem(payload)
        toast.success('New inventory record registered successfully')
      }
      navigate(ROUTES.INVENTORY)
    } catch (err) {
      const msg = extractApiError(err) || 'Failed to register asset. Please check required fields.'
      setApiError(msg)
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title={isEdit ? 'Edit Asset Record' : 'Register New Inventory Item'}
        subtitle={
          isEdit
            ? 'Update location custody, condition classification, or specifications'
            : 'Register durable assets (with unique Asset ID & barcode) or quantity-tracked consumables'
        }
        actions={
          <Link to={ROUTES.INVENTORY}>
            <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
              Cancel
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
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">1. Item Identity & Tracking Mode</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tracking Mode */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tracking Mode <span className="text-red-500">*</span>
              </label>
              <select
                {...register('item_type')}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                disabled={isEdit}
              >
                <option value="DURABLE_ASSET" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">
                  Durable Asset (Individual Asset ID & Barcode)
                </option>
                <option value="CONSUMABLE_STOCK" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">
                  Consumable Stock (Quantity / Batch Tracked)
                </option>
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {watchItemType === 'DURABLE_ASSET'
                  ? 'For equipment, computers, machinery & furniture. Generates permanent unique AST code.'
                  : 'For office supplies, paper, stationery. Tracks quantity balance without individual QR labels.'}
              </p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Item Category <span className="text-red-500">*</span>
              </label>
              <select
                {...register('category_id')}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">-- Select Category --</option>
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
              Official Item Description / Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('item_name')}
              placeholder="e.g. HP LaserJet Pro MFP 4104dw Printer or A4 Copier Paper"
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Brand / Manufacturer</label>
                <input
                  type="text"
                  {...register('brand')}
                  placeholder="e.g. HP, Godrej, Dell"
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Model / Specs</label>
                <input
                  type="text"
                  {...register('model_number')}
                  placeholder="e.g. OptiPlex 7090"
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Serial Number</label>
                <input
                  type="text"
                  {...register('serial_number')}
                  placeholder="Unique OEM serial number"
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
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">2. Storage Location & Custody</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Storage Room / Section <span className="text-red-500">*</span>
              </label>
              <select
                {...register('location_id')}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">-- Select Store Room --</option>
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
                Current Custodian / Section
              </label>
              <input
                type="text"
                {...register('current_custodian')}
                placeholder="e.g. Store Officer or Staff Name"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Physical Condition <span className="text-red-500">*</span>
              </label>
              <select
                {...register('condition')}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="GOOD" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">Good (Operational & Sound)</option>
                <option value="FAIR" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">Fair (Normal Wear & Tear)</option>
                <option value="DAMAGED" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">Damaged (Requires Repair)</option>
                <option value="SCRAP" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">Scrap (Uneconomical to repair)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Procurement & Financial Valuation */}
        <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-6 shadow-sm space-y-4 transition-colors">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-emerald-500/15">
            <DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">3. Procurement & Valuation Details</h2>
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
              <strong>Legacy Pre-Digital Record:</strong> Check this if procurement documents/invoices are missing from historical manual registers.
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                {...register('quantity')}
                min="1"
                disabled={watchItemType === 'DURABLE_ASSET'}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-[#081210] disabled:text-slate-500 dark:disabled:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              {watchItemType === 'DURABLE_ASSET' && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Durable assets are 1 item per record</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Unit of Measure <span className="text-red-500">*</span>
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
                Unit Purchase Cost (₹) <span className="text-red-500">*</span>
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
                Total Valuation (₹)
              </label>
              <div className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-[#081210] border border-slate-200 dark:border-emerald-500/20 rounded-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                ₹{calculatedTotalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Acquisition Date <span className="text-red-500">*</span>
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
                Invoice / PO Reference Number
              </label>
              <input
                type="text"
                {...register('invoice_number')}
                placeholder={watchIsLegacy ? 'Not Available (Legacy)' : 'e.g. INV-2024-890'}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Supplier / Vendor Name
              </label>
              <input
                type="text"
                {...register('supplier_name')}
                placeholder={watchIsLegacy ? 'Not Available (Historic)' : 'Registered Supplier'}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 shadow-sm transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Submission verifies composite office scoping and assigns auto-generated asset ID & barcode.
          </p>
          <div className="flex items-center gap-3">
            <Link to={ROUTES.INVENTORY}>
              <Button variant="secondary" size="md">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              leftIcon={<Save size={16} />}
            >
              {isEdit ? 'Update Record' : 'Register Item'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
