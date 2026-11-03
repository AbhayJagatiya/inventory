import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function ProcurementDetailPage() {
  return (
    <ModulePlaceholder
      title="Procurement Order Details"
      subtitle="Purchase order lines, tax breakdown, delivery challans, and linked stock receipts"
      moduleName="Procurement Detail"
      phaseNumber="6"
      endpoint="GET /api/v1/procurements/{id}"
      expectedFeatures={[
        'Full purchase order breakdown with tax percentage and total sanctioned expenditure',
        'Line item fulfillment status: Ordered vs Received balance per line',
        'Direct link to create an inward stock receipt against outstanding lines',
        'Attached vendor invoices, purchase sanctions, and delivery notes'
      ]}
    />
  )
}

