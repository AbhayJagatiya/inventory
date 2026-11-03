import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function MasterDataPage() {
  return (
    <ModulePlaceholder
      title="Master Reference Data"
      subtitle="Standardize Units of Measure, condition values, operational reasons, and disposal methods"
      moduleName="Master Data"
      phaseNumber="7"
      endpoint="GET /api/v1/units-of-measure"
      expectedFeatures={[
        'Units of Measure (UOM) master: NOS, BOX, KG, MTR, PACKET, SET, REAM',
        'Standard operational condition taxonomies: GOOD, FAIR, DAMAGED, SCRAP',
        'Transaction justification reason codes and disposal method definitions',
        'Safe deactivation controls preventing removal of codes used in historical vouchers'
      ]}
    />
  )
}

