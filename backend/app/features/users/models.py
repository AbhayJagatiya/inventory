"""Users Database Models

Defines users table and user_roles many-to-many relationship.
"""

import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Uuid, func
from sqlalchemy.orm import relationship
from app.core.database import Base

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Uuid, ForeignKey("roles.id", ondelete="RESTRICT"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    office_id = Column(Uuid, ForeignKey("offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(120), nullable=False)
    designation = Column(String(100), nullable=False)
    phone_number = Column(String(20), nullable=True)
    status = Column(String(30), nullable=False, default="ACTIVE", index=True)
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    office = relationship("Office", back_populates="users")
    roles = relationship("Role", secondary=user_roles, back_populates="users", lazy="joined")

    @property
    def is_active(self) -> bool:
        return self.status == "ACTIVE"

    @property
    def role_names(self) -> list[str]:
        return [r.name for r in self.roles]

    @property
    def permission_codes(self) -> set[str]:
        perms = set()
        for r in self.roles:
            for p in r.permissions:
                perms.add(p.code)
        return perms

