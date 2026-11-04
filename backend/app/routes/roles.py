"""
Role and permission management routes for the Dead Stock Inventory Management System.
Handles listing roles, inspecting role details, and configuring role permissions.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.features.roles.models import Role
from app.features.roles.schemas import PermissionOut, RoleConfigurePermissions, RoleOut
from app.features.roles.services import RoleService
from app.features.users.models import User

router = APIRouter()


@router.get(
    "/permissions",
    response_model=StandardSuccessResponse[List[PermissionOut]],
    summary="List all permissions",
    description="Returns every permission code available in the system.",
)
def list_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_ROLES")),
):
    """
    Requires VIEW_ROLES permission.

    NOTE: This route is declared before /{role_id} to prevent FastAPI from
    mistakenly matching the literal string "permissions" as a role_id UUID.
    """
    permissions = RoleService.list_permissions(db=db)
    return StandardSuccessResponse(
        data=permissions,
        message="Permissions retrieved successfully",
    )


@router.get(
    "/",
    response_model=StandardSuccessResponse[List[RoleOut]],
    summary="List roles",
    description="Returns all roles defined in the system along with their assigned permissions.",
)
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_ROLES")),
):
    """Requires VIEW_ROLES permission."""
    roles = RoleService.list_roles(db=db)
    return StandardSuccessResponse(
        data=roles,
        message="Roles retrieved successfully",
    )


@router.get(
    "/{role_id}",
    response_model=StandardSuccessResponse[RoleOut],
    summary="Get role",
    description="Retrieve a single role with its full permission set.",
)
def get_role(
    role_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("VIEW_ROLES")),
):
    """Requires VIEW_ROLES permission."""
    role = RoleService.get_role(db=db, role_id=role_id)
    return StandardSuccessResponse(
        data=role,
        message="Role retrieved successfully",
    )


@router.patch(
    "/{role_id}/permissions",
    response_model=StandardSuccessResponse[RoleOut],
    summary="Configure role permissions",
    description=(
        "Replace the permission set of a role with the supplied list of permission IDs. "
        "This is a full replacement (idempotent set operation), not an additive patch."
    ),
)
def configure_role_permissions(
    role_id: UUID,
    payload: RoleConfigurePermissions,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_ROLES")),
):
    """Requires MANAGE_ROLES permission."""
    role = RoleService.configure_role_permissions(
        db=db,
        role_id=role_id,
        permission_ids=payload.permission_ids,
        actor=current_user,
    )
    return StandardSuccessResponse(
        data=role,
        message="Role permissions updated successfully",
    )
