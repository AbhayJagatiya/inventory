import ModulePlaceholder from '../../components/common/ModulePlaceholder'
import { useLanguage } from '../../i18n'

export default function AuditTrailPage() {
  const { t } = useLanguage()
  return (
    <ModulePlaceholder
      title={t('audit.title')}
      subtitle={t('audit.emptyState.description')}
      moduleName={t('nav.auditTrail')}
      phaseNumber="7"
      endpoint="GET /api/v1/audit/logs"
      expectedFeatures={[
        'Append-only security log: No delete or edit API endpoints exist for audit records',
        'Structured log payload: Timestamp, Actor, Role, Office, Action, Module, Record ID, IP address',
        'Interactive JSON diff inspector: View before-and-after attribute values for modified entities',
        'Multi-attribute search & filter: By Module, Date Range, User ID, and Action Type',
        'Authorized audit log CSV/PDF export for statutory vigilance and audit inspection'
      ]}
    />
  )
}

