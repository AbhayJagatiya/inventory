# PS000214 – Dead Stock Inventory Management System
### District Development Office – Gir Somnath, Veraval
**Department:** Store Department, District Panchayat, Gir Somnath  
**Problem Statement:** PS000214  

---

## 🏛️ Project Overview
A web-based, role-governed Dead Stock Inventory Management System built for the District Panchayat Office, Gir Somnath (Veraval). The system automates and secures the complete lifecycle of government assets and office consumables:
- **Registration & Dual Inventory Tracking**: Durable capital assets with unique barcode identities and quantity-based office supplies.
- **Transaction Ledger**: Immutable audit-proof recording of Receipts, Issues, Returns, and Transfers.
- **Classification Engine**: Dynamic calculation of Active, Slow-moving, Non-moving, and Obsolete inventory based on usage history and age.
- **Physical Verification**: Audit sessions with barcode/QR scanning and automated discrepancy detection.
- **Condemnation & Disposal Workflow**: Multi-tier review, survey committee approval, and regulated disposal execution (auction, scrap, e-waste).
- **Proactive Alerts & Monitoring**: Automated notifications for non-moving items, maintenance schedules, and expiring warranties.
- **Comprehensive Reports**: 12 official government registers with CSV, XLSX, and printable PDF exports.

---

## 🛠️ Technology Stack
- **Frontend**: React 18+, Vite, TypeScript, Tailwind CSS, React Router v6, Recharts, Lucide Icons, html5-qrcode.
- **Backend**: Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic, PostgreSQL.
- **Security**: JWT authentication, Argon2 password hashing, granular Role-Based Access Control (RBAC), office-level data isolation.

---

## 📂 Project Documentation
All formal architectural designs, API specifications, and workflow models are maintained in the [`docs/`](file:///c:/Users/abhij/OneDrive/Desktop/SFIC/Dead%20Stock%20Inventory%20Management%20System/docs) folder:
- [Requirements Checklist](file:///c:/Users/abhij/OneDrive/Desktop/SFIC/Dead%20Stock%20Inventory%20Management%20System/docs/requirements-checklist.md)
- [System Architecture](file:///c:/Users/abhij/OneDrive/Desktop/SFIC/Dead%20Stock%20Inventory%20Management%20System/docs/architecture.md)
- [Database Design & ERD](file:///c:/Users/abhij/OneDrive/Desktop/SFIC/Dead%20Stock%20Inventory%20Management%20System/docs/database-design.md)
- [API Contract Specification](file:///c:/Users/abhij/OneDrive/Desktop/SFIC/Dead%20Stock%20Inventory%20Management%20System/docs/api-contract.md)
- [Role & Permissions Matrix](file:///c:/Users/abhij/OneDrive/Desktop/SFIC/Dead%20Stock%20Inventory%20Management%20System/docs/role-permissions-matrix.md)
- [Workflow Diagrams](file:///c:/Users/abhij/OneDrive/Desktop/SFIC/Dead%20Stock%20Inventory%20Management%20System/docs/workflows.md)
- [Feature Traceability Matrix](file:///c:/Users/abhij/OneDrive/Desktop/SFIC/Dead%20Stock%20Inventory%20Management%20System/docs/feature-traceability-matrix.md)
- [Known Limitations & Ambiguities](file:///c:/Users/abhij/OneDrive/Desktop/SFIC/Dead%20Stock%20Inventory%20Management%20System/docs/known-limitations.md)
- [Deployment & Operations Guide](file:///c:/Users/abhij/OneDrive/Desktop/SFIC/Dead%20Stock%20Inventory%20Management%20System/docs/deployment-guide.md)
- [Testing & Quality Assurance Report](file:///c:/Users/abhij/OneDrive/Desktop/SFIC/Dead%20Stock%20Inventory%20Management%20System/docs/testing-report.md)

---

## 👥 Functional User Roles
1. **System Admin**: Technical administrator, user accounts, system configuration, audit logs, cross-office administration.
2. **Store Officer**: Supervisory custodian, physical verification lead, dead-stock review, transfer approvals, condemnation review.
3. **Store Staff**: Day-to-day operations, asset registration, stock inward receipt, stock outward issuance, returns, and barcode scanning.

---

## 📍 Operational Scope
- Initial active operational data is strictly scoped to **Veraval** (`District Panchayat, Gir Somnath`).
- The underlying architecture and database schema are fully multi-office ready for future district-wide rollout.

---

## Phase 0 Development Setup

The repository is organized into `frontend/` (React SPA), `backend/` (FastAPI API and Alembic migrations), and `docs/` (approved requirements). See [`AGENTS.md`](AGENTS.md) for implementation guardrails.

### Prerequisites

- Python 3.11+, Node.js 20+, and PostgreSQL 15+.
- Copy `.env.example` to `.env`; configure `DATABASE_URL` and a randomly generated `JWT_SECRET_KEY` of at least 32 characters. Never commit `.env`.
- Create the PostgreSQL database and apply its initial migration before using authenticated endpoints.

### Run the Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

The health endpoint is `http://127.0.0.1:8000/api/v1/health`; API docs are at `http://127.0.0.1:8000/docs`.

### Run the Frontend

```powershell
cd frontend
npm install
npm run dev
```

The frontend defaults to `http://127.0.0.1:8000/api/v1`. Set `VITE_API_BASE_URL` when the backend uses another origin. No initial user or password is seeded; accounts must be provisioned through a future approved administrative workflow.
