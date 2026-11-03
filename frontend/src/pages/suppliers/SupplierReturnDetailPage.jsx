import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function SupplierReturnDetailPage() {
  return (
    <ModulePlaceholder
      title="Vendor Return (RMA) Dossier"
      subtitle="Complete RMA lifecycle, tracking numbers, vendor assessment, and final settlement"
      moduleName="RMA Detail"
      phaseNumber="6"
      endpoint="GET /api/v1/supplier-returns/{id}"
      expectedFeatures={[
        'Item identity, original PO reference, and warranty certificate link',
        'Dispatch status recording: Carrier tracking, waybill number, and shipping date',
        'Vendor response logger: Accept/reject notes and replacement item dispatch',
        'Resolution modal: Inward replacement asset with new serial, or record financial credit note'
      ]}
    />
  )
}

