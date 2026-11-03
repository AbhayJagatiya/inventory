import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { PERMISSIONS } from '../constants/permissions'
import ProtectedRoute from './ProtectedRoute'
import PublicOnlyRoute from './PublicOnlyRoute'
import AppLayout from '../components/layout/AppLayout'

// Auth Pages
import LoginPage from '../pages/auth/LoginPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'

// Dashboard
import DashboardRouter from '../pages/dashboard/DashboardRouter'

// Inventory
import AssetRegisterPage from '../pages/inventory/AssetRegisterPage'
import AssetDetailPage from '../pages/inventory/AssetDetailPage'
import AddEditAssetPage from '../pages/inventory/AddEditAssetPage'
import CategoryListPage from '../pages/inventory/CategoryListPage'
import LocationListPage from '../pages/inventory/LocationListPage'

// Transactions
import TransactionHistoryPage from '../pages/transactions/TransactionHistoryPage'
import ReceiptListPage from '../pages/transactions/ReceiptListPage'
import ReceiptCreatePage from '../pages/transactions/ReceiptCreatePage'
import ReceiptDetailPage from '../pages/transactions/ReceiptDetailPage'
import IssueListPage from '../pages/transactions/IssueListPage'
import IssueCreatePage from '../pages/transactions/IssueCreatePage'
import IssueDetailPage from '../pages/transactions/IssueDetailPage'
import ReturnListPage from '../pages/transactions/ReturnListPage'
import ReturnCreatePage from '../pages/transactions/ReturnCreatePage'
import ReturnDetailPage from '../pages/transactions/ReturnDetailPage'
import TransferListPage from '../pages/transactions/TransferListPage'
import TransferCreatePage from '../pages/transactions/TransferCreatePage'
import TransferDetailPage from '../pages/transactions/TransferDetailPage'

// Dead Stock
import ClassificationOverviewPage from '../pages/dead-stock/ClassificationOverviewPage'
import DeadStockRegisterPage from '../pages/dead-stock/DeadStockRegisterPage'
import CondemnationListPage from '../pages/dead-stock/CondemnationListPage'
import CondemnationDetailPage from '../pages/dead-stock/CondemnationDetailPage'
import DisposalRegisterPage from '../pages/dead-stock/DisposalRegisterPage'

// Verification
import BarcodeLookupPage from '../pages/verification/BarcodeLookupPage'
import VerificationSessionListPage from '../pages/verification/VerificationSessionListPage'
import VerificationSessionDetailPage from '../pages/verification/VerificationSessionDetailPage'

// Suppliers
import SupplierListPage from '../pages/suppliers/SupplierListPage'
import SupplierDetailPage from '../pages/suppliers/SupplierDetailPage'
import ProcurementListPage from '../pages/suppliers/ProcurementListPage'
import ProcurementDetailPage from '../pages/suppliers/ProcurementDetailPage'
import SupplierReturnListPage from '../pages/suppliers/SupplierReturnListPage'
import SupplierReturnDetailPage from '../pages/suppliers/SupplierReturnDetailPage'

// Maintenance
import MaintenanceListPage from '../pages/maintenance/MaintenanceListPage'
import WarrantyListPage from '../pages/maintenance/WarrantyListPage'

// Alerts
import AlertCenterPage from '../pages/alerts/AlertCenterPage'
import NotificationCenterPage from '../pages/alerts/NotificationCenterPage'

// Reports
import ReportsCenterPage from '../pages/reports/ReportsCenterPage'
import ReportViewerPage from '../pages/reports/ReportViewerPage'

// Administration
import UserListPage from '../pages/administration/UserListPage'
import UserDetailPage from '../pages/administration/UserDetailPage'
import RolePermissionsPage from '../pages/administration/RolePermissionsPage'
import OfficeListPage from '../pages/administration/OfficeListPage'
import MasterDataPage from '../pages/administration/MasterDataPage'
import SystemSettingsPage from '../pages/administration/SystemSettingsPage'

// Audit & Profile
import AuditTrailPage from '../pages/audit/AuditTrailPage'
import MyProfilePage from '../pages/profile/MyProfilePage'

// Feedback
import UnauthorizedPage from '../pages/feedback/UnauthorizedPage'
import NotFoundPage from '../pages/feedback/NotFoundPage'

