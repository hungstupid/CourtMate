from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictInt
from sqlalchemy.orm import Session

from app.core.auth import require_player, require_player_readonly
from app.db.models import User
from app.db.session import get_session
from app.services import rooms
from app.services.common import Clock, get_clock

router = APIRouter(prefix="/api", tags=["open-play-rooms"])

Database = Annotated[Session, Depends(get_session, scope="function")]
Player = Annotated[User, Depends(require_player)]
ServerClock = Annotated[Clock, Depends(get_clock)]


class RoomCreation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    capacity: StrictInt = Field(ge=2, le=60)


@router.post("/bookings/{booking_id}/room", status_code=201)
def create(
    booking_id: UUID,
    payload: RoomCreation,
    session: Database,
    player: Player,
    clock: ServerClock,
):
    return rooms.create_room(session, player, booking_id, payload.capacity, clock)


@router.get("/rooms")
def listing(
    session: Database,
    clock: ServerClock,
    location: Annotated[str, Query(max_length=300)] = "",
):
    return rooms.list_rooms(session, clock, location)


@router.get("/rooms/{room_id}")
def detail(room_id: UUID, session: Database, clock: ServerClock):
    return rooms.room_detail(session, room_id, clock)


@router.post("/rooms/{room_id}/join")
def join(
    room_id: UUID,
    session: Database,
    player: Annotated[User, Depends(require_player_readonly)],
    clock: ServerClock,
):
    try:
        return rooms.join_room(session, player, room_id, clock)
    except rooms.JoinDetectedClosure as error:
        # The authenticated lookup is read-only and the service checks closure
        # before any roster mutation. Only this newly detected reason commits.
        return JSONResponse(status_code=409, content={"detail": error.detail})


@router.post("/rooms/{room_id}/leave")
def leave(room_id: UUID, session: Database, player: Player, clock: ServerClock):
    return rooms.leave_room(session, player, room_id, clock)


@router.get("/rooms/{room_id}/membership")
def membership(room_id: UUID, session: Database, player: Player, clock: ServerClock):
    return rooms.my_room_membership(session, player, room_id, clock)


@router.post("/rooms/{room_id}/close")
def close(room_id: UUID, session: Database, player: Player, clock: ServerClock):
    return rooms.close_room(session, player, room_id, clock)
