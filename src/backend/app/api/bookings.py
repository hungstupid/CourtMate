from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from app.core.auth import require_owner, require_player
from app.db.models import User
from app.db.session import get_session
from app.services import bookings
from app.services.common import Clock, get_clock

router = APIRouter(prefix="/api", tags=["bookings"])

Database = Annotated[Session, Depends(get_session, scope="function")]
Player = Annotated[User, Depends(require_player)]
Owner = Annotated[User, Depends(require_owner)]
ServerClock = Annotated[Clock, Depends(get_clock)]


class Selection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slot_ids: list[UUID] = Field(min_length=1, max_length=4)

    @field_validator("slot_ids")
    @classmethod
    def distinct_slots(cls, values: list[UUID]) -> list[UUID]:
        if len(set(values)) != len(values):
            raise ValueError("Selected slots must be distinct.")
        return values


class Confirmation(Selection):
    quote: str = Field(pattern=r"^[0-9a-f]{64}$")


@router.post("/bookings/review")
def review(payload: Selection, session: Database, player: Player, clock: ServerClock):
    return bookings.review_booking(session, player, payload.slot_ids, clock)


@router.post("/bookings", status_code=201)
def confirm(
    payload: Confirmation, session: Database, player: Player, clock: ServerClock
):
    return bookings.confirm_booking(
        session, player, payload.slot_ids, payload.quote, clock
    )


@router.get("/bookings")
def history(session: Database, player: Player, clock: ServerClock):
    return bookings.player_bookings(session, player, clock)


@router.get("/bookings/{booking_id}")
def detail(booking_id: UUID, session: Database, player: Player, clock: ServerClock):
    return bookings.player_booking(session, player, booking_id, clock)


@router.post("/bookings/{booking_id}/cancel")
def cancel(booking_id: UUID, session: Database, player: Player, clock: ServerClock):
    return bookings.cancel_booking(session, player, booking_id, clock)


@router.get("/owner/bookings")
def owner_history(session: Database, owner: Owner, clock: ServerClock):
    return bookings.owner_bookings(session, owner, clock)


@router.get("/owner/bookings/{booking_id}")
def owner_detail(booking_id: UUID, session: Database, owner: Owner, clock: ServerClock):
    return bookings.owner_booking(session, owner, booking_id, clock)
