"""Document Management Service

Handles secure file upload, anti-path-traversal sanitization, and streaming downloads.
"""

import os
import uuid
from typing import Optional
from uuid import UUID
from fastapi import UploadFile
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.exceptions import NotFoundError, ValidationError
from app.features.audit.services import AuditService
from app.features.documents.models import AssetDocument
from app.features.users.models import User

ALLOWED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class DocumentService:
    @staticmethod
    def upload_document(
        db: Session,
        file: UploadFile,
        related_entity_type: str,
        related_entity_id: UUID,
        document_category: str,
        uploader: User,
        item_id: Optional[UUID] = None,
    ) -> AssetDocument:
        # Validate MIME type
        content_type = file.content_type or "application/octet-stream"
        if content_type not in ALLOWED_MIME_TYPES:
            raise ValidationError(
                f"File type '{content_type}' is not permitted. Allowed formats: PDF, JPEG, PNG, WEBP."
            )

        # Anti-path-traversal filename sanitization
        original_name = os.path.basename(file.filename or "uploaded_file")
        ext = ALLOWED_MIME_TYPES.get(content_type, ".dat")
        unique_file_name = f"{uuid.uuid4().hex}{ext}"

        upload_dir = os.path.abspath(settings.STORAGE_UPLOAD_DIR)
        os.makedirs(upload_dir, exist_ok=True)
        dest_path = os.path.join(upload_dir, unique_file_name)

        # Read and check size
        content = file.file.read()
        file_size = len(content)
        if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
            raise ValidationError(
                f"File size exceeds maximum permitted limit ({settings.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024):.1f} MB)"
            )

        with open(dest_path, "wb") as f:
            f.write(content)

        doc = AssetDocument(
            item_id=item_id,
            related_entity_type=related_entity_type.upper(),
            related_entity_id=related_entity_id,
            file_name=original_name,
            file_path=dest_path,
            file_size=file_size,
            mime_type=content_type,
            document_category=document_category.upper(),
            uploaded_by=uploader.id,
        )
        db.add(doc)
        db.flush()

        AuditService.log_action(
            db=db,
            action="UPLOAD",
            module="DOCUMENTS",
            record_id=str(doc.id),
            actor=uploader,
            office_id=uploader.office_id,
            new_values={"filename": original_name, "size": file_size, "category": doc.document_category},
        )
        db.commit()
        db.refresh(doc)
        return doc

    @staticmethod
    def get_document(db: Session, document_id: UUID) -> AssetDocument:
        doc = db.query(AssetDocument).filter(AssetDocument.id == document_id).first()
        if not doc:
            raise NotFoundError("Document not found", code="DOCUMENT_NOT_FOUND")
        if not os.path.exists(doc.file_path):
            raise NotFoundError("Stored physical file was not found on server", code="FILE_NOT_FOUND")
        return doc

