# Untranslated Content & Free-Text Report — DSIMS

**Branch:** `feature/complete-multilingual-support`  
**Audit Date:** 2026-11-26

---

## 1. Intentionally Preserved Untranslated Data
To preserve statutory audit integrity and database consistency, the following user-entered and identifier fields are **intentionally not translated**:
- Asset codes, barcode numbers, serial numbers, voucher numbers, PO/invoice numbers
- Asset/item names, brand names, model numbers
- Supplier names, employee/custodian names, office names, addresses
- User-entered remarks, notes, and historical descriptions

## 2. Free-Text Translation Limitation
- No external machine-translation provider (e.g., Google Cloud Translation / Azure Translator) is configured in this repository.
- Free-text user-entered descriptions and remarks remain in their original entered language.

## 3. Unimplemented Future-Phase Modules
The following routes render `ModulePlaceholder` (their shell, titles, subtitles, and navigation actions are translated, while their `expectedFeatures` bullet list remains English architectural notes):
- `administration/*` (`MasterDataPage`, `OfficeListPage`, `RolePermissionsPage`, `SystemSettingsPage`, `UserDetailPage`, `UserListPage`)
- `maintenance/*` (`MaintenanceListPage`, `WarrantyListPage`)
- `suppliers/*` (`ProcurementDetailPage`, `ProcurementListPage`, `SupplierDetailPage`, `SupplierListPage`, `SupplierReturnDetailPage`, `SupplierReturnListPage`)
- `alerts/*` (`AlertCenterPage`, `NotificationCenterPage`)
- `reports/*` (`ReportsCenterPage`, `ReportViewerPage`)
- `audit/AuditTrailPage`
