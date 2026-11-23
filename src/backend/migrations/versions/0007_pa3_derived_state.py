"""Derive playing day and keep the authoritative room closure reason."""

import sqlalchemy as sa
from alembic import op

revision = "0007_pa3_derived_state"
down_revision = "0006_room_closure_reason"
branch_labels = None
depends_on = None

LOCAL_DAY = "(start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date"
VALID_REASONS = "('ORGANIZER_CLOSED', 'BOOKING_CANCELLED', 'PLAY_STARTED')"


def upgrade() -> None:
    connection = op.get_bind()
    connection.execute(sa.text("SET LOCAL lock_timeout = '5s'"))
    connection.execute(sa.text("LOCK TABLE slots, rooms IN ACCESS EXCLUSIVE MODE"))
    # All pre-0006 closure paths wrote the same flag. A cancelled or past
    # booking cannot prove which event first closed a particular legacy room.
    unsafe_rooms = connection.scalar(
        sa.text(
            f"SELECT count(*) FROM rooms WHERE "
            f"closed <> (closed_reason IS NOT NULL) "
            f"OR closed_reason NOT IN {VALID_REASONS}"
        )
    )
    if unsafe_rooms:
        raise RuntimeError(
            f"PA3 migration blocked: {unsafe_rooms} room(s) have ambiguous or invalid "
            "closure history. Reconcile from authoritative evidence before retrying."
        )
    op.create_check_constraint(
        "ck_room_closed_reason", "rooms", f"closed_reason IN {VALID_REASONS}"
    )
    op.drop_column("rooms", "closed")
    op.drop_constraint("ck_slot_playing_date", "slots", type_="check")
    op.create_check_constraint(
        "ck_slot_playing_date",
        "slots",
        f"end_at <= (({LOCAL_DAY} + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')",
    )
    op.drop_column("slots", "playing_date")


def downgrade() -> None:
    op.add_column("slots", sa.Column("playing_date", sa.Date(), nullable=True))
    op.execute(f"UPDATE slots SET playing_date = {LOCAL_DAY}")
    op.alter_column("slots", "playing_date", nullable=False)
    op.drop_constraint("ck_slot_playing_date", "slots", type_="check")
    op.create_check_constraint(
        "ck_slot_playing_date",
        "slots",
        f"playing_date = {LOCAL_DAY} "
        "AND end_at <= ((playing_date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')",
    )
    op.add_column(
        "rooms",
        sa.Column("closed", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.execute("UPDATE rooms SET closed = (closed_reason IS NOT NULL)")
    op.drop_constraint("ck_room_closed_reason", "rooms", type_="check")
