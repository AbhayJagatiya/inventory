
"""Condemnation Proposal and Approval API Routes."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.common_schemas import ResponseMeta, StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.core.exceptions import OfficeAccessDeniedError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.condemnation.schemas import (
    CondemnationDecisionRequest,
    CondemnationRequestCreate,
    CondemnationRequestOut,
    CondemnationReviewRequest,
)
from app.features.condemnation.services import CondemnationService
from app.features.users.models import User

router = APIRouter()


def _check_office_access(request, current_user: User) -> None:
    """Enforce office-level access for condemnation requests."""
    if (
        ROLE_SYSTEM_ADMIN not in current_user.role_names
        and request.office_id != current_user.office_id
    ):
        raise OfficeAccessDeniedError(
            "You cannot access condemnation requests outside your assigned office"
        )


@router.get(
    "/",
    response_model=StandardSuccessResponse[List[CondemnationRequestOut]],
    status_code=status.HTTP_200_OK,
    summary="List condemnation requests",
)
def list_condemnation_requests(
    office_id: Optional[UUID] = Query(None),
    request_status: Optional[str] = Query(None, alias="status"),
    reason_code: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("condemn:view")),
):
    if ROLE_SYSTEM_ADMIN not in current_user.role_names:
        if office_id and office_id != current_user.office_id:
            raise OfficeAccessDeniedError("Access to another office is denied")
        office_id = current_user.office_id

    requests, total = CondemnationService.list_requests(
        db=db,
        office_id=office_id,
        status=request_status,
        reason_code=reason_code,
        current_user=current_user,
        page=page,
        limit=limit,
    )

    return StandardSuccessResponse(
        data=requests,
        message="Condemnation requests retrieved successfully",
        meta=ResponseMeta(page=page, limit=limit, total=total),
    )


@router.post(
    "/",
    response_model=StandardSuccessResponse[CondemnationRequestOut],
    status_code=status.HTTP_201_CREATED,
    summary="Submit condemnation request",
)
def create_condemnation_request(
    payload: CondemnationRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("condemn:submit")),
):
    request = CondemnationService.create_request(
        db=db,
        payload=payload,
        creator=current_user,
    )

    return StandardSuccessResponse(
        data=request,
        message="Condemnation request submitted successfully",
    )


@router.get(
    "/{request_id}",
    response_model=StandardSuccessResponse[CondemnationRequestOut],
    status_code=status.HTTP_200_OK,
    summary="Get condemnation request details",
)
def get_condemnation_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("condemn:view")),
):
    request = CondemnationService.get_request(db, request_id)
    _check_office_access(request, current_user)

    return StandardSuccessResponse(
        data=request,
        message="Condemnation request retrieved successfully",
    )


@router.post(
    "/{request_id}/review",
    response_model=StandardSuccessResponse[CondemnationRequestOut],
    status_code=status.HTTP_200_OK,
    summary="Review condemnation request",
)
def review_condemnation_request(
    request_id: UUID,
    payload: CondemnationReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("condemn:review")),
):
    existing = CondemnationService.get_request(db, request_id)
    _check_office_access(existing, current_user)

    request = CondemnationService.review_request(
        db=db,
        request_id=request_id,
        payload=payload,
        reviewer=current_user,
    )

    return StandardSuccessResponse(
        data=request,
        message="Condemnation request reviewed successfully",
    )


@router.post(
    "/{request_id}/decision",
    response_model=StandardSuccessResponse[CondemnationRequestOut],
    status_code=status.HTTP_200_OK,
    summary="Approve or reject condemnation request",
)
def decide_condemnation_request(
    request_id: UUID,
    payload: CondemnationDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("condemn:approve")),
):
    existing = CondemnationService.get_request(db, request_id)
    _check_office_access(existing, current_user)

    request = CondemnationService.decide_request(
        db=db,
        request_id=request_id,
        payload=payload,
        approver=current_user,
    )

    return StandardSuccessResponse(
        data=request,
        message=f"Condemnation request decision recorded: {payload.action}",
    )
