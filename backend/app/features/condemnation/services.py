"""Condemnation Workflow Service

Manages write-off proposals, condition inspection, configurable authority review, and sanction orders.
"""

from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import ConflictError, NotFoundError, OfficeAccessDeniedError, PermissionDeniedError, ValidationError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.audit.services import AuditService
from app.features.condemnation.models import ApprovalAction, CondemnationRequest, CondemnationRequestItem
from app.features.condemnation.schemas import (
    CondemnationDecisionRequest,
    CondemnationRequestCreate,
    CondemnationReviewRequest,
)
from app.features.inventory.models import Item
from app.features.settings.services import SettingsService
from app.features.users.models import User


class CondemnationService:
    @staticmethod
    def generate_request_number(db: Session) -> str:
        current_year = datetime.now(timezone.utc).year
        count = db.query(CondemnationRequest).filter(CondemnationRequest.request_number.like(f"CND-{current_year}-%")).count()
        return f"CND-{current_year}-{count + 1:05d}"

    @staticmethod
    def get_request(db: Session, request_id: UUID) -> CondemnationRequest:
        req = db.query(CondemnationRequest).filter(CondemnationRequest.id == request_id).first()
        if not req:
            raise NotFoundError(f"Condemnation proposal '{request_id}' was not found", code="CONDEMNATION_NOT_FOUND")
        return req

    @staticmethod
    def list_requests(
        db: Session,
        office_id: Optional[UUID] = None,
        status: Optional[str] = None,
        reason_code: Optional[str] = None,
        current_user: Optional[User] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[CondemnationRequest], int]:
        query = db.query(CondemnationRequest)

        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(CondemnationRequest.office_id == current_user.office_id)
        elif office_id:
            query = query.filter(CondemnationRequest.office_id == office_id)

        if status:
            query = query.filter(CondemnationRequest.status == status.upper())
        if reason_code:
            query = query.filter(CondemnationRequest.reason_code == reason_code.upper())

        total = query.count()
        requests = query.order_by(CondemnationRequest.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
        return requests, total

    @staticmethod
    def create_request(
        db: Session,
        payload: CondemnationRequestCreate,
        creator: User,
    ) -> CondemnationRequest:
        if ROLE_SYSTEM_ADMIN not in creator.role_names and payload.office_id != creator.office_id:
            raise OfficeAccessDeniedError("Cannot submit condemnation proposal for an office other than your assigned office")

        req_no = CondemnationService.generate_request_number(db)
        items = []

        for it_data in payload.items:
            item = db.query(Item).filter(Item.id == it_data.item_id).first()
            if not item:
                raise NotFoundError(f"Item '{it_data.item_id}' not found", code="ITEM_NOT_FOUND")
            if item.office_id != payload.office_id:
                raise ConflictError("Item belongs to another office")
            if item.operational_status in ["PENDING_CONDEMNATION", "PENDING_DISPOSAL", "DISPOSED"]:
                raise ValidationError(f"Item '{item.item_code}' is already in status '{item.operational_status}'")

            # Transition item status to PENDING_CONDEMNATION (locks from active issues)
            item.operational_status = "PENDING_CONDEMNATION"
            item.condition = it_data.item_condition

            c_item = CondemnationRequestItem(
                office_id=payload.office_id,
                item_id=it_data.item_id,
                item_condition=it_data.item_condition,
                assessed_scrap_value=it_data.assessed_scrap_value,
                inspector_remarks=it_data.inspector_remarks,
            )
            items.append(c_item)

        request = CondemnationRequest(
            request_number=req_no,
            office_id=payload.office_id,
            reason_code=payload.reason_code,
            condition_summary=payload.condition_summary.strip(),
            status="SUBMITTED",
            submitted_by=creator.id,
            submitted_at=datetime.now(timezone.utc),
            items=items,
        )
        db.add(request)
        db.flush()

        AuditService.log_action(
            db=db,
            action="SUBMIT",
            module="CONDEMNATION",
            record_id=str(request.id),
            actor=creator,
            office_id=request.office_id,
            new_values={"request_number": request.request_number, "items_count": len(items)},
        )
        db.commit()
        db.refresh(request)
        return request

    @staticmethod
    def review_request(
        db: Session,
        request_id: UUID,
        payload: CondemnationReviewRequest,
        reviewer: User,
    ) -> CondemnationRequest:
        req = CondemnationService.get_request(db, request_id)
        if req.status not in ["SUBMITTED", "MORE_INFO_REQUIRED"]:
            raise ValidationError(f"Cannot review proposal in status '{req.status}'")

        req.status = "UNDER_REVIEW"
        action = ApprovalAction(
            request_id=req.id,
            action_by=reviewer.id,
            role_snapshot=reviewer.role_names[0] if reviewer.role_names else "OFFICER",
            action="REVIEW",
            remarks=payload.remarks.strip(),
        )
        db.add(action)
        db.flush()

        AuditService.log_action(
            db=db,
            action="REVIEW",
            module="CONDEMNATION",
            record_id=str(req.id),
            actor=reviewer,
            office_id=req.office_id,
            new_values={"status": "UNDER_REVIEW", "remarks": payload.remarks},
        )
        db.commit()
        db.refresh(req)
        return req

    @staticmethod
    def decide_request(
        db: Session,
        request_id: UUID,
        payload: CondemnationDecisionRequest,
        approver: User,
    ) -> CondemnationRequest:
        req = CondemnationService.get_request(db, request_id)
        if req.status not in ["UNDER_REVIEW", "SUBMITTED"]:
            raise ValidationError(f"Cannot decide proposal in status '{req.status}'")

        # 1. Separation of duties: creator cannot approve own proposal!
        if req.submitted_by == approver.id:
            raise PermissionDeniedError("Separation of duties violation: Submitter cannot approve their own condemnation proposal.")

        # 2. Configurable approval authority check
        configured_role = SettingsService.get_setting(db, "approval.condemnation_approver_role", req.office_id) or "STORE_OFFICER"
        if ROLE_SYSTEM_ADMIN not in approver.role_names and configured_role not in approver.role_names:
            raise PermissionDeniedError(
                f"User does not hold the configured approval authority role ('{configured_role}') for this office."
            )

        if payload.action == "APPROVE":
            req.status = "APPROVED"
            for it in req.items:
                item = db.query(Item).filter(Item.id == it.item_id).first()
                if item:
                    item.operational_status = "PENDING_DISPOSAL"

        elif payload.action == "REJECT":
            req.status = "REJECTED"
            for it in req.items:
                item = db.query(Item).filter(Item.id == it.item_id).first()
                if item:
                    item.operational_status = "AVAILABLE_IN_STORE" if item.condition != "DAMAGED" else "DAMAGED"

        elif payload.action == "REQUEST_INFO":
            req.status = "MORE_INFO_REQUIRED"

        action = ApprovalAction(
            request_id=req.id,
            action_by=approver.id,
            role_snapshot=approver.role_names[0] if approver.role_names else "APPROVER",
            action=payload.action,
            order_number=payload.order_number,
            remarks=payload.remarks.strip(),
        )
        db.add(action)
        db.flush()

        AuditService.log_action(
            db=db,
            action=payload.action,
            module="CONDEMNATION",
            record_id=str(req.id),
            actor=approver,
            office_id=req.office_id,
            new_values={
                "status": req.status,
                "decision": payload.action,
                "order_number": payload.order_number,
            },
        )
        db.commit()
        db.refresh(req)
        return req

