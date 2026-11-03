import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function VerificationSessionListPage() {
  return (
    <ModulePlaceholder
      title="Physical Stock Verification Sessions"
      subtitle="Periodic stocktaking, room-by-room inventory audits, and discrepancy tracking"
      moduleName="Verification Sessions"
      phaseNumber="6"
      endpoint="GET /api/v1/verifications/sessions"
      expectedFeatures={[
        'Initialize verification audit by Office, Room/Location, or Item Category',
        'System freezes expected inventory snapshot into verification_items at session start',
        'Audit progress bar with expected vs counted percentage in real time',
        'Discrepancy summary counts: Not Found, Location Mismatch, Condition Mismatch, Unexpected Items'
      ]}
    />
  )
}

