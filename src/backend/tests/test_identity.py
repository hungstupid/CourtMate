import uuid

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.auth import require_resource_ownership
from app.core.settings import get_settings
from app.db.models import User


def emulator_token() -> tuple[str, str]:
    host = get_settings().firebase_auth_emulator_host
    if not host:
        pytest.skip("Auth integration requires a running Firebase Auth Emulator.")
    response = httpx.post(
        f"http://{host}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
        json={
            "email": f"test-{uuid.uuid4().hex}@courtmate.test",
            "password": "Isolated-test-123!",
            "returnSecureToken": True,
        },
        timeout=15,
    )
    assert response.status_code == 200
    data = response.json()
    return data["idToken"], data["localId"]


def test_missing_token(api_client: TestClient) -> None:
    assert api_client.get("/api/me").status_code == 401


def test_invalid_token(api_client: TestClient) -> None:
    assert (
        api_client.get(
            "/api/me", headers={"Authorization": "Bearer invalid-token"}
        ).status_code
        == 401
    )


def test_real_emulator_token_player_owner_and_role_control(
    api_client: TestClient, db_session: Session
) -> None:
    token, uid = emulator_token()
    headers = {"Authorization": f"Bearer {token}"}
    response = api_client.get("/api/me?role=owner", headers=headers)
    assert response.status_code == 200
    assert response.json()["firebase_uid"] == uid
    assert response.json()["role"] == "player"
    assert api_client.get("/api/owner/access", headers=headers).status_code == 403
    # Only a trusted operator can update the stored role; public requests cannot.
    db_session.execute(
        text("UPDATE users SET role='owner' WHERE firebase_uid=:uid"), {"uid": uid}
    )
    db_session.commit()
    assert api_client.get("/api/owner/access", headers=headers).status_code == 200
    assert (
        api_client.post("/api/me", headers=headers, json={"role": "owner"}).status_code
        == 405
    )


def test_ownership_rejects_other_owner() -> None:
    user = User(id=uuid.uuid4(), firebase_uid="owner-a", role="owner")
    with pytest.raises(HTTPException) as error:
        require_resource_ownership(user, uuid.uuid4())
    assert error.value.status_code == 403
    require_resource_ownership(user, user.id)


def test_database_utc_and_migration(database_engine) -> None:
    with database_engine.connect() as connection:
        assert connection.scalar(text("SHOW timezone")) == "UTC"
        assert (
            connection.scalar(text("SELECT version_num FROM alembic_version"))
            == "0001_identity"
        )


def test_unknown_role_rejected_by_database(db_session: Session) -> None:
    from sqlalchemy.exc import IntegrityError

    with pytest.raises(IntegrityError):
        db_session.add(User(firebase_uid=f"bad-{uuid.uuid4().hex}", role="organizer"))
        db_session.flush()


def test_production_rejects_emulator() -> None:
    from pydantic import ValidationError

    from app.core.settings import Settings

    with pytest.raises(ValidationError, match="forbidden"):
        Settings(app_env="production", firebase_auth_emulator_host="localhost:9099")
