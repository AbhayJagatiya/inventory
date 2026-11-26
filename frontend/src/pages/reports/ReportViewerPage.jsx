import ModulePlaceholder from '../../components/common/ModulePlaceholder'
import { useLanguage } from '../../i18n'

export default function ReportViewerPage() {
  const { t } = useLanguage()
  return (
    <ModulePlaceholder
      title={t('reports.viewer.title')}
      subtitle={t('reports.generate')}
      moduleName={t('reports.viewer.title')}
      phaseNumber="7"
      endpoint="GET /api/v1/reports/{reportType}"
      expectedFeatures={[
        'Interactive preview table with sorting, server-side pagination, and summary total rows',
        'Direct drill-down links from table rows to underlying asset profiles and transaction vouchers',
        'Export modal: Choose CSV, XLSX, or PDF format with official header & page numbering',
        'Generation timestamp, applied parameter filters, and official signing authority blocks'
      ]}
    />
  )
}

