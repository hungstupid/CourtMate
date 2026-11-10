"""Store validated registration contact and non-critical editable profile."""

import sqlalchemy as sa
from alembic import op

revision = "0004_account_profile"
down_revision = "0003_open_play"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("registration_email", sa.String(320), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column("display_name", sa.String(100), server_default="", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column(
            "contact_preferences", sa.String(500), server_default="", nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "contact_preferences")
    op.drop_column("users", "display_name")
    op.drop_column("users", "registration_email")
