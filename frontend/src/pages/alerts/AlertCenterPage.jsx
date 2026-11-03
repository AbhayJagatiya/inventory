import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function AlertCenterPage() {
  return (
    <ModulePlaceholder
      title="Proactive System Alerts Center"
      subtitle="Automated alerts for non-moving stock, expiring warranties, maintenance due, and stock shortages"
      moduleName="Alerts Center"
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

