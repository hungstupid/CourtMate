"""Open Play integrity under real, observed PostgreSQL row-lock contention."""

import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC
from threading import Event

import pytest
import test_concurrency as races
from fastapi import HTTPException
from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.db.models import Booking, Court, Room, RoomMember, User
from app.services import bookings, courts, rooms

# Reuse the committed, uniquely labelled fixture and its targeted cleanup.
race_data = races.race_data


def confirmed_booking(race_data):
    player_id = race_data["players"][0]
    selected = race_data["slots"][:2]
    quote = races.quote_for(race_data, player_id, selected)
    with Session(race_data["engine"]) as session, session.begin():
        return bookings.confirm_booking(
            session,
            session.get(User, player_id),
            selected,
            quote,
            clock=races.fixed_clock,
        )["id"]


def created_room(race_data, booking_id, capacity=2):
    with Session(race_data["engine"]) as session, session.begin():
        return rooms.create_room(
            session,
            session.get(User, race_data["players"][0]),
            booking_id,
            capacity,
            clock=races.fixed_clock,
        )["id"]


def create_operation(race_data, booking_id, capacity=2):
    def create(session):
        return rooms.create_room(
            session,
            session.get(User, race_data["players"][0]),
            booking_id,
            capacity,
            clock=races.fixed_clock,
        )

    return create


def join_operation(race_data, room_id, player_id):
    def join(session):
        return rooms.join_room(
            session, session.get(User, player_id), room_id, clock=races.fixed_clock
        )

    return join


def test_two_creates_for_one_booking_commit_only_one_room(race_data):
    booking_id = confirmed_booking(race_data)
    results = races.contended(
        race_data,
        [
            create_operation(race_data, booking_id),
            create_operation(race_data, booking_id),
        ],
    )
    assert sum(result["ok"] for result in results) == 1
    assert all(result["ok"] or result["status"] == 409 for result in results)
    with Session(race_data["engine"]) as session:
        stored = list(
            session.scalars(select(Room).where(Room.booking_id == booking_id))
        )
        assert len(stored) == 1
        members = list(
            session.scalars(
                select(RoomMember.player_id).where(RoomMember.room_id == stored[0].id)
            )
        )
        assert members == [race_data["players"][0]]


def test_two_distinct_players_contend_for_last_place(race_data):
    room_id = created_room(race_data, confirmed_booking(race_data), capacity=2)
    candidates = race_data["players"][1:3]
    results = races.contended(
        race_data, [join_operation(race_data, room_id, player) for player in candidates]
    )
    assert sum(result["ok"] for result in results) == 1
    assert all(result["ok"] or result["status"] == 409 for result in results)
    with Session(race_data["engine"]) as session:
        members = set(
            session.scalars(
                select(RoomMember.player_id).where(RoomMember.room_id == room_id)
            )
        )
        assert len(members) == 2
        assert race_data["players"][0] in members
        assert len(members & set(candidates)) == 1
        state = rooms.room_detail(session, room_id, clock=races.fixed_clock)
        assert state["status"] == "FULL"
        assert state["remaining_places"] == 0


def test_duplicate_concurrent_join_cannot_create_duplicate_membership(race_data):
    room_id = created_room(race_data, confirmed_booking(race_data), capacity=3)
    player = race_data["players"][1]
    results = races.contended(
        race_data,
        [
            join_operation(race_data, room_id, player),
            join_operation(race_data, room_id, player),
        ],
    )
    assert sum(result["ok"] for result in results) == 1
    assert all(result["ok"] or result["status"] == 409 for result in results)
    with Session(race_data["engine"]) as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(RoomMember)
                .where(RoomMember.room_id == room_id, RoomMember.player_id == player)
            )
            == 1
        )
        assert (
            session.scalar(
                select(func.count())
                .select_from(RoomMember)
                .where(RoomMember.room_id == room_id)
            )
            == 2
        )


