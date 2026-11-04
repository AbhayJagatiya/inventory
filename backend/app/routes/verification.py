
"""
Physical Verification Routes.
Prefix: /api/v1/verifications
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.common_schemas import ResponseMeta, StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.core.permissions import ROLE_SYSTEM_ADMIN

from app.features.users.models import User
from app.features.verification.schemas import (
    VerificationCompleteRequest,
    VerificationReconcileRequest,
    VerificationScanRequest,
    VerificationScanResponse,
    VerificationScanEventOut,
    VerificationSessionCreate,
    VerificationSessionOut,
)
from app.features.verification.services import VerificationService


router = APIRouter()


def _check_session_access(session, current_user: User) -> None:
    """Ensure a user cannot access another office's verification session."""

    if (
        ROLE_SYSTEM_ADMIN not in current_user.role_names
        and session.office_id != current_user.office_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this office's verification session.",
        )


@router.get(
    "/sessions",
    response_model=StandardSuccessResponse[List[VerificationSessionOut]],
    summary="List verification sessions",
)
def list_sessions(
    office_id: Optional[UUID] = Query(None),
    session_status: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("verify:view")),
):
    sessions, total = VerificationService.list_sessions(
        db=db,
        office_id=office_id,
        status=session_status,
        current_user=current_user,
        page=page,
        limit=limit,
    )

    return StandardSuccessResponse(
        data=sessions,
        message="Verification sessions retrieved successfully",
        meta=ResponseMeta(
            page=page,
            limit=limit,
            total=total,
            total_pages=(total + limit - 1) // limit,
        ),
    )


@router.post(
    "/sessions",
    response_model=StandardSuccessResponse[VerificationSessionOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create verification session",
)
def create_session(
    payload: VerificationSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("verify:create")),
):
    session = VerificationService.create_session(
        db=db,
        payload=payload,
        lead_verifier=current_user,
    )

    return StandardSuccessResponse(
        data=session,
        message="Verification session created successfully",
    )


@router.get(
    "/sessions/{session_id}",
    response_model=StandardSuccessResponse[VerificationSessionOut],
    summary="Get verification session",
)
def get_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("verify:view")),
):
    session = VerificationService.get_session(
        db=db,
        session_id=session_id,
    )
    _check_session_access(session, current_user)

    return StandardSuccessResponse(
        data=session,
        message="Verification session retrieved successfully",
    )


@router.get(
    "/sessions/{session_id}/scans",
    response_model=StandardSuccessResponse[List[VerificationScanEventOut]],
    summary="List verification scan events",
)
def list_session_scans(
    session_id: UUID,
    scan_result: Optional[str] = Query(None),
    is_duplicate: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("verify:view")),
):
    session = VerificationService.get_session(db, session_id)
    _check_session_access(session, current_user)

    scans, total = VerificationService.list_session_scans(
        db=db,
        session_id=session_id,
        scan_result=scan_result,
        is_duplicate=is_duplicate,
        page=page,
        limit=limit,
    )

    return StandardSuccessResponse(
        data=scans,
        message="Verification scan events retrieved successfully",
        meta=ResponseMeta(
            page=page,
            limit=limit,
            total=total,
            total_pages=(total + limit - 1) // limit,
        ),
    )


@router.post(
    "/sessions/{session_id}/scan",
    response_model=StandardSuccessResponse[VerificationScanResponse],
    summary="Process verification barcode scan",
)
def process_scan(
    session_id: UUID,
    payload: VerificationScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("verify:scan")),
):
    session = VerificationService.get_session(db, session_id)
    _check_session_access(session, current_user)

    result = VerificationService.process_scan(
        db=db,
        session_id=session_id,
        payload=payload,
        scanner_user=current_user,
    )

    return StandardSuccessResponse(
        data=result,
        message="Verification scan processed successfully",
    )


@router.post(
    "/sessions/{session_id}/reconcile",
    response_model=StandardSuccessResponse[VerificationSessionOut],
    summary="Reconcile verification discrepancies",
)
def reconcile_session(
    session_id: UUID,
    payload: VerificationReconcileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("verify:reconcile")),
):
    session = VerificationService.get_session(db, session_id)
    _check_session_access(session, current_user)

    updated_session = VerificationService.reconcile_discrepancies(
        db=db,
        session_id=session_id,
        payload=payload,
        officer=current_user,
    )

    return StandardSuccessResponse(
        data=updated_session,
        message="Verification discrepancies reconciled successfully",
    )


@router.post(
    "/sessions/{session_id}/complete",
    response_model=StandardSuccessResponse[VerificationSessionOut],
    summary="Complete verification session",
)
def complete_session(
    session_id: UUID,
    payload: VerificationCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("verify:reconcile")),
):
    session = VerificationService.get_session(db, session_id)
    _check_session_access(session, current_user)

    completed_session = VerificationService.complete_session(
        db=db,
        session_id=session_id,
        payload=payload,
        officer=current_user,
    )

    return StandardSuccessResponse(
        data=completed_session,
        message="Verification session completed successfully",
    )
