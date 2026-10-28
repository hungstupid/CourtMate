from alembic import context
from sqlalchemy import create_engine, pool

from app.core.database_urls import migration_url
from app.core.settings import get_settings
from app.db.models import Base
from app.db.session import connection_options, normalize_url

target_metadata = Base.metadata


def run_migrations() -> None:
    settings = get_settings()
    value = migration_url(
        settings.database_url.get_secret_value(),
        settings.migration_database_url.get_secret_value(),
    )
    if context.is_offline_mode():
        context.configure(
            url=value, target_metadata=target_metadata, literal_binds=True
        )
        with context.begin_transaction():
            context.run_migrations()
    else:
        supplied = context.config.attributes.get("connection")
        if supplied is not None:
            context.configure(
                connection=supplied, target_metadata=target_metadata, compare_type=True
            )
            with context.begin_transaction():
                context.run_migrations()
            return
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
