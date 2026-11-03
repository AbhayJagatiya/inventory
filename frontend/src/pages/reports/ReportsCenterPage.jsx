import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function ReportsCenterPage() {
  return (
    <ModulePlaceholder
      title="Statutory Reports & Analytics Center"
      subtitle="Comprehensive catalogue of 12 official government inventory, asset valuation, and movement registers"
      moduleName="Reports Center"
      phaseNumber="7"
      endpoint="GET /api/v1/reports/*"
      expectedFeatures={[
        '12 standard registers: Current Stock, Asset Register, Valuation, Movements, Dead Stock, Disposals, Suppliers, etc.',
        'Office scoping: Single-office views vs consolidated District Panchayat summary (System Admin only)',
        'Streaming file exports: CSV, Excel (.xlsx), and high-fidelity official government PDF with letterhead',
        'Parameter filters: Date range, Category, Location, Operational Status, and Classification',
        'Exact reconciliation guarantee: Report figures reconcile with the PostgreSQL Inventory Movement Ledger'
      ]}
    />
  )
}

