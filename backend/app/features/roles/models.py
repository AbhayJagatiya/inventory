"""Roles and Permissions Database Models

Defines RBAC tables: roles, permissions, and role_permissions.
"""

import uuid
from sqlalchemy import Boolean, Column, ForeignKey, String, Table, Text, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base

role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Uuid, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Uuid, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


class Role(Base):
    __tablename__ = "roles"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_system_role = Column(Boolean, nullable=False, default=True)

    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles", lazy="joined")
    users = relationship("User", secondary="user_roles", back_populates="roles")


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    code = Column(String(80), unique=True, nullable=False, index=True)
    module = Column(String(50), nullable=False, index=True)
    action = Column(String(30), nullable=False)
    description = Column(Text, nullable=True)

    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")