def test_capacity_sixteen_last_place_with_distinct_and_duplicate_requests(race_data):
    """SRS NFR-03 integrity scenario: max_players 8, C=16, mixed retries."""
    room_id = created_room(race_data, confirmed_booking(race_data), capacity=16)
    extra_ids = [uuid.uuid4() for _ in range(8)]
    marker = uuid.uuid4().hex
    try:
        with Session(race_data["engine"]) as session, session.begin():
            session.add_all(
                User(
                    id=identity,
                    firebase_uid=f"room-race-{marker}-{index}",
                    role="player",
                )
                for index, identity in enumerate(extra_ids)
            )
            session.flush()
            initial_members = race_data["players"][1:] + extra_ids[:5]
            assert len(initial_members) == 14  # Organizer is already present.
            session.add_all(
                RoomMember(room_id=room_id, player_id=identity, joined_at=races.NOW)
                for identity in initial_members
            )
        candidates = extra_ids[5:]
        results = races.contended(
            race_data,
            [
                join_operation(race_data, room_id, identity)
                for identity in [*candidates, candidates[0], candidates[1]]
            ],
        )
        assert sum(result["ok"] for result in results) == 1
        assert all(result["ok"] or result["status"] == 409 for result in results)
        with Session(race_data["engine"]) as session:
            members = list(
                session.scalars(
                    select(RoomMember.player_id).where(RoomMember.room_id == room_id)
                )
            )
            assert len(members) == len(set(members)) == 16
            assert len(set(members) & set(candidates)) == 1
            state = rooms.room_detail(session, room_id, clock=races.fixed_clock)
            assert state["status"] == "FULL"
    finally:
        with Session(race_data["engine"]) as session, session.begin():
            session.execute(
                delete(RoomMember).where(
                    RoomMember.room_id == room_id, RoomMember.player_id.in_(extra_ids)
                )
            )
            session.execute(delete(User).where(User.id.in_(extra_ids)))


def test_join_and_cancellation_are_serialized_and_end_closed(race_data):
    booking_id = confirmed_booking(race_data)
    room_id = created_room(race_data, booking_id, capacity=2)
    joining_player = race_data["players"][1]

    def cancel(session):
        return bookings.cancel_booking(
            session,
            session.get(User, race_data["players"][0]),
            booking_id,
            clock=races.fixed_clock,
        )

    results = races.contended(
        race_data, [join_operation(race_data, room_id, joining_player), cancel]
    )
    assert results[1]["ok"] is True
    assert results[0]["ok"] or results[0]["status"] == 409
    with Session(race_data["engine"]) as session:
        assert session.get(Booking, booking_id).status == "CANCELLED"
        assert session.get(Room, room_id).closed is True
        state = rooms.room_detail(session, room_id, clock=races.fixed_clock)
        assert state["status"] == "CLOSED"
        joined = session.get(RoomMember, (room_id, joining_player)) is not None
        # A join may precede cancellation; a transaction ordered after it cannot join.
        assert joined == results[0]["ok"]


def test_join_rechecks_backend_clock_after_waiting_for_court_lock(race_data):
    room_id = created_room(race_data, confirmed_booking(race_data), capacity=2)
    engine = race_data["engine"]
    player_id = race_data["players"][1]
    known_pid: dict[str, int] = {}
    started = Event()
    clock_called = Event()
    clock_value = {"now": races.NOW}

    def controlled_clock(_session):
        clock_called.set()
        return clock_value["now"]

    def contender():
        try:
            with Session(engine) as session, session.begin():
                session.execute(text("SET LOCAL lock_timeout = '15s'"))
                known_pid["value"] = session.scalar(text("SELECT pg_backend_pid()"))
                started.set()
                rooms.join_room(
                    session,
                    session.get(User, player_id),
                    room_id,
                    clock=controlled_clock,
                )
            return 200
        except HTTPException as error:
            return error.status_code

    blocker = engine.connect()
    transaction = blocker.begin()
    blocker.execute(
        select(Court.id).where(Court.id == race_data["court"]).with_for_update()
    )
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(contender)
    try:
        assert started.wait(timeout=5)
        deadline = time.monotonic() + 5
        blocked = False
        with engine.connect() as observer:
            while time.monotonic() < deadline:
                blocked = bool(
                    observer.scalar(
                        text("SELECT cardinality(pg_blocking_pids(:pid)) > 0"),
                        {"pid": known_pid["value"]},
                    )
                )
                if blocked:
                    break
                time.sleep(0.02)
        assert blocked, "The joining transaction must actually wait in PostgreSQL"
        assert not clock_called.is_set(), "Eligibility time must be read after the lock"
        clock_value["now"] = races.START.astimezone(UTC)
    finally:
        transaction.rollback()
        blocker.close()
        executor.shutdown(wait=True)
    assert future.result(timeout=1) == 409
    assert clock_called.is_set()
    with Session(engine) as session:
        assert session.get(RoomMember, (room_id, player_id)) is None
        state = rooms.room_detail(
            session, room_id, clock=lambda _: races.START.astimezone(UTC)
        )
        assert state["status"] == "CLOSED"
        assert state["member_count"] == 1


