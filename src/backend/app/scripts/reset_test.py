"""Only initialize/reset a separate, localhost database ending in _test."""

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.pool import NullPool

from app.core.settings import get_settings
from app.db.models import Base
from app.db.session import normalize_url


def test_url() -> str:
    settings = get_settings()
    value = settings.test_database_url.get_secret_value()
    if not value:
        raise RuntimeError("TEST_DATABASE_URL is required.")
    url = make_url(value)
    if url.host not in {"localhost", "127.0.0.1", "db"} or not (
        url.database or ""
    ).endswith("_test"):
        raise RuntimeError(
            "Test reset/restore is restricted to a localhost database ending in _test."
        )
    if value == settings.database_url.get_secret_value():
        raise RuntimeError("Refusing to reset the runtime database.")
    return normalize_url(value)


def ensure_test_database() -> str:
    value = test_url()
    url = make_url(value)
    admin = create_engine(
        url.set(database="postgres"), isolation_level="AUTOCOMMIT", poolclass=NullPool
    )
    with admin.connect() as connection:
        exists = connection.scalar(
            text("SELECT 1 FROM pg_database WHERE datname=:name"),
            {"name": url.database},
        )
        if not exists:
            # Identifier quoting is handled by the dialect, never shell interpolation.
            quoted = admin.dialect.identifier_preparer.quote(url.database)
            connection.exec_driver_sql(f"CREATE DATABASE {quoted}")
    admin.dispose()
    return value


def main() -> None:
    engine = create_engine(ensure_test_database(), poolclass=NullPool)
    with engine.begin() as connection:
        Base.metadata.drop_all(connection)
        connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
    engine.dispose()
    print("Only the isolated local test database was reset. Run tests to migrate it.")


if __name__ == "__main__":
    main()
