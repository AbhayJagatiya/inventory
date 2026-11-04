"""Locations Service

Manages building rooms, stores, yards, and validates composite office isolation.
"""

from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import ConflictError, NotFoundError, OfficeAccessDeniedError, ValidationError
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.audit.services import AuditService
from app.features.inventory.models import Item
from app.features.locations.models import Location
from app.features.locations.schemas import LocationCreate, LocationUpdate
from app.features.offices.models import Office
from app.features.users.models import User

DEFAULT_LOCATIONS = [
    ("Main Store Room A", "Ground Floor", "G-01", "STORE_ROOM", "Central dead stock and durable equipment store"),
    ("Stationery Store B", "Ground Floor", "G-02", "STORE_ROOM", "Consumables and office supplies storage"),
    ("Administrative Block Cabin", "1st Floor", "101", "OFFICE_ROOM", "Store Officer administrative room"),
    ("Record Room", "Basement", "B-01", "RECORD_ROOM", "Physical register and archived documents repository"),
    ("Panchayat Open Yard", "Ground Floor", "YARD-01", "OPEN_YARD", "Heavy machinery and condemnation survey area"),
]


class LocationService:
    @staticmethod
    def get_location(db: Session, location_id: UUID, current_user: Optional[User] = None) -> Location:
        loc = db.query(Location).filter(Location.id == location_id).first()
        if not loc:
            raise NotFoundError(f"Location with ID '{location_id}' was not found", code="LOCATION_NOT_FOUND")

        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            if loc.office_id != current_user.office_id:
                raise OfficeAccessDeniedError("Access to location in another office is denied")

        loc.active_items_count = db.query(Item).filter(Item.location_id == loc.id, Item.operational_status != "DISPOSED").count()
        return loc

    @staticmethod
    def list_locations(
        db: Session,
        office_id: Optional[UUID] = None,
        location_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> List[Location]:
        query = db.query(Location)

        # Enforce office scope
        if current_user and ROLE_SYSTEM_ADMIN not in current_user.role_names:
            query = query.filter(Location.office_id == current_user.office_id)
        elif office_id:
            query = query.filter(Location.office_id == office_id)

        if location_type:
            query = query.filter(Location.location_type == location_type.upper())
        if is_active is not None:
            query = query.filter(Location.is_active == is_active)
        if search:
            query = query.filter(
                (Location.building_name.ilike(f"%{search}%"))
                | (Location.room_number.ilike(f"%{search}%"))
                | (Location.description.ilike(f"%{search}%"))
            )

        locations = query.order_by(Location.building_name.asc(), Location.room_number.asc()).all()
        for loc in locations:
            loc.active_items_count = db.query(Item).filter(Item.location_id == loc.id, Item.operational_status != "DISPOSED").count()
        return locations

    @staticmethod
    def create_location(db: Session, payload: LocationCreate, creator: Optional[User] = None) -> Location:
        # Auto-resolve office_id if not explicitly provided
        if not payload.office_id and creator:
            payload.office_id = creator.office_id

        # Verify office
        office = db.query(Office).filter(Office.id == payload.office_id).first()
        if not office:
            raise NotFoundError("Office does not exist", code="OFFICE_NOT_FOUND")

        if creator and ROLE_SYSTEM_ADMIN not in creator.role_names and payload.office_id != creator.office_id:
            raise OfficeAccessDeniedError("Cannot create a location for an office other than your assigned office")

        # Check unique constraint (office_id, building_name, floor, room_number)
        dup = (
            db.query(Location)
            .filter(
                Location.office_id == payload.office_id,
                Location.building_name == payload.building_name.strip(),
                Location.floor == payload.floor.strip(),
                Location.room_number == payload.room_number.strip(),
            )
            .first()
        )
        if dup:
            raise ConflictError(
                f"Location '{payload.room_number}' in building '{payload.building_name}' already exists in this office",
                code="DUPLICATE_LOCATION",
            )

        loc = Location(
            office_id=payload.office_id,
            building_name=payload.building_name.strip(),
            floor=payload.floor.strip(),
            room_number=payload.room_number.strip(),
            location_type=payload.location_type.strip().upper(),
            description=payload.description.strip() if payload.description else None,
            is_active=True,
        )
        db.add(loc)
        db.flush()

        AuditService.log_action(
            db=db,
            action="CREATE",
            module="LOCATIONS",
            record_id=str(loc.id),
            actor=creator,
            office_id=loc.office_id,
            new_values={"building": loc.building_name, "room": loc.room_number},
        )
        db.commit()
        db.refresh(loc)
        loc.active_items_count = 0
        return loc

    @staticmethod
    def update_location(
        db: Session,
        location_id: UUID,
        payload: LocationUpdate,
        updater: Optional[User] = None,
    ) -> Location:
        loc = LocationService.get_location(db, location_id, current_user=updater)
        old_values = {
            "building_name": loc.building_name,
            "floor": loc.floor,
            "room_number": loc.room_number,
            "is_active": loc.is_active,
        }

        update_dict = payload.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(loc, field, value)

        db.flush()
        AuditService.log_action(
            db=db,
            action="UPDATE",
            module="LOCATIONS",
            record_id=str(loc.id),
            actor=updater,
            office_id=loc.office_id,
            old_values=old_values,
            new_values=update_dict,
        )
        db.commit()
        db.refresh(loc)
        loc.active_items_count = db.query(Item).filter(Item.location_id == loc.id, Item.operational_status != "DISPOSED").count()
        return loc

    @staticmethod
    def delete_location(db: Session, location_id: UUID, actor: Optional[User] = None) -> None:
        loc = LocationService.get_location(db, location_id, current_user=actor)
        active_items = db.query(Item).filter(Item.location_id == loc.id, Item.operational_status != "DISPOSED").count()
        if active_items > 0:
            raise ValidationError(f"Cannot deactivate location: {active_items} items currently reside in this location.")

        loc.is_active = False
        db.flush()
        AuditService.log_action(
            db=db,
            action="DELETE",
            module="LOCATIONS",
            record_id=str(loc.id),
            actor=actor,
            office_id=loc.office_id,
            new_values={"is_active": False},
        )
        db.commit()

    @staticmethod
    def seed_default_locations(db: Session, office_id: UUID) -> None:
        for bldg, floor, room, loc_type, desc in DEFAULT_LOCATIONS:
            exists = (
                db.query(Location)
                .filter(
                    Location.office_id == office_id,
                    Location.building_name == bldg,
                    Location.floor == floor,
                    Location.room_number == room,
                )
                .first()
            )
            if not exists:
                db.add(
                    Location(
                        office_id=office_id,
                        building_name=bldg,
                        floor=floor,
                        room_number=room,
                        location_type=loc_type,
                        description=desc,
                        is_active=True,
                    )
                )
        db.commit()