def test_join_waiting_behind_cancellation_cannot_commit_membership(race_data):
    booking_id = confirmed_booking(race_data)
    room_id = created_room(race_data, booking_id, capacity=2)
    engine = race_data["engine"]
    player_id = race_data["players"][1]
    started = Event()
    known_pid: dict[str, int] = {}

    def join():
        try:
            with Session(engine) as session, session.begin():
                session.execute(text("SET LOCAL lock_timeout = '15s'"))
                known_pid["value"] = session.scalar(text("SELECT pg_backend_pid()"))
                started.set()
                rooms.join_room(
                    session,
                    session.get(User, player_id),
                    room_id,
                    clock=races.fixed_clock,
                )
            return 200
        except HTTPException as error:
            return error.status_code

    cancelling = Session(engine)
    transaction = cancelling.begin()
    bookings.cancel_booking(
        cancelling,
        cancelling.get(User, race_data["players"][0]),
        booking_id,
        clock=races.fixed_clock,
    )
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(join)
    try:
        assert started.wait(timeout=5)
        deadline = time.monotonic() + 5
        blocked = False
        with engine.connect() as observer:
            while time.monotonic() < deadline:
                blocked = bool(
                    observer.scalar(
                        text("SELECT cardinality(pg_blocking_pids(:pid)) > 0"),
                        {"pid": known_pid["value"]},
                    )
                )
                if blocked:
                    break
                time.sleep(0.02)
        assert blocked, "Join must overlap and wait for the uncommitted cancellation"
        transaction.commit()
    finally:
        if transaction.is_active:
            transaction.rollback()
        cancelling.close()
        executor.shutdown(wait=True)
    assert future.result(timeout=1) == 409
    with Session(engine) as session:
        assert session.get(RoomMember, (room_id, player_id)) is None
        assert session.get(Room, room_id).closed is True
        assert session.get(Booking, booking_id).status == "CANCELLED"


@pytest.mark.parametrize("existing_room", [False, True])
def test_capacity_edit_contends_with_room_creation_or_join(race_data, existing_room):
    booking_id = confirmed_booking(race_data)
    room_id = (
        created_room(race_data, booking_id, capacity=16) if existing_room else None
    )

    def reduce_capacity(session):
        return courts.update_court(
            session,
            session.get(User, race_data["owner"]),
            race_data["court"],
            {"max_players": 7},
            clock=races.fixed_clock,
        )

    other = (
        join_operation(race_data, room_id, race_data["players"][1])
        if existing_room
        else create_operation(race_data, booking_id, capacity=16)
    )
    results = races.contended(race_data, [reduce_capacity, other])
    assert all(result["ok"] or result["status"] in {409, 422} for result in results)
    with Session(race_data["engine"]) as session:
        court = session.get(Court, race_data["court"])
        linked = session.scalar(select(Room).where(Room.booking_id == booking_id))
        if existing_room:
            assert results[0]["ok"] is False
            assert results[1]["ok"] is True
            assert court.max_players == 8
            assert linked.capacity == 16
            assert (
                rooms.room_detail(session, linked.id, clock=races.fixed_clock)[
                    "member_count"
                ]
                == 2
            )
        else:
            assert sum(result["ok"] for result in results) == 1
            assert (court.max_players == 7 and linked is None) or (
                court.max_players == 8 and linked is not None and linked.capacity == 16
            )
        if linked is not None:
            assert linked.capacity <= 2 * court.max_players
