from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictInt
from sqlalchemy.orm import Session

from app.core.auth import require_player
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


def _closed_response(error: HTTPException) -> JSONResponse:
    """Commit derived closure even when an otherwise read-only mutation is rejected.

    Room services check CLOSED before touching membership. Returning the same
    409 body lets the function-scope Session commit only that sticky closed flag
    (and harmless identity provisioning), so a later clock correction cannot
    reopen the room. Every other failure still propagates and rolls back.
    """
    if isinstance(error.detail, dict) and error.detail.get("code") == "ROOM_CLOSED":
        return JSONResponse(
            status_code=409, content={"detail": error.detail}, headers=error.headers
        )
    raise error


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
def listing(session: Database, clock: ServerClock):
    return rooms.list_rooms(session, clock)


@router.get("/rooms/{room_id}")
def detail(room_id: UUID, session: Database, clock: ServerClock):
    return rooms.room_detail(session, room_id, clock)


@router.post("/rooms/{room_id}/join")
def join(room_id: UUID, session: Database, player: Player, clock: ServerClock):
    try:
        return rooms.join_room(session, player, room_id, clock)
    except HTTPException as error:
        return _closed_response(error)


@router.post("/rooms/{room_id}/leave")
def leave(room_id: UUID, session: Database, player: Player, clock: ServerClock):
    try:
        return rooms.leave_room(session, player, room_id, clock)
    except HTTPException as error:
        return _closed_response(error)