export default function AppRoutes() {
  return (
    <Routes>
      {/* ─── Public Routes ─── */}
      <Route
        path={ROUTES.LOGIN}
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path={ROUTES.FORGOT_PASSWORD}
        element={
          <PublicOnlyRoute>
            <ForgotPasswordPage />
          </PublicOnlyRoute>
        }
      />

      {/* ─── Standalone Error Pages ─── */}
      <Route path={ROUTES.UNAUTHORIZED} element={<UnauthorizedPage />} />

      {/* ─── Authenticated Application Shell ─── */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                {/* Default Redirect to Dashboard */}
                <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />

                {/* Dashboard (Role-Scoped) */}
                <Route path={ROUTES.DASHBOARD} element={<DashboardRouter />} />

                {/* Inventory Register & Items */}
                <Route
                  path={ROUTES.INVENTORY}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.INVENTORY_VIEW}>
                      <AssetRegisterPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.INVENTORY_NEW}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.INVENTORY_CREATE}>
                      <AddEditAssetPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/inventory/:id"
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.INVENTORY_VIEW}>
                      <AssetDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/inventory/:id/edit"
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.INVENTORY_EDIT}>
                      <AddEditAssetPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.INVENTORY_CATEGORIES}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.MASTER_CATEGORIES_VIEW}>
                      <CategoryListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.INVENTORY_LOCATIONS}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.MASTER_LOCATIONS_VIEW}>
                      <LocationListPage />
                    </ProtectedRoute>
                  }
                />

                {/* Stock Transactions */}
                <Route
                  path={ROUTES.TRANSACTIONS}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.STOCK_RECEIPT_VIEW}>
                      <TransactionHistoryPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.RECEIPTS}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.STOCK_RECEIPT_VIEW}>
                      <ReceiptListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.RECEIPTS_NEW}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.STOCK_RECEIPT_CREATE}>
                      <ReceiptCreatePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/transactions/receipts/:id"
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.STOCK_RECEIPT_VIEW}>
                      <ReceiptDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.ISSUES}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.STOCK_ISSUE_VIEW}>
                      <IssueListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.ISSUES_NEW}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.STOCK_ISSUE_CREATE}>
                      <IssueCreatePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/transactions/issues/:id"
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.STOCK_ISSUE_VIEW}>
                      <IssueDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.RETURNS}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.STOCK_RETURN_VIEW}>
                      <ReturnListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.RETURNS_NEW}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.STOCK_RETURN_CREATE}>
                      <ReturnCreatePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/transactions/returns/:id"
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.STOCK_RETURN_VIEW}>
                      <ReturnDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.TRANSFERS}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.STOCK_TRANSFER_VIEW}>
                      <TransferListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.TRANSFERS_NEW}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.STOCK_TRANSFER_REQ}>
                      <TransferCreatePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/transactions/transfers/:id"
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.STOCK_TRANSFER_VIEW}>
                      <TransferDetailPage />
                    </ProtectedRoute>
                  }
                />

                {/* Dead Stock & Condemnation */}
                <Route
                  path={ROUTES.DEAD_STOCK}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.CLASSIFY_VIEW}>
                      <ClassificationOverviewPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.DEAD_STOCK_REGISTER}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.CLASSIFY_VIEW}>
                      <DeadStockRegisterPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.CONDEMNATIONS}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.CONDEMN_VIEW}>
                      <CondemnationListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dead-stock/condemnations/:id"
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.CONDEMN_VIEW}>
                      <CondemnationDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.DISPOSALS}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.DISPOSAL_VIEW}>
                      <DisposalRegisterPage />
                    </ProtectedRoute>
                  }
                />

                {/* Barcode & Physical Verification */}
                <Route
                  path={ROUTES.BARCODE_LOOKUP}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.BARCODE_SCAN}>
                      <BarcodeLookupPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.VERIFICATION_SESSIONS}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.VERIFY_VIEW}>
                      <VerificationSessionListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/verification/sessions/:id"
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.VERIFY_VIEW}>
                      <VerificationSessionDetailPage />
                    </ProtectedRoute>
                  }
                />

                {/* Suppliers & Procurement */}
                <Route
                  path={ROUTES.SUPPLIERS}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.SUPPLIER_VIEW}>
                      <SupplierListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/suppliers/:id"
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.SUPPLIER_VIEW}>
                      <SupplierDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.PROCUREMENT}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.SUPPLIER_VIEW}>
                      <ProcurementListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/suppliers/procurement/:id"
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.SUPPLIER_VIEW}>
                      <ProcurementDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.SUPPLIER_RETURNS}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.SUPPLIER_RMA_VIEW}>
                      <SupplierReturnListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/suppliers/returns/:id"
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.SUPPLIER_RMA_VIEW}>
                      <SupplierReturnDetailPage />
                    </ProtectedRoute>
                  }
                />

                {/* Maintenance & Warranties */}
                <Route
                  path={ROUTES.MAINTENANCE}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.MAINTENANCE_VIEW}>
                      <MaintenanceListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.WARRANTIES}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.WARRANTY_VIEW}>
                      <WarrantyListPage />
                    </ProtectedRoute>
                  }
                />

                {/* Alerts & Notifications */}
                <Route
                  path={ROUTES.ALERTS}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.ALERTS_VIEW}>
                      <AlertCenterPage />
                    </ProtectedRoute>
                  }
                />
                <Route path={ROUTES.NOTIFICATIONS} element={<NotificationCenterPage />} />

                {/* Reports */}
                <Route
                  path={ROUTES.REPORTS}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.REPORTS_VIEW}>
                      <ReportsCenterPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports/:reportType"
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.REPORTS_VIEW}>
                      <ReportViewerPage />
                    </ProtectedRoute>
                  }
                />

                {/* Administration */}
                <Route
                  path={ROUTES.USERS}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.USERS_VIEW}>
                      <UserListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/administration/users/:id"
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.USERS_VIEW}>
                      <UserDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.ROLES}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.ROLES_VIEW}>
                      <RolePermissionsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.OFFICES}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.OFFICES_VIEW}>
                      <OfficeListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.MASTER_DATA}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.MASTER_LOCATIONS_VIEW}>
                      <MasterDataPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path={ROUTES.SETTINGS}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.SETTINGS_VIEW}>
                      <SystemSettingsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Audit & Profile */}
                <Route
                  path={ROUTES.AUDIT}
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.AUDIT_VIEW}>
                      <AuditTrailPage />
                    </ProtectedRoute>
                  }
                />
                <Route path={ROUTES.PROFILE} element={<MyProfilePage />} />

                {/* Inside App 404 */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

