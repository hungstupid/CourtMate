import pytest

from app.core.settings import Settings
from app.scripts import reset_test


@pytest.mark.parametrize(
    "target",
    [
        "postgresql+psycopg://other:changed@localhost/runtime_test?application_name=tests",
        "postgresql://other:changed@127.0.0.1:5432/runtime_test",
        "postgresql://other:changed@[::1]:5432/runtime_test",
        "postgresql://other:changed@127.0.0.2/runtime_test",
        "postgresql://other:changed@localhost./runtime_test",
    ],
)
def test_driver_credentials_query_and_loopback_do_not_bypass_guard(monkeypatch, target):
    settings = Settings(
        _env_file=None,
        database_url="postgresql://runtime:secret@localhost/runtime_test",
        test_database_url=target,
    )
    monkeypatch.setattr(reset_test, "get_settings", lambda: settings)
    with pytest.raises(RuntimeError, match="runtime database"):
        reset_test.test_url()


@pytest.mark.parametrize(
    "target",
    [
        "postgresql://a:b@cloud.neon.tech/demo_test",
        "postgresql://a:b@localhost/courtmate",
        "postgresql://a:b@localhost/courtmate_test?host=cloud.neon.tech",
        "postgresql://a:b@localhost/courtmate_test?port=9999",
        "postgresql://a:b@localhost/courtmate_test?service=demo",
        "sqlite:///courtmate_test",
    ],
)
def test_only_explicit_local_test_target_allowed(monkeypatch, target):
    settings = Settings(
        _env_file=None,
        database_url="postgresql://a:b@localhost/runtime",
        test_database_url=target,
    )
    monkeypatch.setattr(reset_test, "get_settings", lambda: settings)
    with pytest.raises(RuntimeError):
        reset_test.test_url()


def test_isolated_target_and_migration_alias_guard(monkeypatch):
    settings = Settings(
        _env_file=None,
        database_url="postgresql://a:b@localhost:5433/runtime",
        test_database_url="postgresql://a:b@localhost:5433/separate_test",
    )
    monkeypatch.setattr(reset_test, "get_settings", lambda: settings)
    assert "separate_test" in reset_test.test_url()
    settings.migration_database_url = settings.test_database_url
    with pytest.raises(RuntimeError, match="runtime database"):
        reset_test.test_url()


def test_production_never_resets(monkeypatch):
    settings = Settings(
        _env_file=None,
        app_env="production",
        firebase_auth_emulator_host="",
        firebase_project_id="courtmate-project",
        database_url="postgresql://a:b@cloud.example/demo",
        test_database_url="postgresql://a:b@localhost/isolated_test",
    )
    monkeypatch.setattr(reset_test, "get_settings", lambda: settings)
    with pytest.raises(RuntimeError):
        reset_test.test_url()


@pytest.mark.parametrize("action", ["reset", "restore-test"])
def test_destructive_entrypoints_refuse_same_target_before_connecting(
    monkeypatch, action
):
    from app.scripts import database_backup

    settings = Settings(
        _env_file=None,
        database_url="postgresql://a:secret@localhost/runtime_test",
        migration_database_url="",
        test_database_url="postgresql+psycopg://other:password@[::1]:5432/runtime_test",
    )
    monkeypatch.setattr(reset_test, "get_settings", lambda: settings)
    monkeypatch.setattr(database_backup, "get_settings", lambda: settings)

    def never_connect(*args, **kwargs):
        pytest.fail("A rejected target must never open a database connection.")

    monkeypatch.setattr(reset_test, "create_engine", never_connect)
    monkeypatch.setattr("sys.argv", ["database_backup", action])
    with pytest.raises(RuntimeError, match="runtime database"):
        (reset_test.main if action == "reset" else database_backup.main)()
