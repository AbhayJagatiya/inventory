import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function SupplierListPage() {
  return (
    <ModulePlaceholder
      title="Supplier Master Directory"
      subtitle="Vendor profiles, contact persons, tax identifiers (GSTIN/PAN), and active contracts"
      moduleName="Supplier Directory"
      phaseNumber="6"
      endpoint="GET /api/v1/suppliers"
      expectedFeatures={[
        'Supplier directory with Vendor Code, Name, GSTIN, PAN, Contact Person, and Phone',
        'Duplicate GSTIN / Name verification prevents duplicate vendor records',
        'Direct procurement and delivered items history per vendor',
        'Soft deactivation: Retains historical procurement links when vendor is marked inactive'
      ]}
    />
  )
}

