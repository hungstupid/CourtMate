"""PostgreSQL-backed Open Play state, privacy and time-boundary tests."""

import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api.rooms import RoomCreation
from app.db.models import Booking, BookingSlot, Room, RoomMember, User
from app.services import bookings, courts, rooms

NOW = datetime(2035, 1, 1, tzinfo=UTC)
START = NOW + timedelta(days=1, hours=3)


def fixed_clock(_session: Session) -> datetime:
    return NOW


@pytest.fixture
def room_data(db_session):
    owner = User(firebase_uid="room-owner-" + uuid.uuid4().hex, role="owner")
    players = [
        User(firebase_uid="room-player-" + uuid.uuid4().hex, role="player")
        for _ in range(4)
    ]
    db_session.add_all([owner, *players])
    db_session.flush()
    court = courts.create_court(
        db_session,
        owner,
        {
            "name": "Open Play test court",
            "sport": "badminton",
            "address": "Local test address",
            "area": "Local test area",
            "base_price_vnd": 100_000,
            "max_players": 8,
        },
    )
    courts.replace_hours(
        db_session,
        owner,
        court.id,
        [
            {"weekday": day, "opens_minute": 0, "closes_minute": 1440}
            for day in range(7)
        ],
        clock=fixed_clock,
    )
    slots = [
        courts.publish_slot(
            db_session,
            owner,
            court.id,
            {
                "start_at": START + timedelta(hours=index),
                "end_at": START + timedelta(hours=index + 1),
                "price_vnd": price,
            },
            clock=fixed_clock,
        )
        for index, price in enumerate([100_000, 140_000])
    ]
    ids = [slot.id for slot in slots]
    review = bookings.review_booking(db_session, players[0], ids, fixed_clock)
    booking = bookings.confirm_booking(
        db_session, players[0], ids, review["quote"], fixed_clock
    )
    return SimpleNamespace(
        session=db_session,
        owner=owner,
        players=players,
        court=court,
        slots=slots,
        booking=db_session.get(Booking, booking["id"]),
    )


def create(data, capacity=4):
    return rooms.create_room(
        data.session, data.players[0], data.booking.id, capacity, fixed_clock
    )


def count(session, model):
    return session.scalar(select(func.count()).select_from(model))


@pytest.mark.parametrize("capacity", [2, 16])
def test_capacity_boundaries_count_organizer_and_inherit_whole_booking(
    room_data, capacity
):
    d = room_data
    room = create(d, capacity)
    assert room["booking_id"] == d.booking.id
    assert room["organizer_id"] == d.players[0].id
    assert room["court_id"] == d.court.id
    assert (room["start_at"], room["end_at"]) == (START, START + timedelta(hours=2))
    assert room["member_count"] == 1
    assert room["remaining_places"] == capacity - 1
    assert room["status"] == "OPEN"
    assert room["estimated_share_vnd"] == 240_000
    assert room["estimate_status"] == "available"
    assert count(d.session, Room) == count(d.session, RoomMember) == 1


@pytest.mark.parametrize("capacity", [1, 17, 61, 2.5, True, "2"])
def test_invalid_capacity_creates_no_room_or_member(room_data, capacity):
    d = room_data
    with pytest.raises(HTTPException) as error:
        create(d, capacity)
    assert error.value.status_code == 422
    assert count(d.session, Room) == count(d.session, RoomMember) == 0


def test_only_source_booking_player_can_create(room_data):
    d = room_data
    for user in (d.owner, d.players[1]):
        with pytest.raises(HTTPException) as error:
            rooms.create_room(d.session, user, d.booking.id, 2, fixed_clock)
        assert error.value.status_code == 403
    assert count(d.session, Room) == 0


