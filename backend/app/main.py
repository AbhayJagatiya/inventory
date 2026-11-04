"""FastAPI Application Entry Point

Dead Stock Inventory Management System – PS000214
District Panchayat, Gir Somnath, Veraval
"""

import logging
from contextlib import asynccontextmanager


from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.exceptions import (
    AppException,
    app_exception_handler,
    generic_exception_handler,
    starlette_http_exception_handler,
    validation_exception_handler,
)
from app.core.logging import RequestCorrelationMiddleware

logger = logging.getLogger("app.main")


# ---------------------------------------------------------------------------
# Lifespan: DB seed on startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle handler."""
    try:
        logger.info("Starting Dead Stock Inventory Management System backend...")
        from app.db_init import initialize_database
        initialize_database()
        logger.info("Database initialization complete.")
    except Exception as exc:
        logger.error(f"Database initialization failed: {exc}", exc_info=True)
        # Do not crash the app; let health check surface the issue.

    yield

    logger.info("Application shutting down.")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    application = FastAPI(
        title="Dead Stock Inventory Management System – PS000214",
        description=(
            "Web-Based Dead Stock Inventory Management System for "
            "District Panchayat, Gir Somnath, Veraval, Gujarat."
        ),
        version="1.0.0",
        openapi_url="/api/v1/openapi.json",
        docs_url="/api/v1/docs",
        redoc_url="/api/v1/redoc",
        lifespan=lifespan,
    )

    # ------------------------------------------------------------------
    # Middleware
    # ------------------------------------------------------------------
    application.add_middleware(RequestCorrelationMiddleware)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ------------------------------------------------------------------
    # Exception handlers
    # ------------------------------------------------------------------
    application.add_exception_handler(AppException, app_exception_handler)
    application.add_exception_handler(RequestValidationError, validation_exception_handler)
    application.add_exception_handler(StarletteHTTPException, starlette_http_exception_handler)
    application.add_exception_handler(Exception, generic_exception_handler)

    # ------------------------------------------------------------------
    # Routes
    # ------------------------------------------------------------------
    _register_routes(application)

    return application


