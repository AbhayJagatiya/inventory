import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PlusCircle, Edit3, Building2, MapPin, Store } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import DataTable from '../../components/tables/DataTable'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import { getLocations, createLocation, updateLocation } from '../../api/inventory.api'
import { MOCK_LOCATIONS } from '../../services/mockData'
import { useAuth } from '../../context/AuthContext'
import { PERMISSIONS } from '../../constants/permissions'
import toast from 'react-hot-toast'

export default function LocationListPage() {
  const { hasPermission, officeName } = useAuth()
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
      try {
        const res = await getLocations()
        return res?.data || res
      } catch {
        return MOCK_LOCATIONS
      }
    },
  })

  const locations = locationsData || MOCK_LOCATIONS

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
      if (editingLocation) {
        await updateLocation(editingLocation.id, formData)
        toast.success('Location updated successfully')
      } else {
        await createLocation(formData)
        toast.success('Storage room registered successfully')
      }
      setIsModalOpen(false)
      refetch()
    } catch {
      toast.success(editingLocation ? 'Location updated (Demo)' : 'Location registered (Demo)')
      setIsModalOpen(false)
    }
  }

  const columns = [
    {
      key: 'room_number',
      header: 'Room / Section',
      width: '160px',
      render: (room) => <span className="font-semibold text-sm text-blue-700">{room}</span>,
    },
    {
      key: 'building_name',
      header: 'Building',
      render: (bldg, row) => (
        <div>
          <span className="text-sm font-medium text-slate-800">{bldg}</span>
          {row.floor && <span className="text-xs text-slate-500 block">{row.floor}</span>}
        </div>
      ),
    },
    {
      key: 'location_type',
      header: 'Type',
      width: '140px',
      render: (type) => (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
          {type?.replace(/_/g, ' ') || 'STORE ROOM'}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Operational Description',
      render: (desc) => <span className="text-xs text-slate-600">{desc || '—'}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '100px',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5">
          {hasPermission(PERMISSIONS.MASTER_LOCATIONS_MANAGE) && (
            <button
              onClick={() => handleOpenEdit(row)}
              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded"
              title="Edit Location"
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
        title="Store Rooms & Physical Storage Locations"
        subtitle={`Physical storage hierarchy scoped strictly to assigned office: ${officeName || 'Veraval Office'}`}
        actions={
          hasPermission(PERMISSIONS.MASTER_LOCATIONS_MANAGE) && (
            <Button variant="primary" size="sm" leftIcon={<PlusCircle size={15} />} onClick={handleOpenAdd}>
              New Location
            </Button>
          )
        }
      />

      <DataTable columns={columns} data={locations} isLoading={isLoading} />

      {/* Add / Edit Location Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingLocation ? 'Edit Storage Location' : 'Register New Storage Location'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Save Location
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Room Number / Yard Code</label>
            <input
              type="text"
              value={formData.room_number}
              onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
              placeholder="e.g. Room 102 or Store Yard A"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Building Name</label>
              <input
                type="text"
                value={formData.building_name}
                onChange={(e) => setFormData({ ...formData, building_name: e.target.value })}
                placeholder="e.g. Panchayat Bhavan Main"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Floor</label>
              <input
                type="text"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                placeholder="e.g. Ground Floor"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Location Type</label>
            <select
              value={formData.location_type}
              onChange={(e) => setFormData({ ...formData, location_type: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
            >
              <option value="STORE_ROOM">STORE ROOM (Central Inventory)</option>
              <option value="OFFICE_ROOM">OFFICE ROOM (Department Custody)</option>
              <option value="STORE_YARD">STORE YARD (Heavy / Condemned Goods)</option>
              <option value="IT_ROOM">IT SERVER ROOM (Secure IT Equipment)</option>
              <option value="ARCHIVE">ARCHIVE ROOM (Record Storage)</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Description / Notes</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g. Primary stationery and computer parts room"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
