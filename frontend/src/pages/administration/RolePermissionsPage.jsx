import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function RolePermissionsPage() {
  return (
    <ModulePlaceholder
      title="Role-Based Access Control (RBAC) Governance"
      subtitle="Inspect and configure granular operational permissions across the three proposed roles"
      moduleName="Roles & Permissions"
      phaseNumber="7"
      endpoint="GET /api/v1/roles, PATCH /api/v1/roles/{id}/permissions"
      expectedFeatures={[
        'Three proposed roles: SYSTEM_ADMIN, STORE_OFFICER, STORE_STAFF',
        'Granular module/action permission matrix (View, Create, Edit, Submit, Review, Approve, Export, Administer)',
        'Defensive authorization: Backend strictly validates permissions on every single API route',
        'Configurable final condemnation/disposal approval authority mapping'
      ]}
    />
  )
}

