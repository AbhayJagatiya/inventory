import ModulePlaceholder from '../../components/common/ModulePlaceholder'

export default function UserListPage() {
  return (
    <ModulePlaceholder
      title="User Account Management"
      subtitle="Govern store personnel accounts, role assignments, and office scopes"
      moduleName="User Management"
      phaseNumber="7"
      endpoint="GET /api/v1/users"
      expectedFeatures={[
        'User accounts list with Full Name, Username, Designation, Assigned Office, Role, and Status',
        'Account lifecycle actions: Create User, Edit Designation, Activate, Deactivate, or Lock Account',
        'Admin-assisted temporary password reset flow with mandatory first-login password change',
        'Historical referential integrity: Users linked to past transactions cannot be permanently deleted',
        'Audit logging on every account status or privilege modification'
      ]}
    />
  )
}

