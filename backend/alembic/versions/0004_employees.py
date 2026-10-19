"""employees (tabla propia)

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-02
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.adapters.types import GUID

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "employees",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("document", sa.String(length=32), nullable=False),
        sa.Column("full_name", sa.String(length=256), nullable=False),
        sa.Column("position", sa.String(length=128), nullable=True),
        sa.Column("hire_date", sa.Date(), nullable=True),
        sa.Column("contract_type", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=True),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_employees_document", "employees", ["document"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_employees_document", table_name="employees")
    op.drop_table("employees")
