import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function CondemnationListPage() {
  return (
    <ModulePlaceholder
      title="Condemnation Proposals & Workflow"
      subtitle="Formal survey, condition assessment, and administrative sanction workflow"
      moduleName="Condemnations"
      phaseNumber="5"
      endpoint="GET /api/v1/condemnations"
      expectedFeatures={[
        'Lifecycle stages: SUBMITTED -> UNDER_REVIEW -> MORE_INFO_REQUIRED -> APPROVED -> REJECTED',
        'Separation-of-duties enforcement: Proposers cannot approve their own condemnation requests',
        'Physical inspection upload: Technical failure reports and damage photograph attachments',
        'Configurable approval authority resolved dynamically from system settings',
        'On approval: Asset transitions to PENDING_DISPOSAL and is locked from active store operations'
      ]}
    />
  )
}

