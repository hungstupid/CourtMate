"""Render Free release: serialize migrations, then exec Uvicorn with signals intact."""

import os
import subprocess
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

from app.core.settings import get_settings
from app.db.session import connection_options, normalize_url


def main() -> None:
    settings = get_settings()
    settings.validate_runtime()
    value = settings.migration_database_url.get_secret_value()
    if not value:
        raise SystemExit(
            "MIGRATION_DATABASE_URL is required for the release migration."
        )
    if "-pooler." in value:
        raise SystemExit("Release migrations require a direct PostgreSQL connection.")
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
