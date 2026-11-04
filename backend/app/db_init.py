
"""Database Initialization and Seed Script."""

import logging
import app.models

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.permissions import ROLE_SYSTEM_ADMIN

from app.features.categories.services import CategoryService
from app.features.locations.services import LocationService
from app.features.offices.services import OfficeService
from app.features.roles.services import RoleService
from app.features.roles.models import Role
from app.features.users.services import UserService
from app.features.settings.services import SettingsService

logger = logging.getLogger("app.db_init")


def initialize_database() -> None:
    """Initialize baseline records safely."""

    db: Session = SessionLocal()

    try:
        logger.info("Running database initialization...")

        # 1. Initial office
        office = OfficeService.seed_initial_veraval_office(db)

        # 2. Default roles and permissions
        RoleService.seed_default_roles_and_permissions(db)

        # 3. Retrieve System Admin role
        admin_role = db.query(Role).filter(
            Role.name == ROLE_SYSTEM_ADMIN
        ).first()

        if not admin_role:
            raise RuntimeError("System Admin role not found.")

        # 4. Initial admin
        UserService.seed_initial_admin(
            db=db,
            office_id=office.id,
            admin_role_id=admin_role.id,
        )
        UserService.seed_default_users(
            db=db,
            office_id=office.id,
        )

        # 5. Categories and UOMs
        CategoryService.seed_default_categories_and_uoms(db)

        # 6. Locations
        LocationService.seed_default_locations(
            db,
            office_id=office.id,
        )

        # 7. System settings
        SettingsService.seed_default_settings(db)

        logger.info("Database initialization completed successfully.")

    except Exception as exc:
        db.rollback()
        logger.error(
            f"Database initialization failed: {exc}",
            exc_info=True,
        )
        raise

    finally:
        db.close()
