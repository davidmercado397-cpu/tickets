"""baseline: áreas, categorías, tickets, adjuntos, history, counters

Revision ID: 0001
Revises:
Create Date: 2026-07-02
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.adapters.types import GUID

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "areas",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_areas_code", "areas", ["code"], unique=True)

    op.create_table(
        "categories",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("area_id", GUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["area_id"], ["areas.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_categories_code", "categories", ["code"], unique=True)
    op.create_index("ix_categories_area_id", "categories", ["area_id"])

    op.create_table(
        "tickets",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("radicado", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("category_id", GUID(), nullable=False),
        sa.Column("area_id", GUID(), nullable=False),
        sa.Column("priority", sa.String(length=10), nullable=True),
        sa.Column("subject", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("assignee", sa.String(length=256), nullable=True),
        sa.Column("channel", sa.String(length=32), nullable=True),
        sa.Column("conversation_id", sa.String(length=64), nullable=True),
        sa.Column("contact_wa_id", sa.String(length=32), nullable=False),
        sa.Column("contact_name", sa.String(length=256), nullable=True),
        sa.Column("contact_document", sa.String(length=64), nullable=True),
        sa.Column("fields", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["area_id"], ["areas.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tickets_radicado", "tickets", ["radicado"], unique=True)
    op.create_index("ix_tickets_status", "tickets", ["status"])
    op.create_index("ix_tickets_category_id", "tickets", ["category_id"])
    op.create_index("ix_tickets_area_id", "tickets", ["area_id"])
    op.create_index("ix_tickets_assignee", "tickets", ["assignee"])
    op.create_index("ix_tickets_conversation_id", "tickets", ["conversation_id"])
    op.create_index("ix_tickets_created_at", "tickets", ["created_at"])

    op.create_table(
        "ticket_attachments",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("ticket_id", GUID(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("mime", sa.String(length=128), nullable=True),
        sa.Column("name", sa.String(length=256), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ticket_attachments_ticket_id", "ticket_attachments", ["ticket_id"])

    op.create_table(
        "ticket_history",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("ticket_id", GUID(), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("actor", sa.String(length=16), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ticket_history_ticket_id", "ticket_history", ["ticket_id"])

    op.create_table(
        "counters",
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("name"),
    )


def downgrade() -> None:
    op.drop_table("counters")
    op.drop_index("ix_ticket_history_ticket_id", table_name="ticket_history")
    op.drop_table("ticket_history")
    op.drop_index("ix_ticket_attachments_ticket_id", table_name="ticket_attachments")
    op.drop_table("ticket_attachments")
    op.drop_index("ix_tickets_created_at", table_name="tickets")
    op.drop_index("ix_tickets_conversation_id", table_name="tickets")
    op.drop_index("ix_tickets_assignee", table_name="tickets")
    op.drop_index("ix_tickets_area_id", table_name="tickets")
    op.drop_index("ix_tickets_category_id", table_name="tickets")
    op.drop_index("ix_tickets_status", table_name="tickets")
    op.drop_index("ix_tickets_radicado", table_name="tickets")
    op.drop_table("tickets")
    op.drop_index("ix_categories_area_id", table_name="categories")
    op.drop_index("ix_categories_code", table_name="categories")
    op.drop_table("categories")
    op.drop_index("ix_areas_code", table_name="areas")
    op.drop_table("areas")
