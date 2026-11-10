from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.auth import current_user, require_owner, verified_identity
from app.db.models import User
from app.db.session import get_session

router = APIRouter(prefix="/api", tags=["account"])
Database = Annotated[Session, Depends(get_session, scope="function")]
Account = Annotated[User, Depends(current_user)]


class IdentityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    firebase_uid: str
    role: Literal["player", "owner"]


class Registration(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["player", "owner"]


class ProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    display_name: str = Field(max_length=100)
    contact_preferences: str = Field(max_length=500)


def profile_data(user: User) -> dict:
    return {
        "display_name": user.display_name,
        "contact_preferences": user.contact_preferences,
        "registration_email": user.registration_email,
        "role": user.role,
    }


@router.post("/register", response_model=IdentityResponse, status_code=201)
def register(
    payload: Registration,
    session: Database,
    identity: Annotated[dict[str, Any], Depends(verified_identity)],
):
    uid, email = identity.get("uid"), identity.get("email")
    if (
        not isinstance(uid, str)
        or not 1 <= len(uid) <= 128
        or not isinstance(email, str)
        or not 1 <= len(email) <= 320
    ):
        raise HTTPException(
            422, "A successfully registered email/password identity is required."
        )
    # ON CONFLICT serializes retries without ever changing an existing role.
    created = session.scalar(
        insert(User)
        .values(
            firebase_uid=uid,
            role=payload.role,
            registration_email=email,
            display_name=str(identity.get("name") or "")[:100],
            contact_preferences="",
        )
        .on_conflict_do_nothing(index_elements=[User.firebase_uid])
        .returning(User.id)
    )
    user = session.scalar(select(User).where(User.firebase_uid == uid))
    if created is None and user.role != payload.role:
        raise HTTPException(409, "An existing account cannot change its initial role.")
    return user


@router.get("/me", response_model=IdentityResponse)
def me(user: Account) -> User:
    return user


@router.get("/profile")
def profile(user: Account):
    return profile_data(user)


@router.patch("/profile")
def save_profile(payload: ProfilePatch, user: Account):
    user.display_name = payload.display_name
    user.contact_preferences = payload.contact_preferences
    return profile_data(user)


@router.get("/owner/access", response_model=IdentityResponse)
def owner_access(user: Annotated[User, Depends(require_owner)]) -> User:
    return user
