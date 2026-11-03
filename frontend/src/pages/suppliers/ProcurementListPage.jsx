import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function ProcurementListPage() {
  return (
    <ModulePlaceholder
      title="Procurement & Purchase Records"
      subtitle="Track purchase orders, sanction orders, invoice numbers, and inward fulfillment"
      moduleName="Procurement Records"
      phaseNumber="6"
      endpoint="GET /api/v1/procurements"
      expectedFeatures={[
        'Procurement orders register with PO Number, Supplier, Order Date, Amount, and Status',
        'Create PO with structured lines: Item description, category, type, quantity, unit price',
        'Fulfillment tracking: quantity_received <= quantity_ordered enforced at database level',
        'Direct linkage between purchase lines and subsequent stock receipts',
        'Legacy procurement entry mode with explicit "Missing Documentation" flag'
      ]}
    />
  )
}

