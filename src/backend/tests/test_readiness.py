from contextlib import nullcontext
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import text

from app.api import health
from app.db.readiness import required_heads


@pytest.mark.parametrize(
    "revision", [None, "0001_identity", "not-a-revision", "current"]
)
def test_readiness_requires_current_heads(database_engine, monkeypatch, revision):
    with database_engine.connect() as connection:
        transaction = connection.begin()
        monkeypatch.setattr(
            health,
            "get_engine",
            lambda: SimpleNamespace(connect=lambda: nullcontext(connection)),
        )
        connection.execute(text("DELETE FROM alembic_version"))
        actual_revision = (
            next(iter(required_heads())) if revision == "current" else revision
        )
        if actual_revision:
            connection.execute(
                text("INSERT INTO alembic_version VALUES (:revision)"),
                {"revision": actual_revision},
            )
        if revision == "current":
            assert health.ready() == {"status": "ready", "database": "ok"}
        else:
            with pytest.raises(HTTPException) as error:
                health.ready()
            assert error.value.status_code == 503
        transaction.rollback()


def test_readiness_missing_table(database_engine, monkeypatch):
    with database_engine.connect() as connection:
        transaction = connection.begin()
        connection.execute(text("DROP TABLE alembic_version"))
        monkeypatch.setattr(
            health,
            "get_engine",
            lambda: SimpleNamespace(connect=lambda: nullcontext(connection)),
        )
        with pytest.raises(HTTPException) as error:
            health.ready()
        assert error.value.status_code == 503
        transaction.rollback()


def test_readiness_connection_failure(monkeypatch):
    def unavailable():
        raise OSError("provider unavailable")

    monkeypatch.setattr(health, "get_engine", unavailable)
    with pytest.raises(HTTPException) as error:
        health.ready()
    assert error.value.status_code == 503


def test_existing_revision_is_not_ready_for_newer_code(database_engine, monkeypatch):
    from app.db import readiness

    monkeypatch.setattr(readiness, "required_heads", lambda: frozenset({"0002_future"}))
    with database_engine.connect() as connection:
        monkeypatch.setattr(
            health,
            "get_engine",
            lambda: SimpleNamespace(connect=lambda: nullcontext(connection)),
        )
        with pytest.raises(HTTPException) as error:
            health.ready()
        assert error.value.status_code == 503
