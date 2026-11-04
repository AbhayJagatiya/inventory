"""Roles and Permissions Service

Manages RBAC masters, seed definitions, and dynamic role-permission mappings.
"""

from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import NotFoundError, ValidationError
from app.core.permissions import (
    DEFAULT_ROLE_PERMISSIONS,
    PERMISSIONS_CATALOGUE,
    ROLE_STORE_OFFICER,
    ROLE_STORE_STAFF,
    ROLE_SYSTEM_ADMIN,
)
from app.features.audit.services import AuditService
from app.features.roles.models import Permission, Role
from app.features.users.models import User


class RoleService:
    @staticmethod
    def list_roles(db: Session) -> List[Role]:
        return db.query(Role).order_by(Role.name.asc()).all()

    @staticmethod
    def get_role(db: Session, role_id: UUID) -> Role:
        role = db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise NotFoundError(f"Role with ID '{role_id}' was not found", code="ROLE_NOT_FOUND")
        return role

    @staticmethod
    def get_role_by_name(db: Session, name: str) -> Optional[Role]:
        return db.query(Role).filter(Role.name == name.upper()).first()

    @staticmethod
    def list_permissions(db: Session) -> List[Permission]:
        return db.query(Permission).order_by(Permission.module.asc(), Permission.code.asc()).all()

    @staticmethod
    def configure_role_permissions(
        db: Session,
        role_id: UUID,
        permission_ids: List[UUID],
        updater: Optional[User] = None,
    ) -> Role:
        role = RoleService.get_role(db, role_id)
        new_permissions = db.query(Permission).filter(Permission.id.in_(permission_ids)).all()

        if len(new_permissions) != len(permission_ids):
            raise ValidationError("One or more permission IDs are invalid")

        old_perms = [p.code for p in role.permissions]
        role.permissions = new_permissions
        db.flush()

        AuditService.log_action(
            db=db,
            action="UPDATE",
            module="ROLES",
            record_id=str(role.id),
            actor=updater,
            old_values={"permissions": old_perms},
            new_values={"permissions": [p.code for p in new_permissions]},
        )
        db.commit()
        db.refresh(role)
        return role

    @staticmethod
    def seed_default_roles_and_permissions(db: Session) -> None:
        """Seeds all approved permissions and default role mappings into the database."""
        # 1. Seed Permissions
        existing_perms = {p.code: p for p in db.query(Permission).all()}
        for code, (module, action, desc) in PERMISSIONS_CATALOGUE.items():
            if code not in existing_perms:
                new_p = Permission(code=code, module=module, action=action, description=desc)
                db.add(new_p)
                existing_perms[code] = new_p

        db.flush()

        # 2. Seed Standard Roles
        roles_meta = {
            ROLE_SYSTEM_ADMIN: ("System Administrator", "Full technical administrative governance and security"),
            ROLE_STORE_OFFICER: ("Store Officer", "Supervisory authority, verification lead, and dead stock reviewer"),
            ROLE_STORE_STAFF: ("Store Staff", "Day-to-day data entry, inward receipts, and outward issues"),
        }

        for role_name, (display_name, desc) in roles_meta.items():
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                role = Role(name=role_name, display_name=display_name, description=desc, is_system_role=True)
                db.add(role)
                db.flush()

            # Assign approved default permissions
            target_codes = DEFAULT_ROLE_PERMISSIONS.get(role_name, [])
            target_perms = [existing_perms[code] for code in target_codes if code in existing_perms]
            role.permissions = target_perms

        db.commit()

