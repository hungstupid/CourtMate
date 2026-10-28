"""add booking linked open play rooms"""

import sqlalchemy as sa
from alembic import op

revision = "0003_open_play"
down_revision = "0002_booking_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rooms",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column("organizer_id", sa.Uuid(), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("closed", sa.Boolean(), server_default="false", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.CheckConstraint("capacity BETWEEN 2 AND 60", name="ck_room_capacity"),
        sa.ForeignKeyConstraint(
            ["booking_id"],
            ["bookings.id"],
        ),
        sa.ForeignKeyConstraint(
            ["organizer_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("booking_id"),
    )
    op.create_table(
        "room_members",
        sa.Column("room_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["player_id"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["room_id"],
            ["rooms.id"],
        ),
        sa.PrimaryKeyConstraint("room_id", "player_id"),
    )


def downgrade() -> None:
    op.drop_table("room_members")
    op.drop_table("rooms")
