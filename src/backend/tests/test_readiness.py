from contextlib import nullcontext
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import text

from app.api import health


def test_readiness_requires_applied_migration(database_engine, monkeypatch):
    with database_engine.connect() as connection:
        transaction = connection.begin()
        monkeypatch.setattr(
            health,
            "get_engine",
            lambda: SimpleNamespace(connect=lambda: nullcontext(connection)),
        )
        assert health.ready() == {"status": "ready", "database": "ok"}
        connection.execute(text("DELETE FROM alembic_version"))
        with pytest.raises(HTTPException) as error:
            health.ready()
        assert error.value.status_code == 503
        transaction.rollback()
