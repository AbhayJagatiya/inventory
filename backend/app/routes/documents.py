
"""Document Upload and Download API Routes."""

import os

from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission
from app.core.exceptions import OfficeAccessDeniedError
from app.core.permissions import ROLE_SYSTEM_ADMIN

from app.features.documents.schemas import DocumentOut
from app.features.documents.services import DocumentService
from app.features.users.models import User


router = APIRouter()


def _check_document_access(document, current_user: User) -> None:
    if ROLE_SYSTEM_ADMIN in current_user.role_names:
        return

    if document.item_id and document.item:
        if document.item.office_id != current_user.office_id:
            raise OfficeAccessDeniedError(
                "You cannot access documents outside your assigned office"
            )
        return

    if document.uploader.office_id != current_user.office_id:
        raise OfficeAccessDeniedError(
            "You cannot access documents outside your assigned office"
        )


@router.post(
    "/upload",
    response_model=StandardSuccessResponse[DocumentOut],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("documents:upload"))],
)
def upload_document(
    file: UploadFile = File(...),
    related_entity_type: str = Form(...),
    related_entity_id: UUID = Form(...),
    document_category: str = Form(...),
    item_id: UUID | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if item_id:
        from app.features.inventory.models import Item

        item = db.query(Item).filter(Item.id == item_id).first()

        if not item:
            from app.core.exceptions import NotFoundError
            raise NotFoundError("Item not found", code="ITEM_NOT_FOUND")

        if (
            ROLE_SYSTEM_ADMIN not in current_user.role_names
            and item.office_id != current_user.office_id
        ):
            raise OfficeAccessDeniedError(
                "You cannot upload documents for another office's item"
            )

    document = DocumentService.upload_document(
        db=db,
        file=file,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        document_category=document_category,
        uploader=current_user,
        item_id=item_id,
    )

    return StandardSuccessResponse(
        success=True,
        message="Document uploaded successfully",
        data=DocumentOut.model_validate(document),
    )


@router.get(
    "/{document_id}/download",
    dependencies=[Depends(require_permission("documents:view"))],
)
def download_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = DocumentService.get_document(db, document_id)

    _check_document_access(document, current_user)

    return FileResponse(
        path=document.file_path,
        filename=os.path.basename(document.file_name),
        media_type=document.mime_type,
    )
