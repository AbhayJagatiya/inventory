import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function CondemnationDetailPage() {
  return (
    <ModulePlaceholder
      title="Condemnation Proposal Dossier"
      subtitle="Survey committee findings, assessment remarks, and sanction decision"
      moduleName="Condemnation Detail"
      phaseNumber="5"
      endpoint="GET /api/v1/condemnations/{id}"
      expectedFeatures={[
        'Full candidate list: Item description, observed condition, assessed scrap value, reason code',
        'Reviewer assessment notes & formal decision recording with official Sanction Order Number',
        'Multi-party audit history capturing reviewer and approver timestamps and designations',
        'Immediate action to proceed to Disposal Execution upon approval'
      ]}
    />
  )
}

