"""Additive court/slot/booking core; preserve all existing identity rows."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002_booking_core"
down_revision = "0001_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "courts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("sport", sa.String(length=80), nullable=False),
        sa.Column("address", sa.String(length=300), nullable=False),
        sa.Column("area", sa.String(length=120), nullable=False),
        sa.Column(
            "description", sa.String(length=4000), server_default="", nullable=False
        ),
        sa.Column("contact", sa.String(length=200), server_default="", nullable=False),
        sa.Column(
            "photo_urls",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="[]",
            nullable=False,
        ),
        sa.Column("base_price_vnd", sa.BigInteger(), nullable=False),
        sa.Column("max_players", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.CheckConstraint("base_price_vnd > 0", name="ck_court_price"),
        sa.CheckConstraint("max_players BETWEEN 2 AND 30", name="ck_court_capacity"),
        sa.CheckConstraint("version > 0", name="ck_court_version"),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_courts_owner_id"), "courts", ["owner_id"], unique=False)
    op.create_table(
        "bookings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("court_id", sa.Uuid(), nullable=False),
        sa.Column("player_id", sa.Uuid(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status", sa.String(length=16), server_default="CONFIRMED", nullable=False
        ),
        sa.Column("total_price_vnd", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(status='CONFIRMED' AND cancelled_at IS NULL) "
            "OR (status='CANCELLED' AND cancelled_at IS NOT NULL)",
            name="ck_booking_cancellation",
        ),
        sa.CheckConstraint(
            "end_at >= start_at + interval '60 minutes' "
            "AND end_at <= start_at + interval '240 minutes'",
            name="ck_booking_duration",
        ),
        sa.CheckConstraint(
            "status IN ('CONFIRMED', 'CANCELLED')", name="ck_booking_status"
        ),
        sa.CheckConstraint("total_price_vnd > 0", name="ck_booking_total"),
        sa.ForeignKeyConstraint(
            ["court_id"],
            ["courts.id"],
        ),
        sa.ForeignKeyConstraint(
            ["player_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_bookings_court_start", "bookings", ["court_id", "start_at"], unique=False
    )
    op.create_index(
        "ix_bookings_player_created",
        "bookings",
        ["player_id", "created_at"],
        unique=False,
    )
    op.create_table(
        "maintenance_blocks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("court_id", sa.Uuid(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("end_at > start_at", name="ck_maintenance_interval"),
        sa.ForeignKeyConstraint(
            ["court_id"],
            ["courts.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_maintenance_court_start",
        "maintenance_blocks",
        ["court_id", "start_at"],
        unique=False,
    )
    op.create_table(
        "operating_hours",
        sa.Column("court_id", sa.Uuid(), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("opens_minute", sa.Integer(), nullable=False),
        sa.Column("closes_minute", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "0 <= opens_minute AND opens_minute < closes_minute "
            "AND closes_minute <= 1440",
            name="ck_hours_window",
        ),
        sa.CheckConstraint("weekday BETWEEN 0 AND 6", name="ck_hours_weekday"),
        sa.ForeignKeyConstraint(
            ["court_id"],
            ["courts.id"],
        ),
        sa.PrimaryKeyConstraint("court_id", "weekday"),
    )
    op.create_table(
        "slots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("court_id", sa.Uuid(), nullable=False),
        sa.Column("playing_date", sa.Date(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("price_vnd", sa.BigInteger(), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("published", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("blocked", sa.Boolean(), server_default="false", nullable=False),
        sa.CheckConstraint(
            "end_at >= start_at + interval '60 minutes' "
            "AND end_at <= start_at + interval '240 minutes'",
            name="ck_slot_duration",
        ),
        sa.CheckConstraint(
            "playing_date = (start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date "
            "AND end_at <= ((playing_date + 1)::timestamp "
            "AT TIME ZONE 'Asia/Ho_Chi_Minh')",
            name="ck_slot_playing_date",
        ),
        sa.CheckConstraint(
            "mod(extract(epoch from start_at)::numeric,1800)=0 "
            "AND mod(extract(epoch from end_at)::numeric,1800)=0",
            name="ck_slot_grid",
        ),
        sa.CheckConstraint("price_vnd > 0", name="ck_slot_price"),
        sa.CheckConstraint("version > 0", name="ck_slot_version"),
        sa.ForeignKeyConstraint(
            ["court_id"],
            ["courts.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_slots_court_start", "slots", ["court_id", "start_at"], unique=False
    )
    op.create_table(
        "booking_slots",
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column("slot_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("price_vnd", sa.BigInteger(), nullable=False),
        sa.Column("slot_version", sa.Integer(), nullable=False),
        sa.CheckConstraint("end_at > start_at", name="ck_booking_slot_interval"),
        sa.CheckConstraint("position BETWEEN 0 AND 3", name="ck_booking_slot_position"),
        sa.CheckConstraint("price_vnd > 0", name="ck_booking_slot_price"),
        sa.ForeignKeyConstraint(
            ["booking_id"],
            ["bookings.id"],
        ),
        sa.ForeignKeyConstraint(
            ["slot_id"],
            ["slots.id"],
        ),
        sa.PrimaryKeyConstraint("booking_id", "slot_id"),
        sa.UniqueConstraint("booking_id", "position", name="uq_booking_slot_position"),
    )
    op.create_table(
        "slot_claims",
        sa.Column("slot_id", sa.Uuid(), nullable=False),
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["booking_id", "slot_id"],
            ["booking_slots.booking_id", "booking_slots.slot_id"],
        ),
        sa.PrimaryKeyConstraint("slot_id"),
    )
    op.create_index(
        op.f("ix_slot_claims_booking_id"), "slot_claims", ["booking_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_slot_claims_booking_id"), table_name="slot_claims")
    op.drop_table("slot_claims")
    op.drop_table("booking_slots")
    op.drop_index("ix_slots_court_start", table_name="slots")
    op.drop_table("slots")
    op.drop_table("operating_hours")
    op.drop_index("ix_maintenance_court_start", table_name="maintenance_blocks")
    op.drop_table("maintenance_blocks")
    op.drop_index("ix_bookings_player_created", table_name="bookings")
    op.drop_index("ix_bookings_court_start", table_name="bookings")
    op.drop_table("bookings")
    op.drop_index(op.f("ix_courts_owner_id"), table_name="courts")
    op.drop_table("courts")
