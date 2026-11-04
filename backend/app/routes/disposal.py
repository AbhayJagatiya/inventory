
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.common_schemas import ResponseMeta, StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission
from app.core.exceptions import OfficeAccessDeniedError
from app.core.permissions import ROLE_SYSTEM_ADMIN

from app.features.disposal.schemas import DisposalCreate, DisposalOut
from app.features.disposal.services import DisposalService
from app.features.users.models import User


from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.core.dependencies import get_current_user, require_permission
from app.core.permissions import ROLE_SYSTEM_ADMIN

from app.core.common_schemas import StandardSuccessResponse, ResponseMeta

from app.features.users.models import User
from app.features.disposal.services import DisposalService
from app.features.disposal.schemas import DisposalCreate, DisposalOut


router = APIRouter()


def check_office_access(office_id: UUID, current_user: User) -> None:
    if (
        ROLE_SYSTEM_ADMIN not in current_user.role_names
        and current_user.office_id != office_id
    ):
        from app.core.exceptions import OfficeAccessDeniedError
        raise OfficeAccessDeniedError(
            "You cannot access disposal records outside your assigned office"
        )


@router.get(
    "/",
    response_model=StandardSuccessResponse,
    dependencies=[Depends(require_permission("disposal:view"))],
)
def list_disposals(
    office_id: Optional[UUID] = Query(None),
    disposal_method: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if office_id:
        check_office_access(office_id, current_user)

    disposals, total = DisposalService.list_disposals(
        db=db,
        office_id=office_id,
        disposal_method=disposal_method,
        current_user=current_user,
        page=page,
        limit=limit,
    )

    return StandardSuccessResponse(
        success=True,
        message="Disposal records retrieved successfully",
        data=[DisposalOut.model_validate(item) for item in disposals],
        meta=ResponseMeta(
            page=page,
            limit=limit,
            total=total,
        ),
    )


@router.post(
    "/",
    response_model=StandardSuccessResponse,
    dependencies=[Depends(require_permission("disposal:execute"))],
)
def execute_disposal(
    payload: DisposalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_office_access(payload.office_id, current_user)

    disposal = DisposalService.execute_disposal(
        db=db,
        payload=payload,
        executor=current_user,
    )

    return StandardSuccessResponse(
        success=True,
        message="Disposal executed successfully",
        data=DisposalOut.model_validate(disposal),
    )


@router.get(
    "/{disposal_id}",
    response_model=StandardSuccessResponse,
    dependencies=[Depends(require_permission("disposal:view"))],
)
def get_disposal(
    disposal_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    disposal = DisposalService.get_disposal(db, disposal_id)

    check_office_access(disposal.office_id, current_user)

    return StandardSuccessResponse(
        success=True,
        message="Disposal record retrieved successfully",
        data=DisposalOut.model_validate(disposal),
    )
