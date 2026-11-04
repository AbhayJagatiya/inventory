
"""Reports, Dashboards and Export API Routes."""

from io import BytesIO
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission
from app.core.exceptions import OfficeAccessDeniedError, ValidationError
from app.core.permissions import ROLE_SYSTEM_ADMIN, ROLE_STORE_OFFICER

from app.features.reports.schemas import ExportRequest
from app.features.reports.services import ReportsService
from app.features.users.models import User


router = APIRouter()


ALLOWED_REPORTS = {
    "stock-register",
    "asset-register",
    "stock-quantity",
    "asset-valuation",
    "movements",
    "dead-stock",
    "condemnations",
    "disposals",
    "suppliers-procurement",
    "warranties",
    "maintenance",
    "physical-verification",
}


def _resolve_office(office_id: Optional[UUID], user: User) -> Optional[UUID]:
    if ROLE_SYSTEM_ADMIN in user.role_names:
        return office_id

    if office_id is not None and office_id != user.office_id:
        raise OfficeAccessDeniedError(
            "You cannot access reports outside your assigned office"
        )

    return user.office_id


def _get_report(db: Session, report_name: str, office_id: Optional[UUID]):
    if report_name not in ALLOWED_REPORTS:
        raise ValidationError(
            f"Unsupported report name: {report_name}",
            code="UNSUPPORTED_REPORT",
        )

    headers, rows = ReportsService.get_report_data(
        db=db,
        report_name=report_name,
        office_id=office_id,
    )

    return {"headers": headers, "rows": rows}


@router.get(
    "/dashboard",
    response_model=StandardSuccessResponse,
    dependencies=[Depends(require_permission("reports:view"))],
)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if ROLE_SYSTEM_ADMIN in current_user.role_names:
        dashboard = ReportsService.get_admin_dashboard(db, current_user)
    elif ROLE_STORE_OFFICER in current_user.role_names:
        dashboard = ReportsService.get_officer_dashboard(db, current_user)
    else:
        dashboard = ReportsService.get_staff_dashboard(db, current_user)

    return StandardSuccessResponse(
        success=True,
        message="Dashboard retrieved successfully",
        data=dashboard,
    )


@router.get(
    "/alerts-summary",
    response_model=StandardSuccessResponse,
    dependencies=[Depends(require_permission("reports:view"))],
)
def get_alerts_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = ReportsService.get_alerts_summary(db, current_user)

    return StandardSuccessResponse(
        success=True,
        message="Alerts summary retrieved successfully",
        data=result,
    )


def _report_response(
    report_name: str,
    office_id: Optional[UUID],
    db: Session,
    current_user: User,
):
    resolved_office = _resolve_office(office_id, current_user)
    report = _get_report(db, report_name, resolved_office)

    return StandardSuccessResponse(
        success=True,
        message=f"{report_name} report retrieved successfully",
        data=report,
    )


@router.get("/stock-register", response_model=StandardSuccessResponse,
            dependencies=[Depends(require_permission("reports:view"))])
def stock_register(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _report_response("stock-register", office_id, db, current_user)


@router.get("/asset-register", response_model=StandardSuccessResponse,
            dependencies=[Depends(require_permission("reports:view"))])
def asset_register(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _report_response("asset-register", office_id, db, current_user)


@router.get("/stock-quantity", response_model=StandardSuccessResponse,
            dependencies=[Depends(require_permission("reports:view"))])
def stock_quantity(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _report_response("stock-quantity", office_id, db, current_user)


@router.get("/asset-valuation", response_model=StandardSuccessResponse,
            dependencies=[Depends(require_permission("reports:view"))])
def asset_valuation(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _report_response("asset-valuation", office_id, db, current_user)


@router.get("/movements", response_model=StandardSuccessResponse,
            dependencies=[Depends(require_permission("reports:view"))])
def movements(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _report_response("movements", office_id, db, current_user)


@router.get("/dead-stock", response_model=StandardSuccessResponse,
            dependencies=[Depends(require_permission("reports:view"))])
def dead_stock(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _report_response("dead-stock", office_id, db, current_user)


@router.get("/condemnations", response_model=StandardSuccessResponse,
            dependencies=[Depends(require_permission("reports:view"))])
def condemnations(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _report_response("condemnations", office_id, db, current_user)


@router.get("/disposals", response_model=StandardSuccessResponse,
            dependencies=[Depends(require_permission("reports:view"))])
def disposals(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _report_response("disposals", office_id, db, current_user)


@router.get("/suppliers-procurement", response_model=StandardSuccessResponse,
            dependencies=[Depends(require_permission("reports:view"))])
def suppliers_procurement(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _report_response("suppliers-procurement", office_id, db, current_user)


@router.get("/warranties", response_model=StandardSuccessResponse,
            dependencies=[Depends(require_permission("reports:view"))])
def warranties(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _report_response("warranties", office_id, db, current_user)


@router.get("/maintenance", response_model=StandardSuccessResponse,
            dependencies=[Depends(require_permission("reports:view"))])
def maintenance_report(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _report_response("maintenance", office_id, db, current_user)


@router.get("/physical-verification", response_model=StandardSuccessResponse,
            dependencies=[Depends(require_permission("reports:view"))])
def physical_verification(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _report_response("physical-verification", office_id, db, current_user)


@router.post(
    "/generate-export",
    dependencies=[Depends(require_permission("reports:export"))],
)
def generate_export(
    payload: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    office_id = _resolve_office(payload.office_id, current_user)
    report = _get_report(db, payload.report_name, office_id)

    headers = report["headers"]
    rows = report["rows"]
    export_format = payload.format.lower()

    if export_format == "csv":
        content = ReportsService.export_to_csv(headers, rows).encode("utf-8-sig")
        media_type = "text/csv"
        extension = "csv"

    elif export_format == "xlsx":
        content = ReportsService.export_to_xlsx(
            payload.report_name, headers, rows
        )
        media_type = (
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        )
        extension = "xlsx"

    elif export_format == "pdf":
        content = ReportsService.export_to_pdf(
            payload.report_name, headers, rows
        )
        media_type = "application/pdf"
        extension = "pdf"

    else:
        raise ValidationError("Unsupported export format")

    filename = f"{payload.report_name}.{extension}"

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
        status_code=status.HTTP_200_OK,
    )
