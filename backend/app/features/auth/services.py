"""Authentication Service

Manages credential verification, JWT issuance, token refresh, and account security policies.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import AuthenticationError, ValidationError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    revoke_token,
    validate_password_strength,
    verify_password,
)
from app.features.audit.services import AuditService
from app.features.auth.schemas import LoginRequest, LoginResponse
from app.features.users.models import User
from app.features.users.services import UserService


class AuthService:
    MAX_FAILED_ATTEMPTS = 5

    @staticmethod
    def login(
        db: Session,
        payload: LoginRequest,
        ip_address: str = "127.0.0.1",
        user_agent: Optional[str] = None,
    ) -> LoginResponse:
        user = UserService.get_user_by_username_or_email(db, payload.username)
        if not user:
            AuditService.log_action(
                db=db,
                action="LOGIN",
                module="AUTH",
                record_id="UNKNOWN",
                ip_address=ip_address,
                user_agent=user_agent,
                outcome="FAILURE",
                new_values={"username": payload.username, "reason": "USER_NOT_FOUND"},
            )
            db.commit()
            raise AuthenticationError("Invalid username or password", code="INVALID_CREDENTIALS")

        # Check account status
        if user.status == "LOCKED":
            AuditService.log_action(
                db=db,
                action="LOGIN",
                module="AUTH",
                record_id=str(user.id),
                actor=user,
                ip_address=ip_address,
                user_agent=user_agent,
                outcome="FAILURE",
                new_values={"reason": "ACCOUNT_LOCKED"},
            )
            db.commit()
            raise AuthenticationError(
                "Account is locked due to repeated failed login attempts. Contact System Admin.",
                code="ACCOUNT_LOCKED",
            )

        if user.status == "INACTIVE":
            AuditService.log_action(
                db=db,
                action="LOGIN",
                module="AUTH",
                record_id=str(user.id),
                actor=user,
                ip_address=ip_address,
                user_agent=user_agent,
                outcome="FAILURE",
                new_values={"reason": "ACCOUNT_INACTIVE"},
            )
            db.commit()
            raise AuthenticationError("Account is inactive. Contact System Admin.", code="ACCOUNT_INACTIVE")

        # Verify password
        if not verify_password(payload.password, user.hashed_password):
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= AuthService.MAX_FAILED_ATTEMPTS:
                user.status = "LOCKED"

            db.flush()
            AuditService.log_action(
                db=db,
                action="LOGIN",
                module="AUTH",
                record_id=str(user.id),
                actor=user,
                ip_address=ip_address,
                user_agent=user_agent,
                outcome="FAILURE",
                new_values={
                    "failed_attempts": user.failed_login_attempts,
                    "locked": user.status == "LOCKED",
                },
            )
            db.commit()
            raise AuthenticationError("Invalid username or password", code="INVALID_CREDENTIALS")

        # Successful login
        user.failed_login_attempts = 0
        user.last_login_at = datetime.now(timezone.utc)
        db.flush()

        token_data = {
            "sub": str(user.id),
            "username": user.username,
            "office_id": str(user.office_id),
            "roles": user.role_names,
        }

        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        AuditService.log_action(
            db=db,
            action="LOGIN",
            module="AUTH",
            record_id=str(user.id),
            actor=user,
            ip_address=ip_address,
            user_agent=user_agent,
            outcome="SUCCESS",
        )
        db.commit()
        db.refresh(user)

        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user=user,
        )

    @staticmethod
    def logout(
        token: str,
        refresh_token: Optional[str] = None,
        user: Optional[User] = None,
        db: Optional[Session] = None,
        ip_address: str = "127.0.0.1",
    ) -> None:
        revoke_token(token)
        if refresh_token:
            revoke_token(refresh_token)

        if user and db:
            AuditService.log_action(
                db=db,
                action="LOGOUT",
                module="AUTH",
                record_id=str(user.id),
                actor=user,
                ip_address=ip_address,
                outcome="SUCCESS",
            )
            db.commit()

    @staticmethod
    def refresh_access_token(db: Session, refresh_token: str) -> str:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise AuthenticationError("Invalid token type: expected refresh token", code="INVALID_TOKEN")

        user_id_str = payload.get("sub")
        if not user_id_str:
            raise AuthenticationError("Invalid refresh token payload", code="INVALID_TOKEN")

        user = UserService.get_user(db, UUID(user_id_str))
        if user.status != "ACTIVE":
            raise AuthenticationError("Account is not active", code="ACCOUNT_INACTIVE")

        token_data = {
            "sub": str(user.id),
            "username": user.username,
            "office_id": str(user.office_id),
            "roles": user.role_names,
        }
        return create_access_token(token_data)

    @staticmethod
    def change_password(
        db: Session,
        user: User,
        current_password: str,
        new_password: str,
        confirm_password: str,
        ip_address: str = "127.0.0.1",
    ) -> None:
        if new_password != confirm_password:
            raise ValidationError("New password and confirm password do not match")

        if not verify_password(current_password, user.hashed_password):
            raise AuthenticationError("Current password is incorrect", code="INVALID_CURRENT_PASSWORD")

        validate_password_strength(new_password)

        user.hashed_password = hash_password(new_password)
        if user.status == "PASSWORD_RESET_REQUIRED":
            user.status = "ACTIVE"

        db.flush()
        AuditService.log_action(
            db=db,
            action="UPDATE",
            module="AUTH",
            record_id=str(user.id),
            actor=user,
            ip_address=ip_address,
            new_values={"action": "PASSWORD_CHANGED"},
        )
        db.commit()

