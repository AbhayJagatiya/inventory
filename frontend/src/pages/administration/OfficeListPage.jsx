import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function OfficeListPage() {
  return (
    <ModulePlaceholder
      title="Panchayat Office Hierarchy"
      subtitle="Multi-office structural configuration with initial Veraval seed data"
      moduleName="Office Management"
      phaseNumber="7"
      endpoint="GET /api/v1/offices"
      expectedFeatures={[
        'Initial active operational seed: Veraval Office (OFF-GS-VRV-001)',
        'Extensible multi-tenant architecture ready for Taluka & Gram Panchayat onboarding',
        'Composite foreign key integrity ensuring assets and rooms never cross office boundaries',
        'Office-level summary metrics: Total assets, dead stock valuation, and active personnel'
      ]}
    />
  )
}

