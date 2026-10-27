import os
from collections.abc import Generator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.db.session import build_engine, get_session
from app.main import app
from app.scripts.reset_test import ensure_test_database


@pytest.fixture(scope="session")
def database_engine():
    settings = get_settings()
    if not settings.test_database_url.get_secret_value():
        pytest.skip(
            "Integration requires the isolated TEST_DATABASE_URL; see make setup."
        )
    url = ensure_test_database()
    old = os.environ.get("MIGRATION_DATABASE_URL")
    os.environ["MIGRATION_DATABASE_URL"] = url
    get_settings.cache_clear()
    try:
        command.upgrade(Config("alembic.ini"), "head")
        command.upgrade(Config("alembic.ini"), "head")
    finally:
        if old is None:
            os.environ.pop("MIGRATION_DATABASE_URL", None)
        else:
            os.environ["MIGRATION_DATABASE_URL"] = old
        get_settings.cache_clear()
    engine = build_engine(url)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(database_engine) -> Generator[Session, None, None]:
    with database_engine.connect() as connection:
        transaction = connection.begin()
        with Session(connection, join_transaction_mode="create_savepoint") as session:
            yield session
        transaction.rollback()


@pytest.fixture
def api_client(db_session: Session) -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_session] = lambda: db_session
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
