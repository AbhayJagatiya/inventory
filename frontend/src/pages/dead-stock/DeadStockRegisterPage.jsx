import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function DeadStockRegisterPage() {
  return (
    <ModulePlaceholder
      title="Official Dead Stock Register"
      subtitle="Statutory register of non-moving and obsolete government-owned inventory"
      moduleName="Dead Stock Register"
      phaseNumber="5"
      endpoint="GET /api/v1/classifications/dead-stock"
      expectedFeatures={[
        'Filtered register exclusively displaying Non-moving and Obsolete items',
        'Detailed statutory columns: Item Code, Category, Acquisition Date, Age, Last Movement, Condition, Recorded Value',
        'Review status tracking: Identified -> Under Assessment -> Recommended for Condemnation -> Closed',
        'Direct bulk-action trigger: Initiate Condemnation Proposal for selected candidates',
        'Government standard PDF/Excel export with official Panchayat letterhead'
      ]}
    />
  )
}

