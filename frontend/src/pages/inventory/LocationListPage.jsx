import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PlusCircle, Edit3, Building2, MapPin, Store } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import { getLocations, createLocation, updateLocation } from '../../api/inventory.api'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import { useLanguage } from '../../i18n'
import { translateEnum } from '../../i18n/enumLabels'
import toast from 'react-hot-toast'

export default function LocationListPage() {
  const { hasPermission, officeName, user } = useAuth()
  const { t } = useLanguage()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState(null)
  const [formData, setFormData] = useState({
    building_name: '',
    floor: '',
    room_number: '',
    location_type: 'STORE_ROOM',
    description: '',
  })

  const { data: locationsData, isLoading, refetch } = useQuery({
    queryKey: ['locations-list'],
    queryFn: async () => {
      const res = await getLocations()
      return res?.data || res || []
    },
  })

  const locations = Array.isArray(locationsData) ? locationsData : (locationsData?.data || [])

  const handleOpenAdd = () => {
    setEditingLocation(null)
    setFormData({
      building_name: 'Panchayat Bhavan Main',
      floor: 'Ground Floor',
      room_number: '',
      location_type: 'STORE_ROOM',
      description: '',
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (loc) => {
    setEditingLocation(loc)
    setFormData({
      building_name: loc.building_name || '',
      floor: loc.floor || '',
      room_number: loc.room_number || '',
      location_type: loc.location_type || 'STORE_ROOM',
      description: loc.description || '',
    })
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        office_id: user?.office_id,
      }
      if (editingLocation) {
        await updateLocation(editingLocation.id, payload)
        toast.success(t('inventory.locations.messages.updated'))
      } else {
        await createLocation(payload)
        toast.success(t('inventory.locations.messages.created'))
      }
      setIsModalOpen(false)
      refetch()
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('inventory.locations.messages.saveError'))
    }
  }

  const columns = [
    {
      key: 'room_number',
      header: t('inventory.locations.roomSection'),
      width: '160px',
      render: (room) => <span className="font-semibold text-sm text-blue-700">{room}</span>,
    },
    {
      key: 'building_name',
      header: t('inventory.locations.building'),
      render: (bldg, row) => (
        <div>
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{bldg}</span>
          {row.floor && <span className="text-xs text-slate-500 block">{row.floor}</span>}
        </div>
      ),
    },
    {
      key: 'location_type',
      header: t('labels.type'),
      width: '140px',
      render: (type) => (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-emerald-950/40 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-emerald-500/20">
          {translateEnum(t, type || 'STORE_ROOM')}
        </span>
      ),
    },
    {
      key: 'description',
      header: t('labels.description'),
      render: (desc) => <span className="text-xs text-slate-600">{desc || '—'}</span>,
    },
    {
      key: 'actions',
      header: t('labels.actions'),
      align: 'right',
      width: '100px',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5">
          {hasPermission(PERMISSIONS.MASTER_LOCATIONS_MANAGE) && (
            <button
              onClick={() => handleOpenEdit(row)}
              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded"
              title={t('inventory.locations.editLocation')}
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
        title={t('inventory.locations.title')}
        subtitle={t('inventory.locations.subtitle', { office: officeName || 'Veraval Office' })}
        actions={
          hasPermission(PERMISSIONS.MASTER_LOCATIONS_MANAGE) && (
            <Button variant="primary" size="sm" leftIcon={<PlusCircle size={15} />} onClick={handleOpenAdd}>
              {t('inventory.locations.addLocation')}
            </Button>
          )
        }
      />

      <DataTable columns={columns} data={locations} isLoading={isLoading} />

      {/* Add / Edit Location Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingLocation ? t('inventory.locations.editLocation') : t('inventory.locations.addLocation')}
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
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.locations.roomNumberLabel')}</label>
            <input
              type="text"
              value={formData.room_number}
              onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
              placeholder={t('inventory.locations.roomPlaceholder')}
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl text-sm bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.locations.buildingName')}</label>
              <input
                type="text"
                value={formData.building_name}
                onChange={(e) => setFormData({ ...formData, building_name: e.target.value })}
                placeholder={t('inventory.locations.buildingPlaceholder')}
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl text-sm bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.locations.floor')}</label>
              <input
                type="text"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                placeholder={t('inventory.locations.floorPlaceholder')}
                className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl text-sm bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inventory.locations.locationType')}</label>
            <select
              value={formData.location_type}
              onChange={(e) => setFormData({ ...formData, location_type: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl text-sm bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="STORE_ROOM" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">{translateEnum(t, 'STORE_ROOM')}</option>
              <option value="OFFICE_ROOM" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">{translateEnum(t, 'OFFICE_ROOM')}</option>
              <option value="STORE_YARD" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">{translateEnum(t, 'STORE_YARD')}</option>
              <option value="IT_ROOM" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">{translateEnum(t, 'IT_ROOM')}</option>
              <option value="ARCHIVE" className="bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white">{translateEnum(t, 'ARCHIVE')}</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">{t('labels.description')}</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('inventory.locations.descriptionPlaceholder')}
              className="w-full px-3 py-2 border border-slate-300 dark:border-emerald-500/25 rounded-xl text-sm bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
