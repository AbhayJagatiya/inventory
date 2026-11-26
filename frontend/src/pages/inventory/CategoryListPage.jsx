import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PlusCircle, Edit3, Trash2, Tag, ShieldCheck, AlertCircle } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import { getCategories, createCategory, updateCategory } from '../../api/inventory.api'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import { useLanguage } from '../../i18n'
import toast from 'react-hot-toast'

export default function CategoryListPage() {
  const { hasPermission } = useAuth()
  const { t } = useLanguage()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    slow_moving_threshold_days: 90,
    inactivity_threshold_days: 180,
    obsolescence_years: 5,
    depreciation_rate_pct: 20,
  })

  const { data: categoriesData, isLoading, refetch } = useQuery({
    queryKey: ['categories-list'],
    queryFn: async () => {
      const res = await getCategories()
      return res?.data || res || []
    },
  })

  const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData?.data || [])

  const handleOpenAdd = () => {
    setEditingCategory(null)
    setFormData({
      code: '',
      name: '',
      slow_moving_threshold_days: 90,
      inactivity_threshold_days: 180,
      obsolescence_years: 5,
      depreciation_rate_pct: 20,
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat)
    setFormData({
      code: cat.code,
      name: cat.name,
      slow_moving_threshold_days: cat.slow_moving_threshold_days || 90,
      inactivity_threshold_days: cat.inactivity_threshold_days || 180,
      obsolescence_years: cat.obsolescence_years || 5,
      depreciation_rate_pct: cat.depreciation_rate_pct || 20,
    })
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData)
        toast.success(t('inventory.categories.messages.updated'))
      } else {
        await createCategory(formData)
        toast.success(t('inventory.categories.messages.created'))
      }
      setIsModalOpen(false)
      refetch()
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('inventory.categories.messages.saveError'))
    }
  }

  const columns = [
    {
      key: 'code',
      header: t('inventory.categories.categoryCode'),
      width: '160px',
      render: (code) => <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">{code}</span>,
    },
    {
      key: 'name',
      header: t('inventory.categories.categoryName'),
      render: (name) => <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</span>,
    },
    {
      key: 'slow_moving_threshold_days',
      header: t('deadStock.classification.thresholds.slowMoving'),
      align: 'right',
      render: (days) => <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{days} {t('labels.days')}</span>,
    },
    {
      key: 'inactivity_threshold_days',
      header: t('inventory.categories.inactivityThreshold'),
      align: 'right',
      render: (days) => <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{days} {t('labels.days')}</span>,
    },
    {
      key: 'obsolescence_years',
      header: t('inventory.categories.usefulLifespan'),
      align: 'right',
      render: (years) => <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{years} {t('labels.years')}</span>,
    },
    {
      key: 'depreciation_rate_pct',
      header: t('inventory.categories.annualDepreciation'),
      align: 'right',
      render: (pct) => <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{pct}% {t('inventory.categories.perAnnum')}</span>,
    },
    {
      key: 'actions',
      header: t('labels.actions'),
      align: 'right',
      width: '100px',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5">
          {hasPermission(PERMISSIONS.MASTER_CATEGORIES_MANAGE) && (
            <button
              onClick={() => handleOpenEdit(row)}
              className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-emerald-950/40 rounded"
              title={t('inventory.categories.editCategory')}
            >
              <Edit3 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('inventory.categories.title')}
        subtitle={t('inventory.categories.subtitle')}
        actions={
          hasPermission(PERMISSIONS.MASTER_CATEGORIES_MANAGE) && (
            <Button variant="primary" size="sm" leftIcon={<PlusCircle size={15} />} onClick={handleOpenAdd}>
              {t('inventory.categories.addCategory')}
            </Button>
          )
        }
      />

      <DataTable columns={columns} data={categories} isLoading={isLoading} />

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? t('inventory.categories.editCategory') : t('inventory.categories.addCategory')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {t('actions.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {t('actions.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('inventory.categories.categoryCode')}</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder={t('inventory.categories.codePlaceholder')}
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl font-mono text-sm bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('inventory.categories.categoryName')}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('inventory.categories.namePlaceholder')}
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl text-sm bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('inventory.categories.slowMovingDays')}</label>
              <input
                type="number"
                value={formData.slow_moving_threshold_days}
                onChange={(e) => setFormData({ ...formData, slow_moving_threshold_days: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl text-sm bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('inventory.categories.inactivityDays')}</label>
              <input
                type="number"
                value={formData.inactivity_threshold_days}
                onChange={(e) => setFormData({ ...formData, inactivity_threshold_days: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl text-sm bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('inventory.categories.obsolescenceYears')}</label>
              <input
                type="number"
                value={formData.obsolescence_years}
                onChange={(e) => setFormData({ ...formData, obsolescence_years: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl text-sm bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('inventory.categories.depreciationRate')}</label>
              <input
                type="number"
                step="0.1"
                value={formData.depreciation_rate_pct}
                onChange={(e) => setFormData({ ...formData, depreciation_rate_pct: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl text-sm bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
