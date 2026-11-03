import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function WarrantyListPage() {
  return (
    <ModulePlaceholder
      title="Warranty Management & Expiry Watch"
      subtitle="Monitor OEM coverage, service level agreements, and upcoming expiration windows"
      moduleName="Warranty Management"
      phaseNumber="6"
      endpoint="GET /api/v1/warranties"
      expectedFeatures={[
        'Warranty register with Item Code, Provider, Start/End Dates, Coverage Scope, and Support Contact',
        'Lead-time filter tabs: Expiring in 30 days, 60 days, 90 days, or already expired',
        'Backend calculated warranty status display (UI strictly prevents inventing status)',
        'Direct link to initiate a Supplier RMA Return for items under active warranty',
        'Attached digital warranty cards, AMC agreements, and service contract copies'
      ]}
    />
  )
}

