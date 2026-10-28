from contextlib import nullcontext
from types import SimpleNamespace

import pytest

from app.core.settings import Settings
from app.scripts import start


@pytest.mark.parametrize("locked,returncode", [(False, 0), (True, 1)])
def test_lock_or_migration_failure_never_starts_server(monkeypatch, locked, returncode):
    settings = Settings(
        _env_file=None,
        app_env="test",
        database_url="postgresql://a:b@localhost/runtime",
        migration_database_url="postgresql://a:b@localhost/runtime",
        firebase_project_id="demo-courtmate",
        firebase_auth_emulator_host="localhost:9099",
        firebase_service_account_json="",
    )
    connection = SimpleNamespace(scalar=lambda _: locked, execute=lambda _: None)
    connection.execution_options = lambda **_: nullcontext(connection)
    engine = SimpleNamespace(connect=lambda: connection, dispose=lambda: None)
    monkeypatch.setattr(start, "get_settings", lambda: settings)
    monkeypatch.setattr(start, "create_engine", lambda *args, **kwargs: engine)
    monkeypatch.setattr(
        start.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=returncode),
    )
    monkeypatch.setattr(
        start.os,
        "execv",
        lambda *args: pytest.fail("An unready release must not start Uvicorn."),
    )
    with pytest.raises(SystemExit, match="Another release|migration failed"):
        start.main()