@pytest.mark.parametrize("mode", ["cancelled", "at-start", "after-start"])
def test_cancelled_or_started_booking_cannot_create_room(room_data, mode):
    d = room_data
    clock = fixed_clock
    if mode == "cancelled":
        bookings.cancel_booking(d.session, d.players[0], d.booking.id, fixed_clock)
    else:

        def clock(_session):
            return START + (
                timedelta(microseconds=1) if mode == "after-start" else timedelta()
            )

    with pytest.raises(HTTPException) as error:
        rooms.create_room(d.session, d.players[0], d.booking.id, 2, clock)
    assert error.value.status_code == 409
    assert count(d.session, Room) == count(d.session, RoomMember) == 0


def test_closed_historical_room_prevents_second_room_for_booking(room_data):
    d = room_data
    result = create(d)
    room = d.session.get(Room, result["id"])
    room.closed = True
    d.session.flush()
    with pytest.raises(HTTPException) as error:
        create(d)
    assert error.value.detail["code"] == "ROOM_ALREADY_EXISTS"
    assert count(d.session, Room) == 1


def test_court_deactivation_preserves_existing_booking_room_eligibility(room_data):
    d = room_data
    courts.update_court(
        d.session, d.owner, d.court.id, {"active": False}, clock=fixed_clock
    )
    room = create(d, 2)
    assert (
        rooms.join_room(d.session, d.players[1], room["id"], fixed_clock)["status"]
        == "FULL"
    )
    assert d.booking.status == "CONFIRMED"


def test_full_leave_open_duplicate_and_organizer_rules(room_data):
    d = room_data
    room = create(d, 4)
    for player in d.players[1:]:
        result = rooms.join_room(d.session, player, room["id"], fixed_clock)
    assert result["status"] == "FULL"
    assert result["member_count"] == 4 and result["remaining_places"] == 0
    assert result["estimated_share_vnd"] == 60_000
    with pytest.raises(HTTPException) as error:
        rooms.join_room(d.session, d.players[1], room["id"], fixed_clock)
    assert error.value.detail["code"] == "ALREADY_MEMBER"
    with pytest.raises(HTTPException) as error:
        rooms.leave_room(d.session, d.players[0], room["id"], fixed_clock)
    assert error.value.detail["code"] == "ORGANIZER_CANNOT_LEAVE"
    result = rooms.leave_room(d.session, d.players[1], room["id"], fixed_clock)
    assert result["status"] == "OPEN" and result["member_count"] == 3
    assert result["remaining_places"] == 1 and result["estimated_share_vnd"] == 80_000
    assert d.booking.status == "CONFIRMED"
    with pytest.raises(HTTPException) as error:
        rooms.leave_room(d.session, d.players[1], room["id"], fixed_clock)
    assert error.value.detail["code"] == "NOT_A_MEMBER"
    assert count(d.session, RoomMember) == 3


def test_full_room_rejects_new_member_without_exceeding_capacity(room_data):
    d = room_data
    room = create(d, 2)
    rooms.join_room(d.session, d.players[1], room["id"], fixed_clock)
    with pytest.raises(HTTPException) as error:
        rooms.join_room(d.session, d.players[2], room["id"], fixed_clock)
    assert error.value.detail["code"] == "ROOM_FULL"
    assert count(d.session, RoomMember) == 2


@pytest.mark.parametrize("offset", [timedelta(), timedelta(microseconds=1)])
def test_at_and_after_start_read_closes_irreversibly_and_join_leave_reject(
    room_data, offset
):
    d = room_data
    room = create(d, 3)
    rooms.join_room(d.session, d.players[1], room["id"], fixed_clock)

    def at_start(_session):
        return START + offset

    before = rooms.room_detail(
        d.session, room["id"], lambda _session: START - timedelta(microseconds=1)
    )
    assert before["status"] == "OPEN"
    result = rooms.room_detail(d.session, room["id"], at_start)
    assert result["status"] == "CLOSED"
    assert d.session.get(Room, room["id"]).closed is True
    assert rooms.room_detail(d.session, room["id"], fixed_clock)["status"] == "CLOSED"
    for service, player in (
        (rooms.join_room, d.players[2]),
        (rooms.leave_room, d.players[1]),
    ):
        with pytest.raises(HTTPException) as error:
            service(d.session, player, room["id"], at_start)
        assert error.value.detail["code"] == "ROOM_CLOSED"
    assert count(d.session, RoomMember) == 2


