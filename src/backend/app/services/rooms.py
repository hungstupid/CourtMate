"""Open Play membership serialized by the source court's PostgreSQL row lock."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Booking, BookingSlot, Court, Room, RoomMember, User
from app.services.common import Clock, database_now, fail, lock_court


def _player(user: User) -> None:
    if user.role != "player":
        fail(
            "PLAYER_REQUIRED", "Only a Player may create or participate in a room.", 403
        )


def _locked_booking(session: Session, booking_id: UUID) -> tuple[Court, Booking]:
    court_id = session.scalar(select(Booking.court_id).where(Booking.id == booking_id))
    if court_id is None:
        fail("BOOKING_NOT_FOUND", "Booking not found.", 404)
    court = lock_court(session, court_id)
    booking = session.scalar(
        select(Booking)
        .where(Booking.id == booking_id, Booking.court_id == court.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if booking is None:
        fail("BOOKING_NOT_FOUND", "Booking not found.", 404)
    return court, booking


def _locked_room(session: Session, room_id: UUID) -> tuple[Court, Booking, Room]:
    booking_id = session.scalar(select(Room.booking_id).where(Room.id == room_id))
    if booking_id is None:
        fail("ROOM_NOT_FOUND", "Room not found.", 404)
    court, booking = _locked_booking(session, booking_id)
    room = session.scalar(
        select(Room)
        .where(Room.id == room_id, Room.booking_id == booking.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if room is None:
        fail("ROOM_NOT_FOUND", "Room not found.", 404)
    return court, booking, room


def _member_count(session: Session, room: Room) -> int:
    return session.scalar(
        select(func.count())
        .select_from(RoomMember)
        .where(RoomMember.room_id == room.id)
    )


def _status(room: Room, booking: Booking, count: int, now: datetime) -> str:
    if room.closed or booking.status != "CONFIRMED" or now >= booking.start_at:
        room.closed = True
        return "CLOSED"
    return "FULL" if count >= room.capacity else "OPEN"


def _estimate(session: Session, booking: Booking, count: int) -> int | None:
    snapshots = list(
        session.scalars(
            select(BookingSlot)
            .where(BookingSlot.booking_id == booking.id)
            .order_by(BookingSlot.position)
        )
    )
    total = booking.total_price_vnd
    valid = (
        type(total) is int
        and total > 0
        and count > 0
        and 1 <= len(snapshots) <= 4
        and [row.position for row in snapshots] == list(range(len(snapshots)))
        and all(type(row.price_vnd) is int and row.price_vnd > 0 for row in snapshots)
        and all(row.start_at < row.end_at and row.slot_version > 0 for row in snapshots)
        and sum(row.price_vnd for row in snapshots) == total
    )
    if not valid:
        return None
    if (
        snapshots[0].start_at != booking.start_at
        or snapshots[-1].end_at != booking.end_at
        or any(
            left.end_at != right.start_at
            for left, right in zip(snapshots, snapshots[1:], strict=False)
        )
    ):
        return None
    # Integer round-half-up avoids float money and the platform's tie-to-even round().
    return (2 * total + count) // (2 * count)


def _serialize(
    session: Session, court: Court, booking: Booking, room: Room, now: datetime
) -> dict:
    count = _member_count(session, room)
    status = _status(room, booking, count, now)
    estimate = _estimate(session, booking, count)
    session.flush()
    return {
        "id": room.id,
        "booking_id": booking.id,
        "organizer_id": room.organizer_id,
        "court_id": court.id,
        "start_at": booking.start_at,
        "end_at": booking.end_at,
        "capacity": room.capacity,
        "member_count": count,
        "remaining_places": max(0, room.capacity - count),
        "status": status,
        "estimated_share_vnd": estimate,
        "estimate_status": "available" if estimate is not None else "unavailable",
        "created_at": room.created_at,
    }


def create_room(
    session: Session,
    player: User,
    booking_id: UUID,
    capacity: int,
    clock: Clock = database_now,
) -> dict:
    _player(player)
    if type(capacity) is not int or not 2 <= capacity <= 60:
        fail("INVALID_CAPACITY", "Room capacity must be an integer from 2 to 60.", 422)
    court, booking = _locked_booking(session, booking_id)
    if booking.player_id != player.id:
        fail("NOT_BOOKING_OWNER", "Only the booking's Player may create its room.", 403)
    existing = session.scalar(
        select(Room)
        .where(Room.booking_id == booking.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    now = clock(session)
    if existing is not None:
        fail("ROOM_ALREADY_EXISTS", "This booking already has its linked room.")
    if booking.status != "CONFIRMED" or booking.start_at <= now:
        fail("BOOKING_NOT_ELIGIBLE", "A room requires a future confirmed booking.")
    if capacity > 2 * court.max_players:
        fail("INVALID_CAPACITY", "Room capacity exceeds twice the court capacity.", 422)
    room = Room(
        booking_id=booking.id,
        organizer_id=player.id,
        capacity=capacity,
        closed=False,
        created_at=now,
    )
    session.add(room)
    session.flush()
    session.add(RoomMember(room_id=room.id, player_id=player.id, joined_at=now))
    session.flush()
    return _serialize(session, court, booking, room, now)


def room_detail(session: Session, room_id: UUID, clock: Clock = database_now) -> dict:
    court, booking, room = _locked_room(session, room_id)
    return _serialize(session, court, booking, room, clock(session))


def list_rooms(session: Session, clock: Clock = database_now) -> list[dict]:
    # Deterministic parent-first order also avoids opposite lock order between lists.
    room_ids = list(
        session.scalars(
            select(Room.id)
            .join(Booking, Booking.id == Room.booking_id)
            .order_by(Booking.court_id, Booking.id, Room.id)
        )
    )
    return [room_detail(session, room_id, clock) for room_id in room_ids]


def join_room(
    session: Session, player: User, room_id: UUID, clock: Clock = database_now
) -> dict:
    _player(player)
    court, booking, room = _locked_room(session, room_id)
    now = clock(session)
    count = _member_count(session, room)
    status = _status(room, booking, count, now)
    if status == "CLOSED":
        fail("ROOM_CLOSED", "The room is closed to membership changes.")
    if (
        session.get(RoomMember, (room.id, player.id), populate_existing=True)
        is not None
    ):
        fail("ALREADY_MEMBER", "This Player is already a member of the room.")
    if status == "FULL":
        fail("ROOM_FULL", "The room has no remaining place.")
    session.add(RoomMember(room_id=room.id, player_id=player.id, joined_at=now))
    session.flush()
    return _serialize(session, court, booking, room, now)


def leave_room(
    session: Session, player: User, room_id: UUID, clock: Clock = database_now
) -> dict:
    _player(player)
    court, booking, room = _locked_room(session, room_id)
    now = clock(session)
    if _status(room, booking, _member_count(session, room), now) == "CLOSED":
        fail("ROOM_CLOSED", "The room is closed to membership changes.")
    if room.organizer_id == player.id:
        fail("ORGANIZER_CANNOT_LEAVE", "The organizer must remain in the linked room.")
    membership = session.get(RoomMember, (room.id, player.id), populate_existing=True)
    if membership is None:
        fail("NOT_A_MEMBER", "This Player is not enrolled in the room.")
    session.delete(membership)
    session.flush()
    return _serialize(session, court, booking, room, now)
