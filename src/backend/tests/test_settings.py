import json

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.database_urls import migration_url
from app.core.settings import Settings


def config(**changes):
    values = dict(
        _env_file=None,
        app_env="test",
        database_url="postgresql://test:private-sentinel@localhost:5432/courtmate",
        migration_database_url="",
        test_database_url="",
        firebase_project_id="demo-courtmate",
        firebase_auth_emulator_host="127.0.0.1:9099",
        firebase_service_account_json="",
    )
    values.update(changes)
    return Settings(**values)


@pytest.fixture(scope="module")
def service_account():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return json.dumps(
        {
            "type": "service_account",
            "project_id": "courtmate-project",
            "private_key_id": "unit-test-only",
            "private_key": key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            ).decode(),
            "client_email": "test@courtmate-project.iam.gserviceaccount.com",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    )


@pytest.mark.parametrize(
    "value",
    [
        "sqlite:///test.db",
        "not-a-url",
        "postgresql://",
        "postgresql://user@host",
        "postgresql://user@host:invalid/database",
        "postgresql://user@host:99999/database",
        "postgresql://user@host:0/database",
        "postgresql://user@host/database?host=other",
        "",
    ],
)
def test_invalid_database_fails_without_secret(value):
    with pytest.raises(RuntimeError) as error:
        config(database_url=value).validate_runtime()
    assert "private-sentinel" not in str(error.value)
    assert value not in str(error.value) if value else True


@pytest.mark.parametrize("env", ["local", "test"])
def test_emulator_config_needs_no_cloud_credential(env):
    config(app_env=env).validate_runtime()


def test_valid_production_pooled_runtime_direct_migration(service_account):
    config(
        app_env="production",
        firebase_project_id="courtmate-project",
        firebase_auth_emulator_host="",
        firebase_service_account_json=service_account,
        database_url="postgresql://a:b@ep-unit-pooler.ap-southeast-1.aws.neon.tech/demo?sslmode=require",
        migration_database_url="postgresql://other:password@ep-unit.ap-southeast-1.aws.neon.tech/demo?sslmode=require",
    ).validate_runtime()


@pytest.mark.parametrize(
    "migration",
    [
        "postgresql://a:b@ep-unit-pooler.aws.neon.tech/demo",
        "postgresql://a:b@localhost/other",
        "sqlite:///wrong.db",
    ],
)
def test_invalid_migration_target(migration):
    with pytest.raises(RuntimeError):
        migration_url("postgresql://a:b@localhost/courtmate", migration)


@pytest.mark.parametrize(
    "raw",
    [
        "{broken-private-sentinel",
        "[]",
        "{}",
        '{"type":"service_account","project_id":"other"}',
        '{"type":"service_account","project_id":"courtmate-project","client_email":"test@courtmate-project.iam.gserviceaccount.com","private_key":"private-sentinel"}',
    ],
)
def test_invalid_credential_is_configuration_error_without_secret(raw):
    with pytest.raises(RuntimeError, match="valid service account") as error:
        config(
            firebase_project_id="courtmate-project", firebase_service_account_json=raw
        ).validate_runtime()
    assert "private-sentinel" not in str(error.value)


def test_demo_requires_emulator():
    with pytest.raises(RuntimeError, match="requires the Auth Emulator"):
        config(firebase_auth_emulator_host="").validate_runtime()


@pytest.mark.parametrize(
    "host",
    ["http://localhost:9099", "remote.example:9099", "localhost", "localhost:bad"],
)
def test_invalid_emulator_destination(host):
    with pytest.raises(RuntimeError, match="loopback"):
        config(firebase_auth_emulator_host=host).validate_runtime()


@pytest.mark.parametrize(
    "changes",
    [
        {"firebase_project_id": ""},
        {"firebase_project_id": "wrong project"},
        {
            "app_env": "production",
            "firebase_project_id": "courtmate-project",
            "firebase_auth_emulator_host": "",
            "database_url": "postgresql://a:b@cloud.example/demo",
            "migration_database_url": "postgresql://a:b@cloud.example/demo",
        },
        {
            "app_env": "production",
            "firebase_project_id": "courtmate-project",
            "firebase_auth_emulator_host": "",
            "database_url": "postgresql://a:b@localhost/demo",
            "migration_database_url": "postgresql://a:b@localhost/demo",
        },
        {
            "database_url": "postgresql://a:b@ep-unit-pooler.aws.neon.tech/demo",
            "migration_database_url": "postgresql://a:b@ep-unit.aws.neon.tech/demo?sslmode=disable",
        },
    ],
)
def test_required_and_environment_consistency(changes):
    with pytest.raises(RuntimeError):
        config(**changes).validate_runtime()


def test_production_rejects_demo_project():
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="real Firebase project"):
        config(app_env="production", firebase_auth_emulator_host="")
