"""Initial PostgreSQL Schema Migration

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-11-04 00:00:00.000000

Creates all 33 core tables, composite office constraints, check constraints,
partial unique indexes for settings, and immutability triggers on posted ledger vouchers.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. offices
    op.create_table(
        "offices",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("office_type", sa.String(length=50), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("taluka", sa.String(length=100), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("contact_email", sa.String(length=100), nullable=True),
        sa.Column("contact_phone", sa.String(length=20), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_offices_code"), "offices", ["code"], unique=True)

    # 2. roles
    op.create_table(
        "roles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_system_role", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_roles_name"), "roles", ["name"], unique=True)

    # 3. permissions
    op.create_table(
        "permissions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("module", sa.String(length=50), nullable=False),
        sa.Column("action", sa.String(length=30), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_permissions_code"), "permissions", ["code"], unique=True)
    op.create_index(op.f("ix_permissions_module"), "permissions", ["module"], unique=False)

    # 4. role_permissions
    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.Uuid(), nullable=False),
        sa.Column("permission_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("role_id", "permission_id"),
    )

    # 5. users
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=120), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("designation", sa.String(length=100), nullable=False),
        sa.Column("phone_number", sa.String(length=20), nullable=True),
        sa.Column("status", sa.String(length=30), server_default="ACTIVE", nullable=False),
        sa.Column("failed_login_attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("username"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_office_id"), "users", ["office_id"], unique=False)
    op.create_index(op.f("ix_users_status"), "users", ["status"], unique=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    # 6. user_roles
    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "role_id"),
    )

    # 7. locations
    op.create_table(
        "locations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("building_name", sa.String(length=100), nullable=False),
        sa.Column("floor", sa.String(length=50), nullable=False),
        sa.Column("room_number", sa.String(length=50), nullable=False),
        sa.Column("location_type", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id", "office_id", name="uq_locations_id_office"),
        sa.UniqueConstraint("office_id", "building_name", "floor", "room_number", name="uq_locations_office_building_floor_room"),
    )
    op.create_index(op.f("ix_locations_office_id"), "locations", ["office_id"], unique=False)

    # 8. categories
    op.create_table(
        "categories",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("slow_moving_threshold_days", sa.Integer(), server_default="90", nullable=False),
        sa.Column("inactivity_threshold_days", sa.Integer(), server_default="180", nullable=False),
        sa.Column("obsolescence_years", sa.Integer(), server_default="5", nullable=False),
        sa.Column("depreciation_rate_pct", sa.Numeric(precision=5, scale=2), server_default="15.00", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["categories.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_categories_code"), "categories", ["code"], unique=True)

    # 9. units_of_measure
    op.create_table(
        "units_of_measure",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_units_of_measure_code"), "units_of_measure", ["code"], unique=True)

    # 10. suppliers
    op.create_table(
        "suppliers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("supplier_code", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("contact_person", sa.String(length=100), nullable=True),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("email", sa.String(length=100), nullable=True),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("gstin", sa.String(length=20), nullable=True),
        sa.Column("pan", sa.String(length=20), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("supplier_code"),
    )
    op.create_index(op.f("ix_suppliers_gstin"), "suppliers", ["gstin"], unique=False)
    op.create_index(op.f("ix_suppliers_name"), "suppliers", ["name"], unique=False)
    op.create_index(op.f("ix_suppliers_supplier_code"), "suppliers", ["supplier_code"], unique=True)

    # 11. procurements
    op.create_table(
        "procurements",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("procurement_number", sa.String(length=50), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("supplier_id", sa.Uuid(), nullable=False),
        sa.Column("order_date", sa.Date(), nullable=False),
        sa.Column("invoice_number", sa.String(length=100), nullable=True),
        sa.Column("total_amount", sa.Numeric(precision=14, scale=2), server_default="0.00", nullable=False),
        sa.Column("status", sa.String(length=30), server_default="PENDING", nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("total_amount >= 0", name="chk_procurement_total_non_negative"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("procurement_number"),
    )
    op.create_index(op.f("ix_procurements_office_id"), "procurements", ["office_id"], unique=False)
    op.create_index(op.f("ix_procurements_procurement_number"), "procurements", ["procurement_number"], unique=True)
    op.create_index(op.f("ix_procurements_supplier_id"), "procurements", ["supplier_id"], unique=False)

    # 12. procurement_items
    op.create_table(
        "procurement_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("procurement_id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("item_description", sa.Text(), nullable=False),
        sa.Column("item_type", sa.String(length=30), nullable=False),
        sa.Column("quantity_ordered", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("quantity_received", sa.Numeric(precision=12, scale=2), server_default="0.00", nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("tax_rate_pct", sa.Numeric(precision=5, scale=2), server_default="0.00", nullable=False),
        sa.Column("total_price", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("quantity_ordered > 0", name="chk_proc_item_qty_ordered_positive"),
        sa.CheckConstraint("quantity_received >= 0", name="chk_proc_item_qty_received_non_negative"),
        sa.CheckConstraint("quantity_received <= quantity_ordered", name="chk_proc_item_qty_received_le_ordered"),
        sa.CheckConstraint("total_price >= 0", name="chk_proc_item_total_price_non_negative"),
        sa.CheckConstraint("unit_price >= 0", name="chk_proc_item_unit_price_non_negative"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["procurement_id"], ["procurements.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_procurement_items_category_id"), "procurement_items", ["category_id"], unique=False)
    op.create_index(op.f("ix_procurement_items_procurement_id"), "procurement_items", ["procurement_id"], unique=False)

    # 13. items
    op.create_table(
        "items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("supplier_id", sa.Uuid(), nullable=True),
        sa.Column("procurement_item_id", sa.Uuid(), nullable=True),
        sa.Column("uom_id", sa.Uuid(), nullable=False),
        sa.Column("item_code", sa.String(length=50), nullable=False),
        sa.Column("item_name", sa.String(length=200), nullable=False),
        sa.Column("item_type", sa.String(length=30), nullable=False),
        sa.Column("barcode_number", sa.String(length=100), nullable=True),
        sa.Column("brand", sa.String(length=100), nullable=True),
        sa.Column("model_number", sa.String(length=100), nullable=True),
        sa.Column("serial_number", sa.String(length=100), nullable=True),
        sa.Column("purchase_date", sa.Date(), nullable=True),
        sa.Column("invoice_number", sa.String(length=100), nullable=True),
        sa.Column("unit_purchase_cost", sa.Numeric(precision=14, scale=2), server_default="0.00", nullable=False),
        sa.Column("total_cost", sa.Numeric(precision=14, scale=2), server_default="0.00", nullable=False),
        sa.Column("condition", sa.String(length=30), server_default="GOOD", nullable=False),
        sa.Column("operational_status", sa.String(length=30), server_default="AVAILABLE_IN_STORE", nullable=False),
        sa.Column("current_classification", sa.String(length=30), server_default="ACTIVE", nullable=False),
        sa.Column("current_custodian", sa.String(length=150), nullable=True),
        sa.Column("current_department", sa.String(length=100), nullable=True),
        sa.Column("last_movement_date", sa.Date(), nullable=True),
        sa.Column("min_stock_level", sa.Numeric(precision=12, scale=2), server_default="0.00", nullable=False),
        sa.Column("is_legacy", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("legacy_reference_number", sa.String(length=100), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("total_cost >= 0", name="chk_item_total_cost_non_negative"),
        sa.CheckConstraint("unit_purchase_cost >= 0", name="chk_item_unit_cost_non_negative"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["procurement_item_id"], ["procurement_items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["uom_id"], ["units_of_measure.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id", "office_id", name="uq_items_id_office"),
        sa.UniqueConstraint("item_code"),
    )
    op.create_index(op.f("ix_items_barcode_number"), "items", ["barcode_number"], unique=False)
    op.create_index(op.f("ix_items_category_id"), "items", ["category_id"], unique=False)
    op.create_index(op.f("ix_items_current_classification"), "items", ["current_classification"], unique=False)
    op.create_index(op.f("ix_items_item_code"), "items", ["item_code"], unique=True)
    op.create_index(op.f("ix_items_item_name"), "items", ["item_name"], unique=False)
    op.create_index(op.f("ix_items_item_type"), "items", ["item_type"], unique=False)
    op.create_index(op.f("ix_items_last_movement_date"), "items", ["last_movement_date"], unique=False)
    op.create_index(op.f("ix_items_location_id"), "items", ["location_id"], unique=False)
    op.create_index(op.f("ix_items_office_id"), "items", ["office_id"], unique=False)
    op.create_index(op.f("ix_items_operational_status"), "items", ["operational_status"], unique=False)
    op.create_index(op.f("ix_items_purchase_date"), "items", ["purchase_date"], unique=False)
    op.create_index(op.f("ix_items_serial_number"), "items", ["serial_number"], unique=False)
    op.create_index(op.f("ix_items_supplier_id"), "items", ["supplier_id"], unique=False)

    # 14. stock_balances
    op.create_table(
        "stock_balances",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("available_qty", sa.Numeric(precision=12, scale=2), server_default="0.00", nullable=False),
        sa.Column("allocated_qty", sa.Numeric(precision=12, scale=2), server_default="0.00", nullable=False),
        sa.Column("in_vendor_rma_qty", sa.Numeric(precision=12, scale=2), server_default="0.00", nullable=False),
        sa.Column("disposed_qty", sa.Numeric(precision=12, scale=2), server_default="0.00", nullable=False),
        sa.Column("last_reconciled_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("allocated_qty >= 0", name="chk_balance_allocated_non_negative"),
        sa.CheckConstraint("available_qty >= 0", name="chk_balance_available_non_negative"),
        sa.CheckConstraint("disposed_qty >= 0", name="chk_balance_disposed_non_negative"),
        sa.CheckConstraint("in_vendor_rma_qty >= 0", name="chk_balance_rma_non_negative"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("office_id", "item_id", "location_id", name="uq_stock_balances_office_item_loc"),
    )
    op.create_index(op.f("ix_stock_balances_item_id"), "stock_balances", ["item_id"], unique=False)
    op.create_index(op.f("ix_stock_balances_location_id"), "stock_balances", ["location_id"], unique=False)
    op.create_index(op.f("ix_stock_balances_office_id"), "stock_balances", ["office_id"], unique=False)

    # 15. stock_transactions
    op.create_table(
        "stock_transactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("transaction_number", sa.String(length=50), nullable=False),
        sa.Column("idempotency_key", sa.String(length=100), nullable=True),
        sa.Column("transaction_type", sa.String(length=30), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("source_office_id", sa.Uuid(), nullable=True),
        sa.Column("destination_office_id", sa.Uuid(), nullable=True),
        sa.Column("source_location_id", sa.Uuid(), nullable=True),
        sa.Column("destination_location_id", sa.Uuid(), nullable=True),
        sa.Column("original_transaction_id", sa.Uuid(), nullable=True),
        sa.Column("recipient_name", sa.String(length=150), nullable=True),
        sa.Column("recipient_department", sa.String(length=100), nullable=True),
        sa.Column("reference_document", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=30), server_default="DRAFT", nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("reversal_reason", sa.Text(), nullable=True),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["destination_location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["destination_office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["original_transaction_id"], ["stock_transactions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
        sa.UniqueConstraint("transaction_number"),
    )
    op.create_index(op.f("ix_stock_transactions_actor_id"), "stock_transactions", ["actor_id"], unique=False)
    op.create_index(op.f("ix_stock_transactions_destination_location_id"), "stock_transactions", ["destination_location_id"], unique=False)
    op.create_index(op.f("ix_stock_transactions_destination_office_id"), "stock_transactions", ["destination_office_id"], unique=False)
    op.create_index(op.f("ix_stock_transactions_idempotency_key"), "stock_transactions", ["idempotency_key"], unique=True)
    op.create_index(op.f("ix_stock_transactions_office_id"), "stock_transactions", ["office_id"], unique=False)
    op.create_index(op.f("ix_stock_transactions_original_transaction_id"), "stock_transactions", ["original_transaction_id"], unique=False)
    op.create_index(op.f("ix_stock_transactions_posted_at"), "stock_transactions", ["posted_at"], unique=False)
    op.create_index(op.f("ix_stock_transactions_source_location_id"), "stock_transactions", ["source_location_id"], unique=False)
    op.create_index(op.f("ix_stock_transactions_source_office_id"), "stock_transactions", ["source_office_id"], unique=False)
    op.create_index(op.f("ix_stock_transactions_status"), "stock_transactions", ["status"], unique=False)
    op.create_index(op.f("ix_stock_transactions_transaction_number"), "stock_transactions", ["transaction_number"], unique=True)
    op.create_index(op.f("ix_stock_transactions_transaction_type"), "stock_transactions", ["transaction_type"], unique=False)

    # 16. stock_transaction_lines
    op.create_table(
        "stock_transaction_lines",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("transaction_id", sa.Uuid(), nullable=False),
        sa.Column("original_line_id", sa.Uuid(), nullable=True),
        sa.Column("procurement_item_id", sa.Uuid(), nullable=True),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("cumulative_returned_qty", sa.Numeric(precision=12, scale=2), server_default="0.00", nullable=False),
        sa.Column("unit_cost", sa.Numeric(precision=14, scale=2), server_default="0.00", nullable=False),
        sa.Column("total_cost", sa.Numeric(precision=14, scale=2), server_default="0.00", nullable=False),
        sa.Column("condition_observed", sa.String(length=30), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.CheckConstraint("cumulative_returned_qty >= 0", name="chk_txn_line_cumul_return_non_negative"),
        sa.CheckConstraint("quantity > 0", name="chk_txn_line_qty_positive"),
        sa.CheckConstraint("total_cost >= 0", name="chk_txn_line_total_cost_non_negative"),
        sa.CheckConstraint("unit_cost >= 0", name="chk_txn_line_unit_cost_non_negative"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["original_line_id"], ["stock_transaction_lines.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["procurement_item_id"], ["procurement_items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["transaction_id"], ["stock_transactions.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_stock_transaction_lines_item_id"), "stock_transaction_lines", ["item_id"], unique=False)
    op.create_index(op.f("ix_stock_transaction_lines_original_line_id"), "stock_transaction_lines", ["original_line_id"], unique=False)
    op.create_index(op.f("ix_stock_transaction_lines_procurement_item_id"), "stock_transaction_lines", ["procurement_item_id"], unique=False)
    op.create_index(op.f("ix_stock_transaction_lines_transaction_id"), "stock_transaction_lines", ["transaction_id"], unique=False)

    # 17. classifications
    op.create_table(
        "classifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("calculated_classification", sa.String(length=30), nullable=False),
        sa.Column("effective_classification", sa.String(length=30), nullable=False),
        sa.Column("rule_version", sa.String(length=20), server_default="v1.0", nullable=False),
        sa.Column("days_inactive", sa.Integer(), server_default="0", nullable=False),
        sa.Column("item_age_days", sa.Integer(), server_default="0", nullable=False),
        sa.Column("contributing_factors", sa.JSON(), nullable=False),
        sa.Column("is_overridden", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("override_reason", sa.Text(), nullable=True),
        sa.Column("overridden_by", sa.Uuid(), nullable=True),
        sa.Column("overridden_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("calculated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["overridden_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_classifications_calculated_at"), "classifications", ["calculated_at"], unique=False)
    op.create_index(op.f("ix_classifications_effective_classification"), "classifications", ["effective_classification"], unique=False)
    op.create_index(op.f("ix_classifications_item_id"), "classifications", ["item_id"], unique=False)
    op.create_index(op.f("ix_classifications_office_id"), "classifications", ["office_id"], unique=False)

    # 18. verification_sessions
    op.create_table(
        "verification_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_number", sa.String(length=50), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("scope_type", sa.String(length=30), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=True),
        sa.Column("category_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=30), server_default="PLANNED", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("lead_verifier_id", sa.Uuid(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["lead_verifier_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id", "office_id", name="uq_verif_sessions_id_office"),
        sa.UniqueConstraint("session_number"),
    )
    op.create_index(op.f("ix_verification_sessions_category_id"), "verification_sessions", ["category_id"], unique=False)
    op.create_index(op.f("ix_verification_sessions_location_id"), "verification_sessions", ["location_id"], unique=False)
    op.create_index(op.f("ix_verification_sessions_office_id"), "verification_sessions", ["office_id"], unique=False)
    op.create_index(op.f("ix_verification_sessions_session_number"), "verification_sessions", ["session_number"], unique=True)
    op.create_index(op.f("ix_verification_sessions_status"), "verification_sessions", ["status"], unique=False)

    # 19. verification_items
    op.create_table(
        "verification_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("expected_location_id", sa.Uuid(), nullable=False),
        sa.Column("observed_location_id", sa.Uuid(), nullable=True),
        sa.Column("expected_condition", sa.String(length=30), nullable=False),
        sa.Column("observed_condition", sa.String(length=30), nullable=True),
        sa.Column("expected_qty", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("counted_qty", sa.Numeric(precision=12, scale=2), server_default="0.00", nullable=False),
        sa.Column("discrepancy_type", sa.String(length=40), server_default="NONE", nullable=False),
        sa.Column("resolution_status", sa.String(length=30), server_default="PENDING", nullable=False),
        sa.Column("resolution_remarks", sa.Text(), nullable=True),
        sa.Column("verified_by", sa.Uuid(), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["expected_location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["observed_location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["session_id"], ["verification_sessions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["verified_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_verification_items_discrepancy_type"), "verification_items", ["discrepancy_type"], unique=False)
    op.create_index(op.f("ix_verification_items_item_id"), "verification_items", ["item_id"], unique=False)
    op.create_index(op.f("ix_verification_items_office_id"), "verification_items", ["office_id"], unique=False)
    op.create_index(op.f("ix_verification_items_resolution_status"), "verification_items", ["resolution_status"], unique=False)
    op.create_index(op.f("ix_verification_items_session_id"), "verification_items", ["session_id"], unique=False)

    # 20. verification_scan_events
    op.create_table(
        "verification_scan_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("scanned_barcode", sa.String(length=100), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=True),
        sa.Column("scanned_location_id", sa.Uuid(), nullable=False),
        sa.Column("observed_condition", sa.String(length=30), nullable=False),
        sa.Column("counted_quantity", sa.Numeric(precision=12, scale=2), server_default="1.00", nullable=False),
        sa.Column("scan_result", sa.String(length=40), nullable=False),
        sa.Column("is_duplicate_scan", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("scanned_by", sa.Uuid(), nullable=False),
        sa.Column("scanned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("device_info", sa.String(length=255), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["scanned_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["scanned_location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["session_id"], ["verification_sessions.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_verification_scan_events_item_id"), "verification_scan_events", ["item_id"], unique=False)
    op.create_index(op.f("ix_verification_scan_events_office_id"), "verification_scan_events", ["office_id"], unique=False)
    op.create_index(op.f("ix_verification_scan_events_scanned_at"), "verification_scan_events", ["scanned_at"], unique=False)
    op.create_index(op.f("ix_verification_scan_events_scanned_barcode"), "verification_scan_events", ["scanned_barcode"], unique=False)
    op.create_index(op.f("ix_verification_scan_events_scanned_by"), "verification_scan_events", ["scanned_by"], unique=False)
    op.create_index(op.f("ix_verification_scan_events_scanned_location_id"), "verification_scan_events", ["scanned_location_id"], unique=False)
    op.create_index(op.f("ix_verification_scan_events_session_id"), "verification_scan_events", ["session_id"], unique=False)

    # 21. asset_documents
    op.create_table(
        "asset_documents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=True),
        sa.Column("related_entity_type", sa.String(length=50), nullable=False),
        sa.Column("related_entity_id", sa.Uuid(), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("document_category", sa.String(length=50), nullable=False),
        sa.Column("uploaded_by", sa.Uuid(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_asset_documents_item_id"), "asset_documents", ["item_id"], unique=False)
    op.create_index(op.f("ix_asset_documents_related_entity_id"), "asset_documents", ["related_entity_id"], unique=False)
    op.create_index(op.f("ix_asset_documents_related_entity_type"), "asset_documents", ["related_entity_type"], unique=False)

    # 22. warranties
    op.create_table(
        "warranties",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("supplier_id", sa.Uuid(), nullable=True),
        sa.Column("provider_name", sa.String(length=150), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("coverage_details", sa.Text(), nullable=True),
        sa.Column("support_contact", sa.String(length=100), nullable=True),
        sa.Column("document_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["asset_documents.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("item_id"),
    )
    op.create_index(op.f("ix_warranties_end_date"), "warranties", ["end_date"], unique=False)
    op.create_index(op.f("ix_warranties_item_id"), "warranties", ["item_id"], unique=True)
    op.create_index(op.f("ix_warranties_supplier_id"), "warranties", ["supplier_id"], unique=False)

    # 23. maintenance_records
    op.create_table(
        "maintenance_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("issue_description", sa.Text(), nullable=False),
        sa.Column("service_provider", sa.String(length=150), nullable=False),
        sa.Column("reported_date", sa.Date(), nullable=False),
        sa.Column("completion_date", sa.Date(), nullable=True),
        sa.Column("estimated_cost", sa.Numeric(precision=14, scale=2), server_default="0.00", nullable=False),
        sa.Column("actual_cost", sa.Numeric(precision=14, scale=2), server_default="0.00", nullable=False),
        sa.Column("status", sa.String(length=30), server_default="REPORTED", nullable=False),
        sa.Column("work_performed", sa.Text(), nullable=True),
        sa.Column("invoice_reference", sa.String(length=100), nullable=True),
        sa.Column("reported_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("actual_cost >= 0", name="chk_maint_actual_cost_non_negative"),
        sa.CheckConstraint("estimated_cost >= 0", name="chk_maint_estimated_cost_non_negative"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reported_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_maintenance_records_item_id"), "maintenance_records", ["item_id"], unique=False)
    op.create_index(op.f("ix_maintenance_records_office_id"), "maintenance_records", ["office_id"], unique=False)
    op.create_index(op.f("ix_maintenance_records_status"), "maintenance_records", ["status"], unique=False)

    # 24. supplier_returns (Vendor RMA)
    op.create_table(
        "supplier_returns",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("return_number", sa.String(length=50), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("supplier_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("procurement_id", sa.Uuid(), nullable=True),
        sa.Column("warranty_id", sa.Uuid(), nullable=True),
        sa.Column("return_date", sa.Date(), nullable=False),
        sa.Column("dispatch_date", sa.Date(), nullable=True),
        sa.Column("return_tracking_number", sa.String(length=100), nullable=True),
        sa.Column("carrier_name", sa.String(length=100), nullable=True),
        sa.Column("quantity", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("reason", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="INITIATED", nullable=False),
        sa.Column("rma_reference_number", sa.String(length=100), nullable=True),
        sa.Column("vendor_acknowledgement_date", sa.Date(), nullable=True),
        sa.Column("vendor_rejection_reason", sa.Text(), nullable=True),
        sa.Column("resolution_type", sa.String(length=30), nullable=True),
        sa.Column("resolution_date", sa.Date(), nullable=True),
        sa.Column("replacement_item_id", sa.Uuid(), nullable=True),
        sa.Column("credit_note_number", sa.String(length=100), nullable=True),
        sa.Column("credit_amount", sa.Numeric(precision=14, scale=2), server_default="0.00", nullable=False),
        sa.Column("refund_reference_number", sa.String(length=100), nullable=True),
        sa.Column("refund_amount", sa.Numeric(precision=14, scale=2), server_default="0.00", nullable=False),
        sa.Column("resolution_remarks", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("credit_amount >= 0", name="chk_supplier_return_credit_non_negative"),
        sa.CheckConstraint("quantity > 0", name="chk_supplier_return_qty_positive"),
        sa.CheckConstraint("refund_amount >= 0", name="chk_supplier_return_refund_non_negative"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["procurement_id"], ["procurements.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["replacement_item_id"], ["items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["warranty_id"], ["warranties.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("return_number"),
    )
    op.create_index(op.f("ix_supplier_returns_item_id"), "supplier_returns", ["item_id"], unique=False)
    op.create_index(op.f("ix_supplier_returns_office_id"), "supplier_returns", ["office_id"], unique=False)
    op.create_index(op.f("ix_supplier_returns_procurement_id"), "supplier_returns", ["procurement_id"], unique=False)
    op.create_index(op.f("ix_supplier_returns_return_number"), "supplier_returns", ["return_number"], unique=True)
    op.create_index(op.f("ix_supplier_returns_status"), "supplier_returns", ["status"], unique=False)
    op.create_index(op.f("ix_supplier_returns_supplier_id"), "supplier_returns", ["supplier_id"], unique=False)
    op.create_index(op.f("ix_supplier_returns_warranty_id"), "supplier_returns", ["warranty_id"], unique=False)

    # 25. condemnation_requests
    op.create_table(
        "condemnation_requests",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("request_number", sa.String(length=50), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("reason_code", sa.String(length=50), nullable=False),
        sa.Column("condition_summary", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="DRAFT", nullable=False),
        sa.Column("submitted_by", sa.Uuid(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["submitted_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id", "office_id", name="uq_condemn_requests_id_office"),
        sa.UniqueConstraint("request_number"),
    )
    op.create_index(op.f("ix_condemnation_requests_office_id"), "condemnation_requests", ["office_id"], unique=False)
    op.create_index(op.f("ix_condemnation_requests_request_number"), "condemnation_requests", ["request_number"], unique=True)
    op.create_index(op.f("ix_condemnation_requests_status"), "condemnation_requests", ["status"], unique=False)

    # 26. condemnation_request_items
    op.create_table(
        "condemnation_request_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("item_condition", sa.String(length=30), nullable=False),
        sa.Column("assessed_scrap_value", sa.Numeric(precision=14, scale=2), server_default="0.00", nullable=False),
        sa.Column("inspector_remarks", sa.Text(), nullable=True),
        sa.CheckConstraint("assessed_scrap_value >= 0", name="chk_condemn_scrap_val_non_negative"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["request_id"], ["condemnation_requests.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_condemnation_request_items_item_id"), "condemnation_request_items", ["item_id"], unique=False)
    op.create_index(op.f("ix_condemnation_request_items_office_id"), "condemnation_request_items", ["office_id"], unique=False)
    op.create_index(op.f("ix_condemnation_request_items_request_id"), "condemnation_request_items", ["request_id"], unique=False)

    # 27. approval_actions
    op.create_table(
        "approval_actions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("action_by", sa.Uuid(), nullable=False),
        sa.Column("role_snapshot", sa.String(length=50), nullable=False),
        sa.Column("action", sa.String(length=30), nullable=False),
        sa.Column("order_number", sa.String(length=100), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=False),
        sa.Column("action_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["action_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["request_id"], ["condemnation_requests.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_approval_actions_request_id"), "approval_actions", ["request_id"], unique=False)

    # 28. disposals
    op.create_table(
        "disposals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("disposal_number", sa.String(length=50), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("disposal_method", sa.String(length=50), nullable=False),
        sa.Column("disposal_date", sa.Date(), nullable=False),
        sa.Column("total_sale_proceeds", sa.Numeric(precision=14, scale=2), server_default="0.00", nullable=False),
        sa.Column("recipient_agency", sa.String(length=150), nullable=False),
        sa.Column("reference_order_number", sa.String(length=100), nullable=False),
        sa.Column("certificate_document_id", sa.Uuid(), nullable=True),
        sa.Column("executed_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("total_sale_proceeds >= 0", name="chk_disposal_proceeds_non_negative"),
        sa.ForeignKeyConstraint(["certificate_document_id"], ["asset_documents.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["executed_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["request_id"], ["condemnation_requests.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("disposal_number"),
        sa.UniqueConstraint("request_id"),
    )
    op.create_index(op.f("ix_disposals_disposal_date"), "disposals", ["disposal_date"], unique=False)
    op.create_index(op.f("ix_disposals_disposal_number"), "disposals", ["disposal_number"], unique=True)
    op.create_index(op.f("ix_disposals_office_id"), "disposals", ["office_id"], unique=False)
    op.create_index(op.f("ix_disposals_request_id"), "disposals", ["request_id"], unique=True)

    # 29. disposal_items
    op.create_table(
        "disposal_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("disposal_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("disposed_qty", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("realized_amount", sa.Numeric(precision=14, scale=2), server_default="0.00", nullable=False),
        sa.CheckConstraint("disposed_qty > 0", name="chk_disposal_item_qty_positive"),
        sa.CheckConstraint("realized_amount >= 0", name="chk_disposal_item_amount_non_negative"),
        sa.ForeignKeyConstraint(["disposal_id"], ["disposals.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_disposal_items_disposal_id"), "disposal_items", ["disposal_id"], unique=False)
    op.create_index(op.f("ix_disposal_items_item_id"), "disposal_items", ["item_id"], unique=False)

    # 30. alerts
    op.create_table(
        "alerts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=True),
        sa.Column("alert_type", sa.String(length=50), nullable=False),
        sa.Column("priority", sa.String(length=20), server_default="MEDIUM", nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="ACTIVE", nullable=False),
        sa.Column("snoozed_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.Uuid(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["resolved_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_alerts_alert_type"), "alerts", ["alert_type"], unique=False)
    op.create_index(op.f("ix_alerts_created_at"), "alerts", ["created_at"], unique=False)
    op.create_index(op.f("ix_alerts_item_id"), "alerts", ["item_id"], unique=False)
    op.create_index(op.f("ix_alerts_office_id"), "alerts", ["office_id"], unique=False)
    op.create_index(op.f("ix_alerts_status"), "alerts", ["status"], unique=False)

    # 31. notifications
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("recipient_user_id", sa.Uuid(), nullable=False),
        sa.Column("recipient_role_id", sa.Uuid(), nullable=True),
        sa.Column("office_id", sa.Uuid(), nullable=False),
        sa.Column("alert_id", sa.Uuid(), nullable=True),
        sa.Column("notification_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("priority", sa.String(length=20), server_default="MEDIUM", nullable=False),
        sa.Column("related_entity_type", sa.String(length=50), nullable=True),
        sa.Column("related_entity_id", sa.Uuid(), nullable=True),
        sa.Column("action_url", sa.String(length=255), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["recipient_role_id"], ["roles.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["recipient_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_created_at"), "notifications", ["created_at"], unique=False)
    op.create_index(op.f("ix_notifications_is_read"), "notifications", ["is_read"], unique=False)
    op.create_index(op.f("ix_notifications_notification_type"), "notifications", ["notification_type"], unique=False)
    op.create_index(op.f("ix_notifications_office_id"), "notifications", ["office_id"], unique=False)
    op.create_index(op.f("ix_notifications_recipient_role_id"), "notifications", ["recipient_role_id"], unique=False)
    op.create_index(op.f("ix_notifications_recipient_user_id"), "notifications", ["recipient_user_id"], unique=False)
    op.create_index(op.f("ix_notifications_related_entity_id"), "notifications", ["related_entity_id"], unique=False)
    op.create_index(op.f("ix_notifications_related_entity_type"), "notifications", ["related_entity_type"], unique=False)

    # 32. system_settings
    op.create_table(
        "system_settings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=True),
        sa.Column("setting_category", sa.String(length=50), nullable=False),
        sa.Column("setting_key", sa.String(length=100), nullable=False),
        sa.Column("setting_value", sa.JSON(), nullable=False),
        sa.Column("data_type", sa.String(length=20), server_default="STRING", nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("is_public", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_editable", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_system_settings_office_id"), "system_settings", ["office_id"], unique=False)
    op.create_index(op.f("ix_system_settings_setting_category"), "system_settings", ["setting_category"], unique=False)
    op.create_index(op.f("ix_system_settings_setting_key"), "system_settings", ["setting_key"], unique=False)

    # Partial unique indexes for system_settings (PostgreSQL)
    bind = op.get_bind()
    if bind.engine.name == "postgresql":
        op.execute("CREATE UNIQUE INDEX uq_system_settings_global ON system_settings(setting_key) WHERE office_id IS NULL;")
        op.execute("CREATE UNIQUE INDEX uq_system_settings_office ON system_settings(office_id, setting_key) WHERE office_id IS NOT NULL;")

        # Immutability triggers for posted stock transactions
        op.execute("""
        CREATE OR REPLACE FUNCTION trg_prevent_posted_transaction_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'DELETE' AND OLD.status = 'POSTED' THEN
                RAISE EXCEPTION 'Illegal Operation: Transaction % is POSTED and immutable. Posted transaction records cannot be deleted.', OLD.transaction_number;
            END IF;

            IF TG_OP = 'UPDATE' AND OLD.status = 'POSTED' THEN
                RAISE EXCEPTION 'Illegal Operation: Transaction % is POSTED and immutable. Modifications to posted vouchers are prohibited.', OLD.transaction_number;
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trg_stock_transactions_immutable
        BEFORE UPDATE OR DELETE ON stock_transactions
        FOR EACH ROW EXECUTE FUNCTION trg_prevent_posted_transaction_mutation();

        CREATE OR REPLACE FUNCTION trg_prevent_posted_lines_mutation()
        RETURNS TRIGGER AS $$
        DECLARE
            v_status VARCHAR(30);
            v_txn_no VARCHAR(50);
        BEGIN
            SELECT status, transaction_number INTO v_status, v_txn_no 
            FROM stock_transactions 
            WHERE id = COALESCE(OLD.transaction_id, NEW.transaction_id);

            IF v_status = 'POSTED' THEN
                RAISE EXCEPTION 'Illegal Operation: Transaction % is POSTED. Inserting, updating, or deleting lines on posted transactions is strictly prohibited.', v_txn_no;
            END IF;

            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trg_stock_transaction_lines_immutable
        BEFORE INSERT OR UPDATE OR DELETE ON stock_transaction_lines
        FOR EACH ROW EXECUTE FUNCTION trg_prevent_posted_lines_mutation();
        """)

    # 33. audit_logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("role_name", sa.String(length=50), nullable=False),
        sa.Column("office_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("module", sa.String(length=50), nullable=False),
        sa.Column("record_id", sa.String(length=100), nullable=False),
        sa.Column("ip_address", sa.String(length=45), server_default="127.0.0.1", nullable=False),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("old_values", sa.JSON(), nullable=True),
        sa.Column("new_values", sa.JSON(), nullable=True),
        sa.Column("outcome", sa.String(length=20), server_default="SUCCESS", nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["office_id"], ["offices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_audit_logs_module"), "audit_logs", ["module"], unique=False)
    op.create_index(op.f("ix_audit_logs_office_id"), "audit_logs", ["office_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_record_id"), "audit_logs", ["record_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_timestamp"), "audit_logs", ["timestamp"], unique=False)
    op.create_index(op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.engine.name == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS trg_stock_transaction_lines_immutable ON stock_transaction_lines;")
        op.execute("DROP FUNCTION IF EXISTS trg_prevent_posted_lines_mutation();")
        op.execute("DROP TRIGGER IF EXISTS trg_stock_transactions_immutable ON stock_transactions;")
        op.execute("DROP FUNCTION IF EXISTS trg_prevent_posted_transaction_mutation();")
        op.execute("DROP INDEX IF EXISTS uq_system_settings_office;")
        op.execute("DROP INDEX IF EXISTS uq_system_settings_global;")

    op.drop_table("audit_logs")
    op.drop_table("system_settings")
    op.drop_table("notifications")
    op.drop_table("alerts")
    op.drop_table("disposal_items")
    op.drop_table("disposals")
    op.drop_table("approval_actions")
    op.drop_table("condemnation_request_items")
    op.drop_table("condemnation_requests")
    op.drop_table("supplier_returns")
    op.drop_table("maintenance_records")
    op.drop_table("warranties")
    op.drop_table("asset_documents")
    op.drop_table("verification_scan_events")
    op.drop_table("verification_items")
    op.drop_table("verification_sessions")
    op.drop_table("classifications")
    op.drop_table("stock_transaction_lines")
    op.drop_table("stock_transactions")
    op.drop_table("stock_balances")
    op.drop_table("items")
    op.drop_table("procurement_items")
    op.drop_table("procurements")
    op.drop_table("suppliers")
    op.drop_table("units_of_measure")
    op.drop_table("categories")
    op.drop_table("locations")
    op.drop_table("user_roles")
    op.drop_table("users")
    op.drop_table("role_permissions")
    op.drop_table("permissions")
    op.drop_table("roles")
    op.drop_table("offices")

