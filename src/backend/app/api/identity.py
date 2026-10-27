from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from app.core.auth import current_user, require_owner
from app.db.models import User

router = APIRouter(prefix="/api", tags=["identity setup"])


class IdentityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    firebase_uid: str
    role: Literal["player", "owner"]


@router.get("/me", response_model=IdentityResponse)
def me(user: Annotated[User, Depends(current_user)]) -> User:
    return user


@router.get("/owner/access", response_model=IdentityResponse)
def owner_access(user: Annotated[User, Depends(require_owner)]) -> User:
    """Authorization smoke endpoint, not a court-management feature."""
    return user
