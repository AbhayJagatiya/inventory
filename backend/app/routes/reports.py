"""Reports, Dashboards and Export API Routes."""

from datetime import date
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.common_schemas import ResponseMeta, StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission
from app.core.exceptions import OfficeAccessDeniedError, ValidationError
from app.core.i18n import get_request_language
from app.core.permissions import ROLE_SYSTEM_ADMIN, ROLE_STORE_OFFICER
from app.features.audit.services import AuditService
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


def _build_filters(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    category_id: Optional[UUID] = None,
    location_id: Optional[UUID] = None,
    supplier_id: Optional[UUID] = None,
    status_f: Optional[str] = None,
    classification: Optional[str] = None,
    transaction_type: Optional[str] = None,
    disposal_method: Optional[str] = None,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    flt: Dict[str, Any] = {}
    if date_from:
        flt["date_from"] = date_from.isoformat()
    if date_to:
        flt["date_to"] = date_to.isoformat()
    if category_id:
        flt["category_id"] = str(category_id)
    if location_id:
        flt["location_id"] = str(location_id)
    if supplier_id:
        flt["supplier_id"] = str(supplier_id)
    if status_f:
        flt["status"] = status_f
    if classification:
        flt["classification"] = classification
    if transaction_type:
        flt["transaction_type"] = transaction_type
    if disposal_method:
        flt["disposal_method"] = disposal_method
    if search:
        flt["search"] = search
    return flt


@router.get(
    "/overview",
    response_model=StandardSuccessResponse,
    dependencies=[Depends(require_permission("reports:view"))],
)
def get_reports_overview(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resolved_office = _resolve_office(office_id, current_user)
    overview = ReportsService.get_overview(db, office_id=resolved_office, current_user=current_user)
    return StandardSuccessResponse(
        success=True,
        message="Reports overview retrieved successfully",
        data=overview,
    )


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
    filters: Dict[str, Any],
    page: int,
    limit: int,
    sort_by: Optional[str],
    sort_dir: str,
    db: Session,
    current_user: User,
):
    if report_name not in ALLOWED_REPORTS:
        raise ValidationError(
            f"Unsupported report name: {report_name}",
            code="UNSUPPORTED_REPORT",
        )
    resolved_office = _resolve_office(office_id, current_user)
    payload = ReportsService.get_report_payload(
        db=db,
        report_name=report_name,
        office_id=resolved_office,
        filters=filters,
        page=page,
        limit=limit,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )

    return StandardSuccessResponse(
        success=True,
        message=f"{report_name} report retrieved successfully",
        data={
            "report_name": payload["report_name"],
            "headers": payload["headers"],
            "rows": payload["rows"],
            "row_links": payload["row_links"],
            "summary": payload["summary"],
            "generated_at": payload["generated_at"],
            "applied_filters": payload["applied_filters"],
        },
        meta=ResponseMeta(page=page, limit=limit, total=payload["total"]),
    )


def _register_report_route(path: str, report_key: str):
    @router.get(
        path,
        response_model=StandardSuccessResponse,
        dependencies=[Depends(require_permission("reports:view"))],
        summary=f"Get {report_key} report",
    )
    def _endpoint(
        office_id: Optional[UUID] = Query(None),
        date_from: Optional[date] = Query(None),
        date_to: Optional[date] = Query(None),
        category_id: Optional[UUID] = Query(None),
        location_id: Optional[UUID] = Query(None),
        supplier_id: Optional[UUID] = Query(None),
        record_status: Optional[str] = Query(None, alias="status"),
        classification: Optional[str] = Query(None),
        transaction_type: Optional[str] = Query(None),
        disposal_method: Optional[str] = Query(None),
        search: Optional[str] = Query(None),
        page: int = Query(1, ge=1),
        limit: int = Query(50, ge=1, le=500),
        sort_by: Optional[str] = Query(None),
        sort_dir: str = Query("asc"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
        _rk: str = report_key,
    ):
        flt = _build_filters(
            date_from=date_from,
            date_to=date_to,
            category_id=category_id,
            location_id=location_id,
            supplier_id=supplier_id,
            status_f=record_status,
            classification=classification,
            transaction_type=transaction_type,
            disposal_method=disposal_method,
            search=search,
        )
        return _report_response(_rk, office_id, flt, page, limit, sort_by, sort_dir, db, current_user)

    _endpoint.__name__ = f"report_{report_key.replace('-', '_')}"


for _rkey in ALLOWED_REPORTS:
    _register_report_route(f"/{_rkey}", _rkey)


@router.post(
    "/generate-export",
    dependencies=[Depends(require_permission("reports:export"))],
)
def generate_export(
    payload: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report_name = payload.report_name
    if report_name not in ALLOWED_REPORTS:
        raise ValidationError(
            f"Unsupported report name: {report_name}",
            code="UNSUPPORTED_REPORT",
        )

    office_id = _resolve_office(payload.office_id, current_user)
    report_payload = ReportsService.get_report_payload(
        db=db,
        report_name=report_name,
        office_id=office_id,
        filters=payload.filters,
        page=1,
        limit=100000,
    )

    headers = report_payload["headers"]
    rows = report_payload["all_rows"]
    summary = report_payload["summary"]
    export_format = payload.format.lower()
    lang = get_request_language()

    if export_format == "csv":
        content = ReportsService.export_to_csv(headers, rows, lang=lang).encode("utf-8-sig")
        media_type = "text/csv; charset=utf-8"
        extension = "csv"

    elif export_format == "xlsx":
        content = ReportsService.export_to_xlsx(
            report_name, headers, rows, lang=lang, summary=summary
        )
        media_type = (
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        )
        extension = "xlsx"

    elif export_format == "pdf":
        content = ReportsService.export_to_pdf(
            report_name, headers, rows, lang=lang, summary=summary
        )
        media_type = "application/pdf"
        extension = "pdf"

    else:
        raise ValidationError("Unsupported export format")

    AuditService.log_action(
        db=db,
        action="EXPORT",
        module="REPORTS",
        record_id=report_name,
        actor=current_user,
        office_id=office_id or current_user.office_id,
        new_values={"report_name": report_name, "format": export_format, "row_count": len(rows)},
    )
    db.commit()

    filename = f"dsims_{report_name}_{date.today().isoformat()}.{extension}"

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
        status_code=status.HTTP_200_OK,
    )
