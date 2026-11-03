import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function SupplierDetailPage() {
  return (
    <ModulePlaceholder
      title="Supplier Dossier & Order History"
      subtitle="Complete purchase history, fulfillment performance, and vendor returns"
      moduleName="Supplier Profile"
      phaseNumber="6"
      endpoint="GET /api/v1/suppliers/{id}"
      expectedFeatures={[
        'Full vendor information: Registered address, GSTIN, payment terms, and contact dossier',
        'Linked procurement orders with delivered item lines and fulfillment percentages',
        'Active warranty and RMA claim performance history',
        'Edit vendor parameters and manage active status'
      ]}
    />
  )
}

