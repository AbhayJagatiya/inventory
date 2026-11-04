
"""
Barcode and QR code routes.
Prefix: /api/v1/barcodes
"""

import base64
from io import BytesIO
from uuid import UUID

import barcode as barcode_lib
import qrcode
from barcode.writer import ImageWriter
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy.orm import Session, joinedload

from app.core.common_schemas import StandardSuccessResponse
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.core.permissions import ROLE_SYSTEM_ADMIN
from app.features.barcodes.schemas import (
    BarcodeLookupRequest,
    BarcodeLookupOut,
)
from app.features.barcodes.services import BarcodeService
from app.features.inventory.models import Item
from app.features.users.models import User


router = APIRouter()


def _build_label_image(item: Item) -> Image.Image:
    """Create a label containing a real Code 128 barcode and QR code."""

    code = item.barcode_number or item.item_code

    # Generate actual Code 128 barcode.
    barcode_class = barcode_lib.get("code128", code, writer=ImageWriter())
    barcode_image = barcode_class.render(
        writer_options={
            "module_width": 0.35,
            "module_height": 22,
            "quiet_zone": 5,
            "font_size": 12,
            "text_distance": 5,
        }
    ).convert("RGB")

    # Generate an actual QR code containing the item identifier.
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=3,
    )
    qr.add_data(code)
    qr.make(fit=True)
    qr_image = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    # Label canvas.
    canvas = Image.new("RGB", (1000, 500), "white")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()

    def safe_text(value: str) -> str:
        # Avoid failures with characters unsupported by the default font.
        return str(value).encode("latin-1", errors="replace").decode("latin-1")

    office_name = item.office.name if item.office else "District Development Office"
    category_name = item.category.name if item.category else "N/A"
    location_name = (
        f"{item.location.building_name} - {item.location.room_number}"
        if item.location
        else "N/A"
    )

    draw.rectangle((5, 5, 995, 495), outline="black", width=3)
    draw.text((25, 20), safe_text(office_name), fill="black", font=font)
    draw.text((25, 65), safe_text(item.item_name), fill="black", font=font)
    draw.text((25, 100), safe_text(f"Item Code: {item.item_code}"), fill="black", font=font)
    draw.text((25, 130), safe_text(f"Category: {category_name}"), fill="black", font=font)
    draw.text((25, 160), safe_text(f"Location: {location_name}"), fill="black", font=font)

    # Fit barcode into the left side of the label.
    barcode_image.thumbnail((700, 220))
    canvas.paste(barcode_image, (25, 205))

    draw.text((25, 445), safe_text(code), fill="black", font=font)

    # QR code on the right side.
    qr_image.thumbnail((210, 210))
    canvas.paste(qr_image, (755, 190))
    draw.text((790, 410), "SCAN QR", fill="black", font=font)

    return canvas


def _build_label_response(item: Item, output_format: str) -> Response:
    """Render label as PNG, SVG or PDF."""

    image = _build_label_image(item)
    buffer = BytesIO()

    if output_format == "png":
        image.save(buffer, format="PNG")
        media_type = "image/png"

    elif output_format == "svg":
        # SVG container embeds the generated label PNG.
        png_buffer = BytesIO()
        image.save(png_buffer, format="PNG")
        encoded_image = base64.b64encode(png_buffer.getvalue()).decode("ascii")

        svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        width="1000" height="500" viewBox="0 0 1000 500">
        <image width="1000" height="500"
        xlink:href="data:image/png;base64,{encoded_image}"/>
        </svg>"""

        return Response(
            content=svg_content,
            media_type="image/svg+xml",
            headers={
                "Content-Disposition": f'inline; filename="barcode-{item.item_code}.svg"'
            },
        )

    elif output_format == "pdf":
        image.save(buffer, format="PDF", resolution=150.0)
        media_type = "application/pdf"

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supported formats are svg, png and pdf.",
        )

    return Response(
        content=buffer.getvalue(),
        media_type=media_type,
        headers={
            "Content-Disposition": f'inline; filename="barcode-{item.item_code}.{output_format}"'
        },
    )


@router.post(
    "/lookup",
    response_model=StandardSuccessResponse[BarcodeLookupOut],
    summary="Look up an inventory item using barcode or item code",
)
def lookup_barcode(
    payload: BarcodeLookupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("barcode:scan")),
):
    """Resolve a barcode within the user's permitted office."""

    office_id = (
        None
        if ROLE_SYSTEM_ADMIN in current_user.role_names
        else current_user.office_id
    )

    result = BarcodeService.lookup_barcode(
        db=db,
        barcode=payload.barcode,
        office_id=office_id,
    )

    return StandardSuccessResponse(
        data=result,
        message="Barcode resolved successfully",
    )


@router.get(
    "/{item_id}/label",
    summary="Generate a printable barcode and QR label",
)
def generate_barcode_label(
    item_id: UUID,
    output_format: str = Query(
        default="svg",
        alias="format",
        pattern="^(svg|png|pdf)$",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("barcode:print")),
):
    """Generate an actual Code 128 barcode and QR label."""

    item = (
        db.query(Item)
        .options(
            joinedload(Item.office),
            joinedload(Item.category),
            joinedload(Item.location),
        )
        .filter(Item.id == item_id)
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found.",
        )

    if (
        ROLE_SYSTEM_ADMIN not in current_user.role_names
        and item.office_id != current_user.office_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot access items belonging to another office.",
        )

    if item.operational_status == "DISPOSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A disposed item cannot have an operational barcode label.",
        )

    try:
        return _build_label_response(item, output_format)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Barcode label generation failed: {str(exc)}",
        ) from exc