def test_cancellation_closes_linked_room_and_membership_is_retained(room_data):
    d = room_data
    room = create(d, 3)
    rooms.join_room(d.session, d.players[1], room["id"], fixed_clock)
    bookings.cancel_booking(d.session, d.players[0], d.booking.id, fixed_clock)
    assert d.session.get(Room, room["id"]).closed is True
    assert rooms.room_detail(d.session, room["id"], fixed_clock)["status"] == "CLOSED"
    for service in (rooms.join_room, rooms.leave_room):
        with pytest.raises(HTTPException) as error:
            service(d.session, d.players[1], room["id"], fixed_clock)
        assert error.value.detail["code"] == "ROOM_CLOSED"
    assert count(d.session, RoomMember) == 2


def test_owner_cannot_join_or_leave_as_player(room_data):
    d = room_data
    room = create(d)
    for service in (rooms.join_room, rooms.leave_room):
        with pytest.raises(HTTPException) as error:
            service(d.session, d.owner, room["id"], fixed_clock)
        assert error.value.status_code == 403
    assert count(d.session, RoomMember) == 1


def test_public_listing_detail_and_closed_history_do_not_disclose_private_members(
    room_data,
):
    d = room_data
    room = create(d)
    bookings.cancel_booking(d.session, d.players[0], d.booking.id, fixed_clock)
    results = rooms.list_rooms(d.session, fixed_clock)
    assert len(results) == 1 and results[0]["id"] == room["id"]
    assert results[0]["status"] == "CLOSED"
    assert (
        not {"members", "player_id", "email", "phone", "firebase_uid"}
        & results[0].keys()
    )


def test_estimate_rounds_half_up_without_floating_point_money(room_data):
    d = room_data
    snapshots = list(
        d.session.scalars(
            select(BookingSlot)
            .where(BookingSlot.booking_id == d.booking.id)
            .order_by(BookingSlot.position)
        )
    )
    snapshots[0].price_vnd = 50
    snapshots[1].price_vnd = 51
    d.booking.total_price_vnd = 101
    d.session.flush()
    room = create(d, 2)
    result = rooms.join_room(d.session, d.players[1], room["id"], fixed_clock)
    assert result["estimated_share_vnd"] == 51


@pytest.mark.parametrize(
    "mode", ["wrong-total", "missing-component", "empty", "noncontiguous"]
)
def test_invalid_price_snapshot_returns_estimate_unavailable(room_data, mode):
    d = room_data
    room = create(d)
    if mode == "wrong-total":
        d.booking.total_price_vnd = 1
    elif mode == "noncontiguous":
        snapshot = d.session.get(BookingSlot, (d.booking.id, d.slots[1].id))
        snapshot.start_at += timedelta(minutes=30)
    else:
        # Remove only own test snapshots/claims to simulate incomplete legacy data.
        from app.db.models import SlotClaim

        d.session.execute(delete(SlotClaim).where(SlotClaim.booking_id == d.booking.id))
        query = delete(BookingSlot).where(BookingSlot.booking_id == d.booking.id)
        if mode == "missing-component":
            query = query.where(BookingSlot.position == 1)
        d.session.execute(query)
    d.session.flush()
    result = rooms.room_detail(d.session, room["id"], fixed_clock)
    assert result["estimated_share_vnd"] is None
    assert result["estimate_status"] == "unavailable"


@pytest.mark.parametrize("capacity", [1, 61, 2.5, True, "2"])
def test_capacity_schema_rejects_noninteger_or_out_of_range(capacity):
    with pytest.raises(ValidationError):
        RoomCreation(capacity=capacity)


def test_room_schema_rejects_role_organizer_or_interval_injection():
    for extra in (
        {"role": "owner"},
        {"organizer_id": str(uuid.uuid4())},
        {"start_at": START.isoformat()},
    ):
        with pytest.raises(ValidationError):
            RoomCreation.model_validate({"capacity": 2, **extra})
