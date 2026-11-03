import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function SupplierReturnListPage() {
  return (
    <ModulePlaceholder
      title="Vendor Returns & RMA Management"
      subtitle="Govern return of defective or non-compliant stock to suppliers independently from internal returns"
      moduleName="Supplier Returns (RMA)"
      phaseNumber="6"
      endpoint="GET /api/v1/supplier-returns"
      expectedFeatures={[
        'Full RMA lifecycle: INITIATED -> DISPATCHED_TO_VENDOR -> VENDOR_ASSESSING -> COMPLETED_CLOSED',
        'Physical dispatch tracking: Carrier name, tracking number, and custody update to vendor',
        'Consumable stock handling: Moves balance to in_vendor_rma_qty in movement ledger',
        'Resolution modes: Replacement asset inward, Credit Note, Cash Refund, or Repaired Return',
        'Complete vendor assessment audit log with acceptance or rejection reason'
      ]}
    />
  )
}

