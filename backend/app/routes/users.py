"""
User management routes for the Dead Stock Inventory Management System.
Handles CRUD operations and status management for system users.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.common_schemas import ResponseMeta, StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.users.models import User
from app.features.users.schemas import (
    UserCreate,
    UserOut,
    UserStatusUpdate,
    UserUpdate,
)
from app.features.users.services import UserService

router = APIRouter()


@router.get(
    "/",
    response_model=StandardSuccessResponse[List[UserOut]],
    status_code=status.HTTP_200_OK,
    summary="List users",
    description=(
        "Returns a paginated list of users. Results are scoped to the caller's "
        "office unless the caller holds cross-office privileges."
    ),
)
def list_users(
    office_id: Optional[UUID] = Query(None, description="Filter by office UUID"),
    role: Optional[str] = Query(None, description="Filter by role name"),
    status: Optional[str] = Query(None, description="Filter by account status"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(20, ge=1, le=100, description="Records per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_USERS")),
):
    """Requires VIEW_USERS permission."""
    users, total = UserService.list_users(
        db=db,
        office_id=office_id,
        role=role,
        status=status,
        search=search,
        page=page,
        limit=limit,
        current_user=current_user,
    )
    return StandardSuccessResponse(
        data=users,
        message="Users retrieved successfully",
        meta=ResponseMeta(page=page, limit=limit, total=total),
    )


@router.post(
    "/",
    response_model=StandardSuccessResponse[UserOut],
    status_code=status.HTTP_201_CREATED,
    summary="Create user",
    description="Create a new user account. The caller must have MANAGE_USERS permission.",
)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_USERS")),
):
    """Requires MANAGE_USERS permission."""
    user = UserService.create_user(
        db=db,
        payload=payload,
        created_by=current_user,
    )
    return StandardSuccessResponse(
        data=user,
        message="User created successfully",
    )


@router.get(
    "/{user_id}",
    response_model=StandardSuccessResponse[UserOut],
    status_code=status.HTTP_200_OK,
    summary="Get user",
    description="Retrieve a single user record by UUID.",
)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_USERS")),
):
    """Requires VIEW_USERS permission."""
    user = UserService.get_user(db=db, user_id=user_id)
    return StandardSuccessResponse(
        data=user,
        message="User retrieved successfully",
    )


@router.patch(
    "/{user_id}",
    response_model=StandardSuccessResponse[UserOut],
    status_code=status.HTTP_200_OK,
    summary="Update user",
    description="Partially update a user's profile fields.",
)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_USERS")),
):
    """Requires MANAGE_USERS permission."""
    user = UserService.update_user(
        db=db,
        user_id=user_id,
        payload=payload,
        updated_by=current_user,
    )
    return StandardSuccessResponse(
        data=user,
        message="User updated successfully",
    )


@router.patch(
    "/{user_id}/status",
    response_model=StandardSuccessResponse[UserOut],
    status_code=status.HTTP_200_OK,
    summary="Update user status",
    description=(
        "Activate, deactivate, lock, or unlock a user account. "
        "Audit trail is recorded against the acting user."
    ),
)
def update_user_status(
    user_id: UUID,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_USERS")),
):
    """Requires MANAGE_USERS permission."""
    user = UserService.update_user_status(
        db=db,
        user_id=user_id,
        payload=payload,
        actor=current_user,
    )
    return StandardSuccessResponse(
        data=user,
        message="User status updated successfully",
    )
