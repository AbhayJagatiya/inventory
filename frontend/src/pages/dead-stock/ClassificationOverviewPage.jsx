import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function ClassificationOverviewPage() {
  return (
    <ModulePlaceholder
      title="Stock Classification Engine & Overview"
      subtitle="Automated categorization into Active, Slow-moving, Non-moving, and Obsolete stock"
      moduleName="Classification Overview"
      phaseNumber="5"
      endpoint="GET /api/v1/classifications/summary"
      expectedFeatures={[
        'Precedence rule evaluation: Physical condition -> Age lifespan -> Inactivity threshold -> Active',
        'Trigger on-demand classification run via POST /api/v1/classifications/run',
        'Contributing factors drilldown: Displays exact reason why item was flagged (e.g. 210 days inactive)',
        'Authorized Store Officer override with mandatory justification audit record',
        'Clear distinction: Automated suggestion does not authorize legal condemnation or disposal'
      ]}
    />
  )
}

