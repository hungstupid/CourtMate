"""Room/court/cancellation cross-aggregate invariants on real PostgreSQL."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from app.db.models import Booking, BookingSlot, Court, Room, RoomMember, SlotClaim, User
from app.services import bookings, courts

NOW = datetime(2035, 1, 1, tzinfo=UTC)
START = NOW + timedelta(days=1, hours=3)


def clock(_):
    return NOW


@pytest.fixture
def linked_room(db_session):
    owner, organizer, guest = [
        User(firebase_uid="room-link-" + uuid4().hex, role=role)
        for role in ("owner", "player", "player")
    ]
    db_session.add_all([owner, organizer, guest])
    db_session.flush()
    court = courts.create_court(
        db_session,
        owner,
        {
            "name": "Room link draft court",
            "sport": "badminton",
            "address": "Test address",
            "area": "Test area",
            "description": "Rollback-only fixture",
            "contact": "Venue contact",
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
        clock=clock,
    )
    slot = courts.publish_slot(
        db_session,
        owner,
        court.id,
        {"start_at": START, "end_at": START + timedelta(hours=1), "price_vnd": 100_000},
        clock=clock,
    )
    quote = bookings.review_booking(db_session, organizer, [slot.id], clock)
    accepted = bookings.confirm_booking(
        db_session, organizer, [slot.id], quote["quote"], clock
    )
    booking = db_session.get(Booking, accepted["id"])
    room = Room(
        booking_id=booking.id,
        organizer_id=organizer.id,
        capacity=16,
        closed=False,
        created_at=NOW,
    )
    db_session.add(room)
    db_session.flush()
    db_session.add(RoomMember(room_id=room.id, player_id=organizer.id, joined_at=NOW))
    db_session.flush()
    return SimpleNamespace(
        session=db_session,
        owner=owner,
        organizer=organizer,
        guest=guest,
        court=court,
        slot=slot,
        booking=booking,
        room=room,
    )


def member_count(d):
    return d.session.scalar(
        select(func.count())
        .select_from(RoomMember)
        .where(RoomMember.room_id == d.room.id)
    )


@pytest.mark.parametrize("full", [False, True])
def test_capacity_reduction_preserves_future_open_and_full_rooms(linked_room, full):
    d = linked_room
    if full:
        players = [
            User(firebase_uid="full-room-" + uuid4().hex, role="player")
            for _ in range(15)
        ]
        d.session.add_all(players)
        d.session.flush()
        d.session.add_all(
            RoomMember(room_id=d.room.id, player_id=user.id, joined_at=NOW)
            for user in players
        )
        d.session.flush()
    count = member_count(d)
    original_version = d.court.version
    with pytest.raises(HTTPException) as error:
        courts.update_court(
            d.session,
            d.owner,
            d.court.id,
            {"max_players": 7, "name": "must not persist"},
            clock=clock,
        )
    assert error.value.status_code == 409
    assert error.value.detail["code"] == "ROOM_CAPACITY_CONFLICT"
    # A caller catching the rejection and querying again cannot autoflush edits.
    court = d.session.scalar(
        select(Court)
        .where(Court.id == d.court.id)
        .execution_options(populate_existing=True)
    )
    assert court.max_players == 8
    assert court.name == "Room link draft court"
    assert court.version == original_version
    assert d.room.capacity == 16
    assert member_count(d) == count


@pytest.mark.parametrize("lifecycle", ["closed", "cancelled", "at-start", "past"])
def test_capacity_change_allows_effectively_closed_room_and_preserves_history(
    linked_room, lifecycle
):
    d = linked_room
    now = NOW
    if lifecycle == "closed":
        d.room.closed = True
        d.session.flush()
    elif lifecycle == "cancelled":
        bookings.cancel_booking(d.session, d.organizer, d.booking.id, clock)
    else:
        now = START if lifecycle == "at-start" else START + timedelta(minutes=1)
    original_members = member_count(d)
    courts.update_court(
        d.session, d.owner, d.court.id, {"max_players": 2}, clock=lambda _: now
    )
    assert d.court.max_players == 2
    assert d.session.get(Room, d.room.id).capacity == 16
    assert member_count(d) == original_members == 1
    assert d.session.get(BookingSlot, (d.booking.id, d.slot.id)).price_vnd == 100_000


def test_noninvalidating_capacity_and_other_court_changes_remain_allowed(linked_room):
    d = linked_room
    courts.update_court(
        d.session,
        d.owner,
        d.court.id,
        {"max_players": 9, "description": "Updated venue description"},
        clock=clock,
    )
    assert d.court.max_players == 9
    assert d.room.capacity == 16
    courts.update_court(d.session, d.owner, d.court.id, {"active": False}, clock=clock)
    assert d.booking.status == "CONFIRMED"
    assert d.room.closed is False


def test_whole_booking_cancellation_closes_room_and_retains_members_and_prices(
    linked_room,
):
    d = linked_room
    d.session.add(RoomMember(room_id=d.room.id, player_id=d.guest.id, joined_at=NOW))
    d.session.flush()
    accepted_total = d.booking.total_price_vnd
    result = bookings.cancel_booking(d.session, d.organizer, d.booking.id, clock)
    assert result["status"] == "CANCELLED"
    assert d.session.get(Room, d.room.id, populate_existing=True).closed is True
    assert d.booking.cancelled_at == NOW
    assert d.booking.total_price_vnd == accepted_total == 100_000
    assert member_count(d) == 2
    assert d.session.get(SlotClaim, d.slot.id) is None
    assert d.session.get(BookingSlot, (d.booking.id, d.slot.id)).price_vnd == 100_000
    with pytest.raises(HTTPException) as error:
        bookings.cancel_booking(d.session, d.organizer, d.booking.id, clock)
    assert error.value.detail["code"] == "BOOKING_ALREADY_CANCELLED"
    assert member_count(d) == 2


@pytest.mark.parametrize("case", ["wrong-player", "below-six-hours"])
def test_failed_cancellation_leaves_room_members_and_active_claims(linked_room, case):
    d = linked_room
    actor = d.guest if case == "wrong-player" else d.organizer
    now = (
        NOW
        if case == "wrong-player"
        else START - timedelta(hours=6) + timedelta(microseconds=1)
    )
    with pytest.raises(HTTPException) as error:
        bookings.cancel_booking(d.session, actor, d.booking.id, lambda _: now)
    assert error.value.status_code == (403 if case == "wrong-player" else 409)
    assert d.booking.status == "CONFIRMED"
    assert d.room.closed is False
    assert member_count(d) == 1
    assert d.session.get(SlotClaim, d.slot.id).booking_id == d.booking.id
