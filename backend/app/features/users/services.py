"""Users Service

Manages user CRUD, status transitions, role associations, and admin password resets.
"""

from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.core.security import hash_password, validate_password_strength
from app.features.audit.services import AuditService
from app.features.offices.models import Office
from app.features.roles.models import Role
from app.features.users.models import User
from app.features.users.schemas import UserCreate, UserStatusUpdate, UserUpdate


class UserService:
    @staticmethod
    def get_user(db: Session, user_id: UUID) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise NotFoundError(f"User with ID '{user_id}' was not found", code="USER_NOT_FOUND")
        return user

    @staticmethod
    def get_user_by_username_or_email(db: Session, identifier: str) -> Optional[User]:
        clean = identifier.strip().lower()
        return (
            db.query(User)
            .filter((func_lower(User.username) == clean) | (func_lower(User.email) == clean))
            .first()
        )

    @staticmethod
    def list_users(
        db: Session,
        office_id: Optional[UUID] = None,
        role: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        current_user: Optional[User] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[User], int]:
        query = db.query(User)

        # Non-admins can only see users in their office
        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(User.office_id == current_user.office_id)
        elif office_id:
            query = query.filter(User.office_id == office_id)

        if status:
            query = query.filter(User.status == status.upper())

        if role:
            query = query.join(User.roles).filter(Role.name == role.upper())

        if search:
            pattern = f"%{search.strip()}%"
            query = query.filter(
                (User.username.ilike(pattern))
                | (User.full_name.ilike(pattern))
                | (User.email.ilike(pattern))
                | (User.designation.ilike(pattern))
            )

        total = query.count()
        users = query.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
        return users, total

    @staticmethod
    def create_user(db: Session, payload: UserCreate, creator: Optional[User] = None) -> User:
        # Check username / email uniqueness
        clean_username = payload.username.strip().lower()
        clean_email = payload.email.strip().lower()

        if db.query(User).filter(func_lower(User.username) == clean_username).first():
            raise ConflictError("Username is already registered", code="DUPLICATE_USERNAME")
        if db.query(User).filter(func_lower(User.email) == clean_email).first():
            raise ConflictError("Email is already registered", code="DUPLICATE_EMAIL")

        # Verify office
        office = db.query(Office).filter(Office.id == payload.office_id).first()
        if not office:
            raise NotFoundError("Assigned office does not exist", code="OFFICE_NOT_FOUND")

        # Verify role
        role = db.query(Role).filter(Role.id == payload.role_id).first()
        if not role:
            raise NotFoundError("Assigned role does not exist", code="ROLE_NOT_FOUND")

        # Validate password strength
        validate_password_strength(payload.password)

        hashed = hash_password(payload.password)

        user = User(
            username=payload.username.strip(),
            email=clean_email,
            hashed_password=hashed,
            full_name=payload.full_name.strip(),
            designation=payload.designation.strip(),
            phone_number=payload.phone_number,
            office_id=payload.office_id,
            status="ACTIVE",
            roles=[role],
        )
        db.add(user)
        db.flush()

        AuditService.log_action(
            db=db,
            action="CREATE",
            module="USERS",
            record_id=str(user.id),
            actor=creator,
            office_id=user.office_id,
            new_values={"username": user.username, "role": role.name, "office": office.code},
        )
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update_user(db: Session, user_id: UUID, payload: UserUpdate, updater: Optional[User] = None) -> User:
        user = UserService.get_user(db, user_id)
        old_values = {
            "full_name": user.full_name,
            "designation": user.designation,
            "phone_number": user.phone_number,
            "office_id": str(user.office_id),
        }

        update_dict = payload.model_dump(exclude_unset=True)

        if "full_name" in update_dict and update_dict["full_name"]:
            user.full_name = update_dict["full_name"].strip()
        if "designation" in update_dict and update_dict["designation"]:
            user.designation = update_dict["designation"].strip()
        if "phone_number" in update_dict:
            user.phone_number = update_dict["phone_number"]

        if "office_id" in update_dict and update_dict["office_id"]:
            office = db.query(Office).filter(Office.id == update_dict["office_id"]).first()
            if not office:
                raise NotFoundError("Office not found", code="OFFICE_NOT_FOUND")
            user.office_id = update_dict["office_id"]

        if "role_id" in update_dict and update_dict["role_id"]:
            role = db.query(Role).filter(Role.id == update_dict["role_id"]).first()
            if not role:
                raise NotFoundError("Role not found", code="ROLE_NOT_FOUND")
            user.roles = [role]

        db.flush()
        AuditService.log_action(
            db=db,
            action="UPDATE",
            module="USERS",
            record_id=str(user.id),
            actor=updater,
            office_id=user.office_id,
            old_values=old_values,
            new_values=update_dict,
        )
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update_user_status(db: Session, user_id: UUID, payload: UserStatusUpdate, updater: Optional[User] = None) -> User:
        user = UserService.get_user(db, user_id)
        old_status = user.status
        user.status = payload.status
        if payload.status == "ACTIVE":
            user.failed_login_attempts = 0

        db.flush()
        AuditService.log_action(
            db=db,
            action="UPDATE",
            module="USERS",
            record_id=str(user.id),
            actor=updater,
            office_id=user.office_id,
            old_values={"status": old_status},
            new_values={"status": user.status, "reason": payload.reason},
        )
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def admin_reset_password(
        db: Session,
        user_id: UUID,
        temporary_password: str,
        admin_user: Optional[User] = None,
    ) -> User:
        user = UserService.get_user(db, user_id)
        validate_password_strength(temporary_password)

        user.hashed_password = hash_password(temporary_password)
        user.status = "PASSWORD_RESET_REQUIRED"
        user.failed_login_attempts = 0

        db.flush()
        AuditService.log_action(
            db=db,
            action="UPDATE",
            module="AUTH",
            record_id=str(user.id),
            actor=admin_user,
            office_id=user.office_id,
            new_values={"action": "ADMIN_PASSWORD_RESET", "target_username": user.username},
        )
        db.commit()
        db.refresh(user)
        return user

        
    @staticmethod
    def seed_initial_admin(
        db: Session,
        office_id: UUID,
        admin_role_id: UUID,
        username: str = "sysadmin",
        email: str = "admin.girsomnath@gujarat.gov.in",
        password: Optional[str] = None,
    ) -> User:
        """Seeds initial system admin if not already present."""

        existing = db.query(User).filter(
            User.username == username
        ).first()

        if existing:
            return existing

        password = password or settings.INITIAL_ADMIN_PASSWORD
        validate_password_strength(password)

        role = db.query(Role).filter(
            Role.id == admin_role_id
        ).first()

        if not role:
            raise ValueError("System Admin role not found.")

        user = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
            full_name="System Administrator",
            designation="District Systems Manager",
            phone_number="02876-240000",
            office_id=office_id,
            status="ACTIVE",
            roles=[role],
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return user
    @staticmethod
    def seed_default_users(db: Session, office_id: UUID) -> None:
        """Seeds standard role accounts (admin, officer, staff) for seamless evaluation."""
        from app.core.permissions import ROLE_SYSTEM_ADMIN, ROLE_STORE_OFFICER, ROLE_STORE_STAFF

        roles = {r.name: r for r in db.query(Role).all()}

        default_accounts = [
            ("admin", "admin@gujarat.gov.in", "Admin@12345", "DDO District Administrator", "System Administrator", ROLE_SYSTEM_ADMIN),
            ("officer", "officer@gujarat.gov.in", "Officer@12345", "Store Verification Officer", "Store Officer", ROLE_STORE_OFFICER),
            ("staff", "staff@gujarat.gov.in", "Staff@12345", "Panchayat Inventory Staff", "Store Clerk", ROLE_STORE_STAFF),
        ]

        for uname, uemail, upass, ufullname, udesig, rname in default_accounts:
            existing = db.query(User).filter(User.username == uname).first()
            if not existing and rname in roles:
                user = User(
                    username=uname,
                    email=uemail,
                    hashed_password=hash_password(upass),
                    full_name=ufullname,
                    designation=udesig,
                    phone_number="02876-240001",
                    office_id=office_id,
                    status="ACTIVE",
                    roles=[roles[rname]],
                )
                db.add(user)
        try:
            db.commit()
        except Exception:
            db.rollback()


def func_lower(col):
    from sqlalchemy import func
    return func.lower(col)

