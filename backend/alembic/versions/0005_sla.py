"""SLA: columnas de vencimiento en tickets + tabla sla_policies (sembrada)

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-03
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tickets", sa.Column("response_due_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tickets", sa.Column("resolution_due_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tickets", sa.Column("first_response_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tickets", sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True))

    # Tabla VACÍA a propósito: los tiempos de atención de los tickets los define el cliente (Servigpoder)
    # vía PUT /api/sla-policies/{priority}. NO se siembran los tiempos de la propuesta: esos son el SLA del
    # SERVICIO de NextByte hacia el cliente (soporte de la plataforma), no el SLA de los tickets del negocio.
    op.create_table(
        "sla_policies",
        sa.Column("priority", sa.String(length=10), nullable=False),
        sa.Column("response_minutes", sa.Integer(), nullable=False),
        sa.Column("resolution_minutes", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("priority"),
    )


def downgrade() -> None:
    op.drop_table("sla_policies")
    op.drop_column("tickets", "resolved_at")
    op.drop_column("tickets", "first_response_at")
    op.drop_column("tickets", "resolution_due_at")
    op.drop_column("tickets", "response_due_at")
