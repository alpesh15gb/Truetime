"""add system config table

Revision ID: 202405210002
Revises: 202405200001
Create Date: 2024-05-21 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "202405210002"
down_revision: Union[str, None] = "202405200001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "system_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ingestion_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("ingestion_poll_interval_seconds", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("ingestion_connection_timeout", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("ingestion_force_udp", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("auto_run_migrations", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ensure a single config row exists with defaults
    op.execute(
        sa.text(
            "INSERT INTO system_config (id, ingestion_enabled, ingestion_poll_interval_seconds, "
            "ingestion_connection_timeout, ingestion_force_udp, auto_run_migrations) "
            "VALUES (1, false, 60, 10, false, false)"
        )
    )


def downgrade() -> None:
    op.drop_table("system_config")
