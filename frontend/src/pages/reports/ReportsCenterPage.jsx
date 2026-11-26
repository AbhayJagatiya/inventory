import ModulePlaceholder from '../../components/common/ModulePlaceholder'
import { useLanguage } from '../../i18n'

export default function ReportsCenterPage() {
  const { t } = useLanguage()
  return (
    <ModulePlaceholder
      title={t('reports.title')}
      subtitle={t('reports.parameters.title')}
      moduleName={t('nav.reports')}
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

