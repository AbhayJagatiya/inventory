# Project Development Rules

## Purpose and Scope
Build the Web-Based Dead Stock Inventory Management System for District Panchayat, Gir Somnath, Veraval. Implement only approved phases and requirements; do not begin business modules until authorized.

## Authoritative Requirements
Before implementing any module, read all eight approved documents in `docs/`: `requirements-checklist.md`, `architecture.md`, `database-design.md`, `api-contract.md`, `role-permissions-matrix.md`, `workflows.md`, `feature-traceability-matrix.md`, and `known-limitations.md`. Treat them as authoritative. Do not silently change requirements; report genuine contradictions.

## Approved Stack
- Frontend: React 18, Vite 5, TypeScript, Tailwind CSS 3, React Router 6, Recharts, Lucide React.
- Backend: Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, PostgreSQL 15+, PyJWT, Argon2.

## Architecture and Folders
- `frontend/` contains the SPA, API client, shared components, pages, and auth state.
- `backend/app/` separates API routes, core configuration/security, database models, schemas, and services; `backend/alembic/` owns versioned migrations and `backend/tests/` owns automated tests.
- Keep the API under `/api/v1`; preserve the documented JSON envelope. Keep business modules out until their approved phase.

## Database and API Rules
- Use normalized PostgreSQL schemas, explicit constraints, restrictive deletes for records, and versioned Alembic migrations.
- Enforce office integrity in both database constraints and application authorization. Scope every office-owned query to the authenticated user; only the documented System Admin role may cross office boundaries.
- Keep API paths, payloads, permission codes, response envelopes, and error semantics aligned with `docs/api-contract.md`.

## Security and RBAC
- Use Argon2 password hashes and signed, expiring JWTs. Load secrets and database credentials only from environment configuration; never commit them.
- Enforce permissions on the backend, deny by default, and use only exact permission codes in the approved RBAC matrix. Configurable condemnation/disposal authority must remain ungranted until configured; never hardcode a legal approver.
- Do not trust client-supplied office IDs, role claims, or UI route guards as authorization.

## Coding and Testing
- Use type hints, focused modules, structured validation, safe errors, and useful logs without secrets or passwords.
- Add tests for changed behavior, especially authentication, permission denials, office isolation, constraints, and API contracts. Run backend tests and frontend production builds before reporting completion.

## Collaboration, Git, and Documentation
- Ninu owns frontend work; the project owner owns backend and database work. Coordinate through stable API contracts and document integration changes.
- Never commit secrets, rewrite approved requirements, or claim unrun checks passed. Do not commit or initialize Git unless explicitly asked. Update operational documentation when commands or contracts change.