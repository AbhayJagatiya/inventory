"""
Authentication routes for the Dead Stock Inventory Management System.
Handles login, logout, token refresh, user profile, and password management.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.common_schemas import StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission
from app.features.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    TokenRefreshResponse,
    UserProfileOut,
)
from app.features.auth.services import AuthService
from app.features.offices.schemas import OfficeOut
from app.features.users.models import User
from app.features.users.schemas import AdminResetPassword, UserOut
from app.features.users.services import UserService

router = APIRouter()


@router.post(
    "/login",
    response_model=StandardSuccessResponse[LoginResponse],
    status_code=status.HTTP_200_OK,
    summary="User login",
    description=(
        "Authenticate with username/email and password. "
        "Returns signed access and refresh tokens."
    ),
)
def login(
    request: Request,
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    """Public endpoint — no prior authentication required."""
    ip_address: str = request.client.host if request.client else "unknown"
    user_agent: str = request.headers.get("User-Agent", "")

    result: LoginResponse = AuthService.login(
        db=db,
        payload=payload,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return StandardSuccessResponse(
        data=result,
        message="Login successful",
    )


@router.post(
    "/logout",
    response_model=StandardSuccessResponse[None],
    status_code=status.HTTP_200_OK,
    summary="User logout",
    description="Invalidate the current access token and the supplied refresh token.",
)
def logout(
    request: Request,
    payload: RefreshTokenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Requires a valid access token in the Authorization header."""
    token: str = (
        request.headers.get("Authorization", "").replace("Bearer ", "").strip()
    )
    ip_address: str = request.client.host if request.client else "unknown"

    AuthService.logout(
        token=token,
        refresh_token=payload.refresh_token,
        user=current_user,
        db=db,
        ip_address=ip_address,
    )
    return StandardSuccessResponse(
        data=None,
        message="Logged out successfully",
    )


@router.post(
    "/refresh",
    response_model=StandardSuccessResponse[TokenRefreshResponse],
    status_code=status.HTTP_200_OK,
    summary="Refresh access token",
    description="Exchange a valid refresh token for a new access token.",
)
def refresh_token(
    payload: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    """Public endpoint — trust is established via the signed refresh token itself."""
    result: TokenRefreshResponse = AuthService.refresh_access_token(
        db=db,
        refresh_token=payload.refresh_token,
    )
    return StandardSuccessResponse(
        data=result,
        message="Token refreshed successfully",
    )


@router.get(
    "/me",
    response_model=StandardSuccessResponse[UserProfileOut],
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
    description=(
        "Returns the authenticated user's full profile including office, "
        "assigned roles, and resolved permission codes."
    ),
)
def get_me(
    current_user: User = Depends(get_current_user),
):
    """Requires any valid access token."""
    profile = UserProfileOut(
        user=UserOut.model_validate(current_user),
        office=OfficeOut.model_validate(current_user.office),
        roles=list(current_user.role_names),
        permissions=list(current_user.permission_codes),
    )
    return StandardSuccessResponse(
        data=profile,
        message="Profile retrieved successfully",
    )


@router.post(
    "/change-password",
    response_model=StandardSuccessResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Change own password",
    description=(
        "Authenticated user changes their own password by providing "
        "their current password and a new password."
    ),
)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Requires a valid access token."""
    AuthService.change_password(
        db=db,
        user=current_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    return StandardSuccessResponse(
        data=None,
        message="Password changed successfully",
    )


@router.post(
    "/admin-reset-password/{user_id}",
    response_model=StandardSuccessResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Admin: reset user password",
    description=(
        "A privileged admin resets another user's password to a temporary value. "
        "The target user must change it on next login."
    ),
)
def admin_reset_password(
    user_id: UUID,
    payload: AdminResetPassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("MANAGE_USERS")),
):
    """Requires MANAGE_USERS permission."""
    UserService.admin_reset_password(
        db=db,
        user_id=user_id,
        temporary_password=payload.temporary_password,
        actor=current_user,
    )
    return StandardSuccessResponse(
        data=None,
        message="Password reset successfully",
    )
