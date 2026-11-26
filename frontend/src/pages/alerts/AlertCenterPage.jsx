import ModulePlaceholder from '../../components/common/ModulePlaceholder'
import { useLanguage } from '../../i18n'

export default function AlertCenterPage() {
  const { t } = useLanguage()
  return (
    <ModulePlaceholder
      title={t('alerts.title')}
      subtitle={t('alerts.emptyState.description')}
      moduleName={t('nav.alerts')}
      phaseNumber="6"
      endpoint="GET /api/v1/alerts"
      expectedFeatures={[
        'Alert categorization: INACTIVITY (non-moving), WARRANTY, MAINTENANCE, and STOCK_LEVEL',
        'Priority tagging: CRITICAL, HIGH, MEDIUM, LOW with accessible visual indicators',
        'Operational actions: Acknowledge, Resolve with remarks, or Snooze for 7/14/30 days',
        'Direct links from alerts to underlying asset, repair ticket, or store balance',
        'Manual on-demand trigger: POST /api/v1/alerts/run-check for immediate background evaluation'
      ]}
    />
  )
}

