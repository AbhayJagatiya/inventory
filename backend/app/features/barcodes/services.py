"""Barcode & QR Service

Fast scanner resolution and label generation.
"""

from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import NotFoundError, ValidationError
from app.features.barcodes.schemas import BarcodeLookupOut
from app.features.inventory.models import Item


class BarcodeService:
    @staticmethod
    def lookup_barcode(db: Session, barcode: str, office_id: Optional[UUID] = None) -> BarcodeLookupOut:
        clean_code = barcode.strip()
        query = db.query(Item).filter(
            (Item.barcode_number == clean_code)
            | (Item.item_code == clean_code)
            | (Item.serial_number == clean_code)
        )
        if office_id:
            query = query.filter(Item.office_id == office_id)

        item = query.first()
        if not item:
            raise NotFoundError(f"No active inventory record found matching barcode '{barcode}'", code="UNKNOWN_BARCODE")

        if item.operational_status == "DISPOSED":
            raise ValidationError(
                f"Asset '{item.item_code}' is officially DISPOSED and cannot be scanned for operational workflows.",
                code="DISPOSED_ITEM",
            )

        return BarcodeLookupOut(
            item_id=item.id,
            office_id=item.office_id,
            item_code=item.item_code,
            barcode_number=item.barcode_number or item.item_code,
            item_name=item.item_name,
            category_name=item.category.name if item.category else "Uncategorized",
            location_name=f"{item.location.building_name} ({item.location.room_number})" if item.location else "Unknown",
            condition=item.condition,
            operational_status=item.operational_status,
            current_classification=item.current_classification,
            current_custodian=item.current_custodian,
            unit_purchase_cost=float(item.unit_purchase_cost),
        )

    @staticmethod
    def generate_barcode_label_svg(item: Item) -> str:
        """Generates clean SVG layout containing 1D barcode and 2D QR Code data representation."""
        code = item.barcode_number or item.item_code
        name = item.item_name[:35]
        office_name = item.office.name if item.office else "District Panchayat Gir Somnath"

        # Construct vector SVG
        svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220" viewBox="0 0 400 220">
    <rect width="100%" height="100%" fill="#ffffff" stroke="#1e293b" stroke-width="2" rx="8"/>
    <!-- Header -->
    <rect width="100%" height="32" fill="#1e3a8a" rx="6" ry="6"/>
    <text x="200" y="21" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">
        {office_name}
    </text>
    
    <!-- Item Info -->
    <text x="20" y="60" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">
        {name}
    </text>
    <text x="20" y="78" font-family="Arial, sans-serif" font-size="11" fill="#475569">
        Code: {item.item_code} | Cat: {item.category.name if item.category else 'N/A'}
    </text>
    
    <!-- Barcode simulation bars -->
    <g transform="translate(20, 95)">
        <rect x="0" y="0" width="4" height="60" fill="#000000"/>
        <rect x="7" y="0" width="2" height="60" fill="#000000"/>
        <rect x="12" y="0" width="6" height="60" fill="#000000"/>
        <rect x="22" y="0" width="3" height="60" fill="#000000"/>
        <rect x="28" y="0" width="8" height="60" fill="#000000"/>
        <rect x="40" y="0" width="2" height="60" fill="#000000"/>
        <rect x="46" y="0" width="5" height="60" fill="#000000"/>
        <rect x="55" y="0" width="7" height="60" fill="#000000"/>
        <rect x="66" y="0" width="2" height="60" fill="#000000"/>
        <rect x="72" y="0" width="4" height="60" fill="#000000"/>
        <rect x="80" y="0" width="6" height="60" fill="#000000"/>
        <rect x="90" y="0" width="3" height="60" fill="#000000"/>
        <rect x="97" y="0" width="5" height="60" fill="#000000"/>
        <rect x="106" y="0" width="2" height="60" fill="#000000"/>
        <rect x="112" y="0" width="7" height="60" fill="#000000"/>
        <rect x="123" y="0" width="4" height="60" fill="#000000"/>
        <rect x="131" y="0" width="2" height="60" fill="#000000"/>
        <rect x="137" y="0" width="6" height="60" fill="#000000"/>
        <rect x="147" y="0" width="3" height="60" fill="#000000"/>
        <rect x="154" y="0" width="8" height="60" fill="#000000"/>
        <rect x="166" y="0" width="2" height="60" fill="#000000"/>
        <rect x="172" y="0" width="5" height="60" fill="#000000"/>
        <rect x="181" y="0" width="4" height="60" fill="#000000"/>
        <rect x="189" y="0" width="2" height="60" fill="#000000"/>
        <rect x="195" y="0" width="6" height="60" fill="#000000"/>
        <rect x="205" y="0" width="4" height="60" fill="#000000"/>
    </g>
    
    <!-- Barcode Value String -->
    <text x="125" y="172" font-family="Courier, monospace" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle">
        *{code}*
    </text>
    
    <!-- 2D QR Code box placeholder -->
    <g transform="translate(290, 85)">
        <rect width="80" height="80" fill="#f8fafc" stroke="#64748b" stroke-width="1.5" rx="4"/>
        <rect x="8" y="8" width="20" height="20" fill="#000000"/>
        <rect x="12" y="12" width="12" height="12" fill="#ffffff"/>
        <rect x="52" y="8" width="20" height="20" fill="#000000"/>
        <rect x="56" y="12" width="12" height="12" fill="#ffffff"/>
        <rect x="8" y="52" width="20" height="20" fill="#000000"/>
        <rect x="12" y="56" width="12" height="12" fill="#ffffff"/>
        <rect x="36" y="36" width="12" height="12" fill="#000000"/>
        <rect x="36" y="12" width="8" height="8" fill="#000000"/>
        <rect x="12" y="36" width="8" height="8" fill="#000000"/>
        <rect x="56" y="36" width="8" height="8" fill="#000000"/>
        <rect x="36" y="56" width="8" height="8" fill="#000000"/>
        <text x="40" y="98" font-family="Arial, sans-serif" font-size="9" fill="#64748b" text-anchor="middle">QR Scan</text>
    </g>
    
    <!-- Footer -->
    <text x="20" y="200" font-family="Arial, sans-serif" font-size="10" fill="#94a3b8">
        Property of District Development Office, Gir Somnath (Veraval)
    </text>
</svg>"""
        return svg_content

