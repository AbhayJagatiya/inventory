# Database Display Localization Strategy — DSIMS

## 1. Core Principle
Database records, primary keys, internal enum codes, asset codes, barcodes, serial numbers, and API contracts are **never modified or overwritten** for localization. All localization happens at the **presentation layer** (`frontend/src/i18n/enumLabels.js` and `backend/app/core/i18n.py`).

## 2. Controlled Enum & Status Values
Internal backend/PostgreSQL enum values are mapped via `ENUM_TRANSLATION_KEYS` in `frontend/src/i18n/enumLabels.js` and `ENUM_VALUE_TRANSLATIONS` in `backend/app/core/i18n.py`:
- **Conditions:** `GOOD`, `FAIR`, `DAMAGED`, `SCRAP`
- **Item Types:** `DURABLE_ASSET`, `CONSUMABLE_STOCK`
- **Operational Statuses:** `AVAILABLE_IN_STORE`, `IN_USE`, `UNDER_MAINTENANCE`, `DISPATCHED_TO_VENDOR`, `PENDING_CONDEMNATION`, `PENDING_DISPOSAL`, `DISPOSED`
- **Classifications:** `ACTIVE`, `SLOW_MOVING`, `NON_MOVING`, `OBSOLETE`
- **Transaction Types & Statuses:** `RECEIPT`, `ISSUE`, `RETURN`, `TRANSFER`, `DRAFT`, `POSTED`, `SUBMITTED`, `APPROVED`, `REJECTED`, `UNDER_REVIEW`, `MORE_INFO_REQUIRED`, `IN_TRANSIT`, `COMPLETED`, `CANCELLED`
- **Disposal Methods, Alert Types/Priorities, Roles, Location Types, Scope Types**

`StatusBadge.jsx` automatically uses `translateEnum(t, status)` so every table, card, and detail page renders localized status badges.

## 3. User-Entered & Free-Text Data
User-entered and proper-noun fields are preserved **verbatim** to maintain statutory and audit integrity:
- Asset/item names, brand/model numbers, serial numbers, asset codes, barcode values
- Supplier names, employee/custodian names, office names, addresses
- Invoice/PO/voucher numbers, user-entered remarks and notes

No external machine-translation API provider is configured in this repository; free-text user remarks remain in their original entered language.
