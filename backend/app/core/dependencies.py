
"""Core Security and Scope Dependencies for FastAPI

Enforces authentication, RBAC permissions, and office-level boundary isolation.
"""

from typing import Callable, Optional
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import (
    AuthenticationError,
    OfficeAccessDeniedError,
    PermissionDeniedError,
)
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.core.security import decode_token
from app.features.users.models import User


# JWT Bearer authentication for Swagger and API requests
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Authenticates the incoming request via JWT Bearer token."""

    if not credentials:
        raise AuthenticationError(
            "Authentication token is missing",
            code="UNAUTHORIZED",
        )

    token = credentials.credentials
    payload = decode_token(token)

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise AuthenticationError(
            "Invalid token payload: missing subject",
            code="INVALID_TOKEN",
        )

    try:
        user_uuid = UUID(user_id_str)
    except ValueError:
        raise AuthenticationError(
            "Invalid user identifier in token",
            code="INVALID_TOKEN",
        )

    user = db.query(User).filter(User.id == user_uuid).first()

    if not user:
        raise AuthenticationError(
            "User account not found",
            code="USER_NOT_FOUND",
        )

    if user.status == "LOCKED":
        raise AuthenticationError(
            "User account is locked due to security policy",
            code="ACCOUNT_LOCKED",
        )

    if user.status == "INACTIVE":
        raise AuthenticationError(
            "User account is deactivated",
            code="ACCOUNT_INACTIVE",
        )

    if user.office and not user.office.is_active:
        raise AuthenticationError(
            "Assigned office is currently inactive",
            code="OFFICE_INACTIVE",
        )

    return user


def require_permission(permission_code: str) -> Callable:
    """Checks whether the authenticated user has the required permission."""

    def permission_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:

        if ROLE_SYSTEM_ADMIN in current_user.role_names:
            return current_user

        if permission_code not in current_user.permission_codes:
            raise PermissionDeniedError(
                f"Missing required permission: '{permission_code}'",
                code="INSUFFICIENT_PERMISSIONS",
            )

        return current_user

    return permission_checker


def require_office_scope(
    requested_office_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
) -> UUID:
    """Enforces office-level data isolation."""

    if requested_office_id is None:
        return current_user.office_id

    if requested_office_id != current_user.office_id:
        if ROLE_SYSTEM_ADMIN in current_user.role_names:
            return requested_office_id

        raise OfficeAccessDeniedError(
            f"Access denied to office '{requested_office_id}'. "
            f"User is assigned to '{current_user.office_id}'."
        )

    return requested_office_id