def _register_routes(application: FastAPI) -> None:
    from app.routes.auth import router as auth_router
    from app.routes.users import router as users_router
    from app.routes.roles import router as roles_router
    from app.routes.offices import router as offices_router
    from app.routes.locations import router as locations_router
    from app.routes.categories import router as categories_router
    from app.routes.suppliers import router as suppliers_router
    from app.routes.procurement import router as procurement_router
    from app.routes.inventory import router as inventory_router
    from app.routes.ledger import router as ledger_router
    from app.routes.stock_receipts import router as stock_receipts_router
    from app.routes.stock_issues import router as stock_issues_router
    from app.routes.stock_returns import router as stock_returns_router
    from app.routes.stock_transfers import router as stock_transfers_router
    from app.routes.classification import router as classification_router
    from app.routes.barcodes import router as barcodes_router
    from app.routes.verification import router as verification_router
    from app.routes.warranties import router as warranties_router
    from app.routes.maintenance import router as maintenance_router
    from app.routes.alerts import router as alerts_router
    from app.routes.condemnation import router as condemnation_router
    from app.routes.disposal import router as disposal_router
    from app.routes.documents import router as documents_router
    from app.routes.reports import router as reports_router
    from app.routes.settings import router as settings_router
    from app.routes.audit import router as audit_router
    from app.routes.units_of_measure import router as uom_router
    from app.routes.supplier_returns import router as supplier_returns_router

    PREFIX = "/api/v1"

    application.include_router(auth_router, prefix=f"{PREFIX}/auth", tags=["Authentication"])
    application.include_router(users_router, prefix=f"{PREFIX}/users", tags=["Users"])
    application.include_router(roles_router, prefix=f"{PREFIX}/roles", tags=["Roles & Permissions"])
    application.include_router(offices_router, prefix=f"{PREFIX}/offices", tags=["Offices"])
    application.include_router(locations_router, prefix=f"{PREFIX}/locations", tags=["Locations"])
    application.include_router(categories_router, prefix=f"{PREFIX}/categories", tags=["Categories"])
    application.include_router(suppliers_router, prefix=f"{PREFIX}/suppliers", tags=["Suppliers"])
    application.include_router(procurement_router, prefix=f"{PREFIX}/procurements", tags=["Procurement"])
    application.include_router(inventory_router, prefix=f"{PREFIX}/items", tags=["Inventory"])
    application.include_router(
    uom_router,
    prefix=f"{PREFIX}/units-of-measure",
    tags=["Units of Measure"],
)
    application.include_router(
    supplier_returns_router,
    prefix=f"{PREFIX}/supplier-returns",
    tags=["Supplier Returns / RMA"],
)
    
    # Ledger: unified router + alias routers for PDF-spec paths
    application.include_router(ledger_router, prefix=f"{PREFIX}/transactions", tags=["Ledger / Transactions"])
    application.include_router(stock_receipts_router, prefix=f"{PREFIX}/receipts", tags=["Stock Receipts"])
    application.include_router(stock_issues_router, prefix=f"{PREFIX}/issues", tags=["Stock Issues"])
    application.include_router(stock_returns_router, prefix=f"{PREFIX}/returns", tags=["Stock Returns"])
    application.include_router(stock_transfers_router, prefix=f"{PREFIX}/transfers", tags=["Stock Transfers"])
    application.include_router(stock_receipts_router, prefix=f"{PREFIX}/transactions/receipts", tags=["Stock Receipts (Alias)"])
    application.include_router(stock_issues_router, prefix=f"{PREFIX}/transactions/issues", tags=["Stock Issues (Alias)"])
    application.include_router(stock_returns_router, prefix=f"{PREFIX}/transactions/returns", tags=["Stock Returns (Alias)"])
    application.include_router(stock_transfers_router, prefix=f"{PREFIX}/transactions/transfers", tags=["Stock Transfers (Alias)"])

    application.include_router(classification_router, prefix=f"{PREFIX}/classifications", tags=["Classification"])
    application.include_router(barcodes_router, prefix=f"{PREFIX}/barcodes", tags=["Barcodes"])
    application.include_router(verification_router, prefix=f"{PREFIX}/verifications", tags=["Verification"])
    application.include_router(warranties_router, prefix=f"{PREFIX}/warranties", tags=["Warranties"])
    application.include_router(maintenance_router, prefix=f"{PREFIX}/maintenance", tags=["Maintenance"])
    application.include_router(alerts_router, prefix=f"{PREFIX}/alerts", tags=["Alerts & Notifications"])
    application.include_router(condemnation_router, prefix=f"{PREFIX}/condemnations", tags=["Condemnation"])
    application.include_router(disposal_router, prefix=f"{PREFIX}/disposals", tags=["Disposal"])
    application.include_router(documents_router, prefix=f"{PREFIX}/documents", tags=["Documents"])
    application.include_router(reports_router, prefix=f"{PREFIX}/reports", tags=["Reports & Dashboard"])
    application.include_router(reports_router, prefix=f"{PREFIX}/dashboard", tags=["Dashboard (Alias)"])
    application.include_router(settings_router, prefix=f"{PREFIX}/settings", tags=["Settings"])
    application.include_router(audit_router, prefix=f"{PREFIX}/audit", tags=["Audit Logs"])


# ---------------------------------------------------------------------------
# Health check (outside /api/v1 prefix intentionally)
# ---------------------------------------------------------------------------

app = create_app()


@app.get("/docs", include_in_schema=False)
def docs_redirect():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/api/v1/docs")


@app.get("/redoc", include_in_schema=False)
def redoc_redirect():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/api/v1/redoc")


@app.get("/openapi.json", include_in_schema=False)
def openapi_redirect():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/api/v1/openapi.json")


@app.get("/health", tags=["Health"])
def health_check():
    """Lightweight health probe for load balancers and monitoring."""
    from app.core.database import check_db_connectivity
    db_ok = check_db_connectivity()
    return {
        "success": True,
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
        "version": "1.0.0",
    }

