"""
Classification and Dead Stock routes.
Prefix: /api/v1/classifications
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse, ResponseMeta
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.core.permissions import ROLE_SYSTEM_ADMIN

from datetime import datetime, timedelta, timezone, time
from sqlalchemy import and_, or_

from app.features.classification.models import Classification
from app.features.classification.schemas import (
    ClassificationOut,
    ClassificationOverrideRequest,
    ClassificationReleaseOverrideRequest,
    ClassificationRunRequest,
    ClassificationRunResultOut,
    ClassificationSummaryOut,
    DeadStockCandidateOut,
)
from app.features.classification.services import ClassificationService
from app.features.inventory.models import Item
from app.features.users.models import User


router = APIRouter()


def _resolve_office_scope(
    requested_office_id: Optional[UUID],
    current_user: User,
) -> Optional[UUID]:
    """Limit non-admin users to their assigned office."""
    if ROLE_SYSTEM_ADMIN in current_user.role_names:
        return requested_office_id

    if requested_office_id and requested_office_id != current_user.office_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot access another office's classification data.",
        )

    return current_user.office_id


@router.get(
    "/summary",
    response_model=StandardSuccessResponse[ClassificationSummaryOut],
    summary="Get classification summary",
)
def get_classification_summary(
    office_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("classify:view")),
):
    scoped_office_id = _resolve_office_scope(office_id, current_user)

    summary = ClassificationService.get_classification_summary(
        db=db,
        office_id=scoped_office_id,
    )

    return StandardSuccessResponse(
        data=summary,
        message="Classification summary retrieved successfully",
    )


@router.get(
    "/dead-stock",
    response_model=StandardSuccessResponse[List[DeadStockCandidateOut]],
    summary="Get official dead stock register",
)
def get_dead_stock_register(
    office_id: Optional[UUID] = Query(None),
    category_id: Optional[UUID] = Query(None),
    classification: Optional[str] = Query(
        None,
        pattern="^(NON_MOVING|OBSOLETE)$",
    ),
    condition: Optional[str] = Query(None),
    min_age_days: Optional[int] = Query(None, ge=0),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("classify:view")),
):
    scoped_office_id = _resolve_office_scope(office_id, current_user)

    # Apply all filters before pagination so total/page counts remain correct.
    query = db.query(Item).filter(
        Item.operational_status != "DISPOSED",
        Item.current_classification.in_(
            [classification] if classification else ["NON_MOVING", "OBSOLETE"]
        ),
    )

    if scoped_office_id:
        query = query.filter(Item.office_id == scoped_office_id)

    if category_id:
        query = query.filter(Item.category_id == category_id)

    if condition:
        query = query.filter(Item.condition == condition.upper())
    if min_age_days is not None:
        cutoff = datetime.now(timezone.utc).date() - timedelta(days=min_age_days)
        cutoff_datetime = datetime.combine(
            cutoff,
            time.min,
            tzinfo=timezone.utc,
        )

        query = query.filter(
            or_(
                and_(
                    Item.purchase_date.isnot(None),
                    Item.purchase_date <= cutoff,
                ),
                and_(
                    Item.purchase_date.is_(None),
                    Item.created_at <= cutoff_datetime,
                ),
            )
        )

    total = query.count()

    items = (
        query.order_by(
            Item.current_classification.desc(),
            Item.total_cost.desc(),
        )
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    item_ids = [item.id for item in items]

    classifications = {}
    if item_ids:
        records = (
            db.query(Classification)
            .filter(Classification.item_id.in_(item_ids))
            .all()
        )
        classifications = {record.item_id: record for record in records}

    candidates = []

    for item in items:
        record = classifications.get(item.id)

        # A register entry without its classification record is inconsistent.
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Classification record missing for item {item.id}. Run classification first.",
            )

        candidates.append(
            DeadStockCandidateOut(
                item=item,
                classification=record,
                days_inactive=record.days_inactive,
                item_age_days=record.item_age_days,
                recorded_cost=float(item.total_cost or 0),
            )
        )

    return StandardSuccessResponse(
        data=candidates,
        message="Dead stock register retrieved successfully",
        meta=ResponseMeta(
            page=page,
            limit=limit,
            total=total,
            total_pages=(total + limit - 1) // limit,
        ),
    )


@router.post(
    "/run",
    response_model=StandardSuccessResponse[ClassificationRunResultOut],
    status_code=status.HTTP_200_OK,
    summary="Run automated classification",
)
def run_classification(
    payload: ClassificationRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("classify:run")),
):
    _resolve_office_scope(payload.office_id, current_user)

    result = ClassificationService.run_classification(
        db=db,
        office_id=payload.office_id,
        category_id=payload.category_id,
        actor=current_user,
    )

    return StandardSuccessResponse(
        data=result,
        message="Classification run completed successfully",
    )


@router.post(
    "/{item_id}/override",
    response_model=StandardSuccessResponse[ClassificationOut],
    summary="Override item classification",
)
def override_classification(
    item_id: UUID,
    payload: ClassificationOverrideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("classify:override")),
):
    record = ClassificationService.override_classification(
        db=db,
        item_id=item_id,
        payload=payload,
        officer=current_user,
    )

    return StandardSuccessResponse(
        data=record,
        message="Classification override recorded successfully",
    )


@router.post(
    "/{item_id}/release-override",
    response_model=StandardSuccessResponse[ClassificationOut],
    summary="Release classification override",
)
def release_classification_override(
    item_id: UUID,
    payload: ClassificationReleaseOverrideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("classify:override")),
):
    record = ClassificationService.release_override(
        db=db,
        item_id=item_id,
        payload=payload,
        officer=current_user,
    )

    return StandardSuccessResponse(
        data=record,
        message="Classification override released successfully",
    )