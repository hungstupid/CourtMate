from alembic import context
from sqlalchemy import create_engine, pool

from app.core.settings import get_settings
from app.db.models import Base
from app.db.session import connection_options, normalize_url

target_metadata = Base.metadata


def run_migrations() -> None:
    settings = get_settings()
    value = (
        settings.migration_database_url.get_secret_value()
        or settings.database_url.get_secret_value()
    )
    if not value:
        raise RuntimeError("MIGRATION_DATABASE_URL or DATABASE_URL is required.")
    if "-pooler." in value:
        raise RuntimeError("Use a direct PostgreSQL URL for Alembic migrations.")
    if context.is_offline_mode():
        context.configure(
            url=value, target_metadata=target_metadata, literal_binds=True
        )
        with context.begin_transaction():
            context.run_migrations()
    else:
        engine = create_engine(
            normalize_url(value),
            poolclass=pool.NullPool,
            connect_args=connection_options(value),
            hide_parameters=True,
        )
        with engine.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                compare_type=True,
            )
            with context.begin_transaction():
                context.run_migrations()
        engine.dispose()


run_migrations()
