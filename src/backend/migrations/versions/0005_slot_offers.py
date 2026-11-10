"""Slot-specific manual and automatic offers, preserving regular/accepted prices."""

import sqlalchemy as sa
from alembic import op

revision = "0005_slot_offers"
down_revision = "0004_account_profile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "slot_offers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("slot_id", sa.Uuid(), nullable=False),
        sa.Column("mode", sa.String(16), nullable=False),
        sa.Column("price_vnd", sa.BigInteger(), nullable=False),
        sa.Column("lead_hours", sa.Numeric(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.CheckConstraint("mode IN ('manual', 'automatic')", name="ck_offer_mode"),
        sa.CheckConstraint(
            "status IN ('SCHEDULED', 'ACTIVE', 'CANCELLED', 'DEACTIVATED', 'EXPIRED')",
            name="ck_offer_status",
        ),
        sa.CheckConstraint("price_vnd > 0", name="ck_offer_price"),
        sa.CheckConstraint("lead_hours > 0 AND lead_hours <= 24", name="ck_offer_lead"),
        sa.ForeignKeyConstraint(["slot_id"], ["slots.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_offer_nonterminal_slot",
        "slot_offers",
        ["slot_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('SCHEDULED', 'ACTIVE')"),
    )


def downgrade() -> None:
    op.drop_table("slot_offers")
