import json
import os
from functools import lru_cache
from typing import Annotated, Any
from uuid import UUID

import firebase_admin
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials
from google.auth.credentials import AnonymousCredentials
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.db.models import User
from app.db.session import get_session

bearer = HTTPBearer(auto_error=False)


class EmulatorCredential(credentials.Base):
    def get_credential(self) -> AnonymousCredentials:
        return AnonymousCredentials()


@lru_cache
def firebase_app() -> firebase_admin.App:
    settings = get_settings()
    if settings.firebase_auth_emulator_host and settings.app_env != "production":
        # The Admin SDK reads this setting from os.environ, not Pydantic settings.
        os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = settings.firebase_auth_emulator_host
        credential = EmulatorCredential()
    else:
        raw = settings.firebase_service_account_json.get_secret_value()
        credential = (
            credentials.Certificate(json.loads(raw))
            if raw
            else credentials.ApplicationDefault()
        )
    return firebase_admin.initialize_app(
        credential, {"projectId": settings.firebase_project_id}, name="courtmate"
    )


def verified_identity(
    authorization: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> dict[str, Any]:
    if not authorization:
        raise HTTPException(
            401,
            "A Firebase ID token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return auth.verify_id_token(
            authorization.credentials, app=firebase_app(), check_revoked=True
        )
    except (
        ValueError,
        auth.InvalidIdTokenError,
        auth.UserDisabledError,
        auth.UserNotFoundError,
    ) as error:
        raise HTTPException(
            401,
            "Invalid, expired, revoked, disabled or deleted Firebase identity.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
    except Exception as error:
        # Fail closed during a Firebase outage, without logging credentials or tokens.
        raise HTTPException(
            503, "Identity verification is temporarily unavailable."
        ) from error


def current_user(
    identity: Annotated[dict[str, Any], Depends(verified_identity)],
    session: Annotated[Session, Depends(get_session)],
) -> User:
    uid = identity.get("uid")
    if not isinstance(uid, str) or not uid or len(uid) > 128:
        raise HTTPException(401, "Invalid Firebase identity.")
    # Ignore all role fields/claims sent by clients. New verified UIDs are Players.
    session.execute(
        insert(User)
        .values(firebase_uid=uid, role="player")
        .on_conflict_do_nothing(index_elements=[User.firebase_uid])
    )
    session.commit()
    user = session.scalar(select(User).where(User.firebase_uid == uid))
    if user is None or user.role not in {"player", "owner"}:
        raise HTTPException(403, "No valid server-controlled role.")
    return user


def require_owner(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != "owner":
        raise HTTPException(403, "Court Owner access is required.")
    return user


def require_resource_ownership(user: User, owner_id: UUID) -> None:
    """Use with require_owner on future Owner-managed resource mutations."""
    if user.role != "owner" or user.id != owner_id:
        raise HTTPException(403, "This resource belongs to another Court Owner.")
