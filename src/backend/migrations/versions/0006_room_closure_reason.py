"""Record the authoritative closure reason without changing room membership."""

import sqlalchemy as sa
from alembic import op

revision = "0006_room_closure_reason"
down_revision = "0005_slot_offers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("rooms", sa.Column("closed_reason", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("rooms", "closed_reason")
