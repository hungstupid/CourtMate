from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator
from sqlalchemy.orm import Session

from app.core.auth import require_owner
from app.db.models import User
from app.db.session import get_session
from app.services import offers
from app.services.common import Clock, get_clock

router = APIRouter(prefix="/api/owner", tags=["slot offers"])
Database = Annotated[Session, Depends(get_session, scope="function")]
Owner = Annotated[User, Depends(require_owner)]
ServerClock = Annotated[Clock, Depends(get_clock)]


class OfferCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["manual", "automatic"]
    price_vnd: StrictInt = Field(ge=1, le=2**63 - 1)
    lead_hours: Decimal = Field(default=Decimal(24), gt=0, le=24, allow_inf_nan=False)

    @field_validator("lead_hours", mode="before")
    @classmethod
    def numeric_lead(cls, value):
        if isinstance(value, bool):
            raise ValueError("Lead time must be numeric.")
        return value


@router.get("/slots/{slot_id}/offers")
def listing(slot_id: UUID, session: Database, owner: Owner, clock: ServerClock):
    return offers.list_offers(session, owner, slot_id, clock)


@router.post("/slots/{slot_id}/offers", status_code=201)
def create(
    slot_id: UUID,
    payload: OfferCreate,
    session: Database,
    owner: Owner,
    clock: ServerClock,
):
    return offers.create_offer(
        session,
        owner,
        slot_id,
        payload.mode,
        payload.price_vnd,
        payload.lead_hours,
        clock,
    )


def finish(session, owner, offer_id, action, clock):
    try:
        return offers.finish_offer(session, owner, offer_id, action, clock)
    except HTTPException as error:
        if (
            isinstance(error.detail, dict)
            and error.detail.get("code") == "OFFER_STATE_CHANGED"
        ):
            return JSONResponse(
                status_code=409, content=jsonable_encoder({"detail": error.detail})
            )
        raise


@router.post("/offers/{offer_id}/cancel")
def cancel(offer_id: UUID, session: Database, owner: Owner, clock: ServerClock):
    return finish(session, owner, offer_id, "cancel", clock)


@router.post("/offers/{offer_id}/deactivate")
def deactivate(offer_id: UUID, session: Database, owner: Owner, clock: ServerClock):
    return finish(session, owner, offer_id, "deactivate", clock)
