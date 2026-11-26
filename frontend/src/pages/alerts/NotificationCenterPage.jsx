import ModulePlaceholder from '../../components/common/ModulePlaceholder'
import { useLanguage } from '../../i18n'

export default function NotificationCenterPage() {
  const { t } = useLanguage()
  return (
    <ModulePlaceholder
      title={t('alerts.notifications.title')}
      subtitle={t('alerts.notifications.noNotifications')}
      moduleName={t('nav.notifications')}
      phaseNumber="6"
      endpoint="GET /api/v1/notifications"
      expectedFeatures={[
        'Personalized notification stream for logged-in user with unread indicator badge',
        'Mark individual notifications as read or batch "Mark All as Read"',
        'One-click deep link to navigate directly to referenced voucher, asset, or session',
        'Clear empty and loaded states with real-time polling'
      ]}
    />
  )
}

