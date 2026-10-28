"""Render Free release: serialize migrations, then exec Uvicorn with signals intact."""

import os
import subprocess
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

from app.core.database_urls import migration_url
from app.core.settings import get_settings
from app.db.readiness import check_schema
from app.db.session import connection_options, normalize_url


def main() -> None:
    settings = get_settings()
    settings.validate_runtime()
    value = migration_url(
        settings.database_url.get_secret_value(),
        settings.migration_database_url.get_secret_value(),
    )
    engine = create_engine(
        normalize_url(value),
        poolclass=NullPool,
        connect_args=connection_options(value),
        hide_parameters=True,
    )
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        locked = connection.scalar(text("SELECT pg_try_advisory_lock(4284771)"))
        if not locked:
            raise SystemExit("Another release is migrating; retry deployment later.")
        try:
            result = subprocess.run(
                [sys.executable, "-m", "alembic", "upgrade", "head"], check=False
            )
            if result.returncode:
                raise SystemExit(
                    "Release migration failed; application will not start."
                )
            check_schema(connection)
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(4284771)"))
    engine.dispose()
    os.execv(
        sys.executable,
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            os.getenv("PORT", "8000"),
        ],
    )


if __name__ == "__main__":
    main()
