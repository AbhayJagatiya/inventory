import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PlusCircle, Edit3, Trash2, Tag, ShieldCheck, AlertCircle } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import { getCategories, createCategory, updateCategory } from '../../api/inventory.api'
import { MOCK_CATEGORIES } from '../../services/mockData'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import toast from 'react-hot-toast'

export default function CategoryListPage() {
  const { hasPermission } = useAuth()
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
      try {
        const res = await getCategories()
        return res?.data || res
      } catch {
        return MOCK_CATEGORIES
      }
    },
  })

  const categories = categoriesData || MOCK_CATEGORIES

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
        toast.success('Category parameters updated')
      } else {
        await createCategory(formData)
        toast.success('New category registered')
      }
      setIsModalOpen(false)
      refetch()
    } catch {
      toast.success(editingCategory ? 'Category updated (Demo)' : 'Category registered (Demo)')
      setIsModalOpen(false)
    }
  }

  const columns = [
    {
      key: 'code',
      header: 'Category Code',
      width: '160px',
      render: (code) => <span className="font-mono text-xs font-bold text-blue-700">{code}</span>,
    },
    {
      key: 'name',
      header: 'Category Name',
      render: (name) => <span className="text-sm font-semibold text-slate-800">{name}</span>,
    },
    {
      key: 'slow_moving_threshold_days',
      header: 'Slow Moving Threshold',
      align: 'right',
      render: (days) => <span className="text-xs text-slate-700">{days} days</span>,
    },
    {
      key: 'inactivity_threshold_days',
      header: 'Inactivity Threshold',
      align: 'right',
      render: (days) => <span className="text-xs text-slate-700">{days} days</span>,
    },
    {
      key: 'obsolescence_years',
      header: 'Useful Lifespan',
      align: 'right',
      render: (years) => <span className="text-xs font-medium text-slate-800">{years} years</span>,
    },
    {
      key: 'depreciation_rate_pct',
      header: 'Annual Depreciation',
      align: 'right',
      render: (pct) => <span className="text-xs font-semibold text-emerald-700">{pct}% p.a.</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '100px',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5">
          {hasPermission(PERMISSIONS.MASTER_CATEGORIES_MANAGE) && (
            <button
              onClick={() => handleOpenEdit(row)}
              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded"
              title="Edit Thresholds"
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
        title="Inventory Categories & Lifespan Rules"
        subtitle="Configure dead stock inactivity rules and annual depreciation rates per asset classification"
        actions={
          hasPermission(PERMISSIONS.MASTER_CATEGORIES_MANAGE) && (
            <Button variant="primary" size="sm" leftIcon={<PlusCircle size={15} />} onClick={handleOpenAdd}>
              New Category
            </Button>
          )
        }
      />

      <DataTable columns={columns} data={categories} isLoading={isLoading} />

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Edit Category Parameters' : 'Register New Category'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Save Category
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category Code</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g. IT-COMP or FURN"
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl font-mono text-sm bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category Description</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Computers & Peripherals"
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl text-sm bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Slow Moving Days</label>
              <input
                type="number"
                value={formData.slow_moving_threshold_days}
                onChange={(e) => setFormData({ ...formData, slow_moving_threshold_days: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl text-sm bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Inactivity (Non-Moving) Days</label>
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
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Obsolescence Lifespan (Years)</label>
              <input
                type="number"
                value={formData.obsolescence_years}
                onChange={(e) => setFormData({ ...formData, obsolescence_years: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl text-sm bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Depreciation Rate (% p.a.)</label>
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
