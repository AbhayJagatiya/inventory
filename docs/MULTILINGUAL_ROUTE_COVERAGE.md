# DSIMS Multilingual Route Coverage

**Branch:** `feature/complete-multilingual-support`  
**Languages:** English (`en`), Hindi (`hi` / हिन्दी), Gujarati (`gu` / ગુજરાતી)  
**Dictionary Parity:** 1,380 keys in `en.js`, `hi.js`, `gu.js` — **0 missing/raw `t()` keys**

| Route | Component | English | Hindi | Gujarati | Notes |
|---|---|---|---|---|---|
| `/login` | `LoginPage` | Complete | Complete | Complete | Includes `LanguageSelector` in `AuthLayout` |
| `/forgot-password` | `ForgotPasswordPage` | Complete | Complete | Complete | Includes `LanguageSelector` in `AuthLayout` |
| `/unauthorized` | `UnauthorizedPage` | Complete | Complete | Complete | Localized title, message, and CTA |
| `/dashboard` | `AdminDashboard` / `OfficerDashboard` / `StaffDashboard` | Complete | Complete | Complete | All KPIs, charts, quick actions, and alerts localized |
| `/inventory` | `AssetRegisterPage` | Complete | Complete | Complete | Columns, delete toast, and `StatusBadge` enums localized |
| `/inventory/new`, `/inventory/:id/edit` | `AddEditAssetPage` | Complete | Complete | Complete | All 3 form sections, labels, placeholders, dropdown options (`Good (Operational & Sound)` etc.), and buttons localized |
| `/inventory/:id` | `AssetDetailPage` | Complete | Complete | Complete | Header, print, status badges, and error state localized |
| `/inventory/categories` | `CategoryListPage` | Complete | Complete | Complete | All labels, thresholds, and messages localized |
| `/inventory/locations` | `LocationListPage` | Complete | Complete | Complete | All labels, room/building fields, and messages localized |
| `/transactions` | `TransactionHistoryPage` | Complete | Complete | Complete | Ledger headers, filters, and CSV export headers localized |
| `/transactions/receipts` | `ReceiptListPage` | Complete | Complete | Complete | All `transactions.receipts.*` keys resolved (0 raw keys) |
| `/transactions/receipts/new` | `ReceiptCreatePage` | Complete | Complete | Complete | GRN validation, form, and actions localized |
| `/transactions/receipts/:id` | `ReceiptDetailPage` | Complete | Complete | Complete | Header, print, post confirmation, and status localized |
| `/transactions/issues`, `new`, `:id` | `IssueListPage` / `IssueCreatePage` / `IssueDetailPage` | Wired | Wired | Wired | Uses centralized `StatusBadge` & shared layout |
| `/transactions/returns`, `new`, `:id` | `ReturnListPage` / `ReturnCreatePage` / `ReturnDetailPage` | Complete | Complete | Complete | Fixed mixed-language headers in `ReturnListPage` |
| `/transactions/transfers`, `new`, `:id` | `TransferListPage` / `TransferCreatePage` / `TransferDetailPage` | Wired | Wired | Wired | Uses centralized `StatusBadge` & shared layout |
| `/dead-stock` | `ClassificationOverviewPage` | Complete | Complete | Complete | All 4 KPIs, 2 secondary cards, 5 Gujarat GFR precedence rules, and legal note localized |
| `/dead-stock/register` | `DeadStockRegisterPage` | Complete | Complete | Complete | Wired with `useLanguage()` and `StatusBadge` |
| `/dead-stock/condemnations`, `:id` | `CondemnationListPage` / `CondemnationDetailPage` | Complete | Complete | Complete | Wired with `useLanguage()` and `StatusBadge` |
| `/dead-stock/disposals` | `DisposalRegisterPage` | Complete | Complete | Complete | Wired with `useLanguage()` and `StatusBadge` |
| `/verification/lookup` | `BarcodeLookupPage` | Complete | Complete | Complete | Header, scan instructions, and error/success toasts localized |
| `/verification/sessions`, `:id` | `VerificationSessionListPage` / `VerificationSessionDetailPage` | Complete | Complete | Complete | Wired with `useLanguage()` and `StatusBadge` |
| `/suppliers/*`, `/maintenance/*`, `/alerts`, `/notifications`, `/reports/*`, `/administration/*`, `/audit` | `ModulePlaceholder` pages | Complete | Complete | Complete | Placeholder shell, titles, and navigation localized |
| `/profile` | `MyProfilePage` | Complete | Complete | Complete | Profile card, password form, and permissions localized |
| `*` | `NotFoundPage` | Complete | Complete | Complete | Localized 404 title, message, and CTA |
