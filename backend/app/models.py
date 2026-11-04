"""Unified Models Exporter and Metadata Aggregator

Ensures all SQLAlchemy declarative models are imported and registered with Base.metadata.
"""

from app.core.database import Base
from app.features.offices.models import Office
from app.features.roles.models import Role, Permission, role_permissions
from app.features.users.models import User, user_roles
from app.features.locations.models import Location
from app.features.categories.models import Category, UnitOfMeasure
from app.features.suppliers.models import Supplier
from app.features.procurement.models import Procurement, ProcurementItem, SupplierReturn
from app.features.inventory.models import Item, StockBalance
from app.features.ledger.models import StockTransaction, StockTransactionLine
from app.features.classification.models import Classification
from app.features.verification.models import VerificationSession, VerificationItem, VerificationScanEvent
from app.features.documents.models import AssetDocument
from app.features.warranties.models import Warranty
from app.features.maintenance.models import MaintenanceRecord
from app.features.condemnation.models import CondemnationRequest, CondemnationRequestItem, ApprovalAction
from app.features.disposal.models import Disposal, DisposalItem
from app.features.alerts.models import Alert, Notification
from app.features.settings.models import SystemSetting
from app.features.audit.models import AuditLog

__all__ = [
    "Base",
    "Office",
    "Role",
    "Permission",
    "role_permissions",
    "User",
    "user_roles",
    "Location",
    "Category",
    "UnitOfMeasure",
    "Supplier",
    "Procurement",
    "ProcurementItem",
    "SupplierReturn",
    "Item",
    "StockBalance",
    "StockTransaction",
    "StockTransactionLine",
    "Classification",
    "VerificationSession",
    "VerificationItem",
    "VerificationScanEvent",
    "AssetDocument",
    "Warranty",
    "MaintenanceRecord",
    "CondemnationRequest",
    "CondemnationRequestItem",
    "ApprovalAction",
    "Disposal",
    "DisposalItem",
    "Alert",
    "Notification",
    "SystemSetting",
    "AuditLog",
]

