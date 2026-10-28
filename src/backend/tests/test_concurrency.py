"""Committed PostgreSQL races: independent connections and observed lock waits."""

import time
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Lock
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, delete, select, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from app.db.models import (
    Base,
    Booking,
    BookingSlot,
    Court,
    MaintenanceBlock,
    OperatingHours,
    Slot,
    SlotClaim,
    User,
)
from app.db.session import connection_options
from app.services import bookings, courts

LOCAL = ZoneInfo("Asia/Ho_Chi_Minh")
NOW = datetime(2035, 1, 1, tzinfo=UTC)
START = datetime(2035, 1, 2, 8, tzinfo=LOCAL)


def fixed_clock(_session: Session) -> datetime:
    return NOW


@pytest.fixture
def race_data(database_engine):
    """Only uniquely labelled fixture rows are committed and later removed."""
    engine = create_engine(
        database_engine.url,
        poolclass=NullPool,
        hide_parameters=True,
        connect_args=connection_options(
            database_engine.url.render_as_string(hide_password=False)
        ),
    )
    marker = uuid.uuid4().hex
    user_ids = [uuid.uuid4() for _ in range(11)]
    court_id = uuid.uuid4()
    slot_ids = [uuid.uuid4() for _ in range(4)]
    with Session(engine) as session, session.begin():
        session.add_all(
            User(
                id=identity,
                firebase_uid=f"race-{marker}-{index}",
                role="owner" if index == 0 else "player",
            )
            for index, identity in enumerate(user_ids)
        )
        session.flush()
        session.add(
            Court(
                id=court_id,
                owner_id=user_ids[0],
                name=f"Concurrency {marker}",
                sport="badminton",
                address="Local test court",
                area="test",
                description="Isolated committed concurrency fixture",
                contact="Test venue",
                photo_urls=[],
                base_price_vnd=100_000,
                max_players=8,
                active=True,
                version=1,
            )
        )
        session.flush()
        session.add_all(
            OperatingHours(
                court_id=court_id,
                weekday=weekday,
                opens_minute=0,
                closes_minute=1440,
            )
            for weekday in range(7)
        )
        session.add_all(
            Slot(
                id=identity,
                court_id=court_id,
                playing_date=START.date(),
                start_at=START + timedelta(hours=index),
                end_at=START + timedelta(hours=index + 1),
                price_vnd=100_000 + index * 20_000,
                version=1,
                published=True,
                blocked=False,
            )
            for index, identity in enumerate(slot_ids)
        )
    try:
        yield {
            "engine": engine,
            "court": court_id,
            "owner": user_ids[0],
            "players": user_ids[1:],
            "slots": slot_ids,
        }
    finally:
        with Session(engine) as session, session.begin():
            booking_ids = list(
                session.scalars(select(Booking.id).where(Booking.court_id == court_id))
            )
            # The B migration adds these tables later. Never clean another room.
            room_table = Base.metadata.tables.get("rooms")
            member_table = Base.metadata.tables.get("room_members")
            if room_table is not None:
                room_ids = list(
                    session.scalars(
                        select(room_table.c.id).where(
                            room_table.c.booking_id.in_(booking_ids)
                        )
                    )
                )
                if member_table is not None:
                    session.execute(
                        delete(member_table).where(member_table.c.room_id.in_(room_ids))
                    )
                session.execute(delete(room_table).where(room_table.c.id.in_(room_ids)))
            session.execute(
                delete(SlotClaim).where(SlotClaim.booking_id.in_(booking_ids))
            )
            session.execute(
                delete(BookingSlot).where(BookingSlot.booking_id.in_(booking_ids))
            )
            session.execute(delete(Booking).where(Booking.court_id == court_id))
            session.execute(
                delete(MaintenanceBlock).where(MaintenanceBlock.court_id == court_id)
            )
            session.execute(delete(Slot).where(Slot.court_id == court_id))
            session.execute(
                delete(OperatingHours).where(OperatingHours.court_id == court_id)
            )
            session.execute(delete(Court).where(Court.id == court_id))
            session.execute(delete(User).where(User.id.in_(user_ids)))
        engine.dispose()


def contended(race_data, operations: list[Callable[[Session], object]]):
    """Hold court, observe every independent transaction blocked, then release."""
    engine = race_data["engine"]
    pids: dict[int, int] = {}
    tracking_lock = Lock()  # Coordinates test bookkeeping, never business state.

    def contender(index, operation):
        try:
            with Session(engine) as session, session.begin():
                session.execute(text("SET LOCAL lock_timeout = '15s'"))
                session.execute(text("SET LOCAL statement_timeout = '20s'"))
                pid = session.scalar(text("SELECT pg_backend_pid()"))
                with tracking_lock:
                    pids[index] = pid
                result = operation(session)
            return {"ok": True, "result": result}
        except HTTPException as error:
            return {"ok": False, "status": error.status_code, "detail": error.detail}

    blocker = engine.connect()
    transaction = blocker.begin()
    blocker.execute(
        select(Court.id).where(Court.id == race_data["court"]).with_for_update()
    )
    executor = ThreadPoolExecutor(max_workers=len(operations))
    futures = [
        executor.submit(contender, index, operation)
        for index, operation in enumerate(operations)
    ]
    try:
        deadline = time.monotonic() + 10
        observed: set[int] = set()
        with engine.connect() as observer:
            while time.monotonic() < deadline:
                with tracking_lock:
                    current = dict(pids)
                for index, pid in current.items():
                    if observer.scalar(
                        text("SELECT cardinality(pg_blocking_pids(:pid)) > 0"),
                        {"pid": pid},
                    ):
                        observed.add(index)
                if len(observed) == len(operations):
                    break
                time.sleep(0.02)
        assert len(set(pids.values())) == len(operations), "Use independent connections"
        assert len(observed) == len(operations), (
            "Every contender must really wait in PG"
        )
    finally:
        transaction.rollback()
        blocker.close()
        executor.shutdown(wait=True)
    return [future.result(timeout=1) for future in futures]


def quote_for(race_data, player_id, slot_ids):
    with Session(race_data["engine"]) as session:
        player = session.get(User, player_id)
        return bookings.review_booking(session, player, slot_ids, clock=fixed_clock)[
            "quote"
        ]


def confirm_operation(race_data, player_id, slot_ids, quote):
    def execute(session):
        return bookings.confirm_booking(
            session,
            session.get(User, player_id),
            slot_ids,
            quote,
            clock=fixed_clock,
        )

    return execute


def test_ten_real_connections_confirm_only_one_whole_overlapping_booking(race_data):
    slots = race_data["slots"]
    selections = [
        slots[:2],
        slots[1:2],
        slots[1:3],
        slots[:3],
        slots[1:],
        slots[:2],
        slots[1:2],
        slots[1:3],
        slots,
        slots[1:],
    ]
    operations = []
    for player_id, selected in zip(race_data["players"], selections, strict=True):
        quote = quote_for(race_data, player_id, selected)
        operations.append(confirm_operation(race_data, player_id, selected, quote))
    results = contended(race_data, operations)
    assert sum(result["ok"] for result in results) == 1
    assert all(result["ok"] or result["status"] == 409 for result in results)
    winner = next(index for index, result in enumerate(results) if result["ok"])
    with Session(race_data["engine"]) as session:
        stored = list(
            session.scalars(
                select(Booking).where(Booking.court_id == race_data["court"])
            )
        )
        assert len(stored) == 1
        assert stored[0].status == "CONFIRMED"
        assert stored[0].player_id == race_data["players"][winner]
        snapshot_ids = list(
            session.scalars(
                select(BookingSlot.slot_id)
                .where(BookingSlot.booking_id == stored[0].id)
                .order_by(BookingSlot.position)
            )
        )
        assert snapshot_ids == selections[winner]
        claims = list(
            session.scalars(
                select(SlotClaim.slot_id).where(SlotClaim.booking_id == stored[0].id)
            )
        )
        assert set(claims) == set(selections[winner])
        assert stored[0].total_price_vnd == sum(
            session.scalars(
                select(BookingSlot.price_vnd).where(
                    BookingSlot.booking_id == stored[0].id
                )
            )
        )


def test_concurrent_overlapping_publications_commit_only_one_slot(race_data):
    def publish(offset):
        def execute(session):
            start = START + timedelta(hours=6, minutes=offset)
            return courts.publish_slot(
                session,
                session.get(User, race_data["owner"]),
                race_data["court"],
                {
                    "start_at": start,
                    "end_at": start + timedelta(hours=1),
                    "price_vnd": 90_000,
                },
                clock=fixed_clock,
            )

        return execute

    results = contended(race_data, [publish(0), publish(30)])
    assert sum(result["ok"] for result in results) == 1
    assert all(result["ok"] or result["status"] == 409 for result in results)
    with Session(race_data["engine"]) as session:
        slots = list(
            session.scalars(
                select(Slot)
                .where(Slot.court_id == race_data["court"], Slot.published)
                .order_by(Slot.start_at)
            )
        )
        assert len(slots) == 5
        assert all(
            a.end_at <= b.start_at for a, b in zip(slots, slots[1:], strict=False)
        )


def test_concurrent_slot_edits_cannot_publish_overlapping_intervals(race_data):
    def edit(index, offset):
        def execute(session):
            start = START + timedelta(hours=6, minutes=offset)
            return courts.update_slot(
                session,
                session.get(User, race_data["owner"]),
                race_data["slots"][index],
                {"start_at": start, "end_at": start + timedelta(hours=1)},
                clock=fixed_clock,
            )

        return execute

    results = contended(race_data, [edit(0, 0), edit(1, 30)])
    assert sum(result["ok"] for result in results) == 1
    with Session(race_data["engine"]) as session:
        slots = list(
            session.scalars(
                select(Slot)
                .where(Slot.court_id == race_data["court"], Slot.published)
                .order_by(Slot.start_at)
            )
        )
        assert len(slots) == 4
        assert all(
            a.end_at <= b.start_at for a, b in zip(slots, slots[1:], strict=False)
        )


@pytest.mark.parametrize("change", ["price", "hours", "maintenance"])
def test_owner_changes_and_confirmation_share_one_court_transaction_lock(
    race_data, change
):
    selected = race_data["slots"][:2]
    player_id = race_data["players"][0]
    quote = quote_for(race_data, player_id, selected)

    def owner_change(session):
        owner = session.get(User, race_data["owner"])
        if change == "price":
            return courts.update_slot(
                session, owner, selected[0], {"price_vnd": 200_000}, clock=fixed_clock
            )
        if change == "maintenance":
            return courts.add_maintenance(
                session,
                owner,
                race_data["court"],
                {"start_at": START, "end_at": START + timedelta(hours=1)},
                clock=fixed_clock,
            )
        return courts.replace_hours(
            session,
            owner,
            race_data["court"],
            [
                {
                    "weekday": START.weekday(),
                    "opens_minute": 9 * 60,
                    "closes_minute": 24 * 60,
                }
            ],
            clock=fixed_clock,
        )

    results = contended(
        race_data,
        [confirm_operation(race_data, player_id, selected, quote), owner_change],
    )
    assert any(result["ok"] for result in results)
    assert all(result["ok"] or result["status"] == 409 for result in results)
    with Session(race_data["engine"]) as session:
        stored = list(
            session.scalars(
                select(Booking).where(Booking.court_id == race_data["court"])
            )
        )
        assert len(stored) <= 1
        claims = list(
            session.scalars(
                select(SlotClaim.slot_id).where(SlotClaim.slot_id.in_(selected))
            )
        )
        if stored:
            assert stored[0].total_price_vnd == 220_000
            assert set(claims) == set(selected)
            assert not session.scalar(
                select(MaintenanceBlock.id).where(
                    MaintenanceBlock.court_id == race_data["court"],
                    MaintenanceBlock.start_at < stored[0].end_at,
                    MaintenanceBlock.end_at > stored[0].start_at,
                )
            )
            from app.services.common import in_hours

            assert in_hours(
                session,
                session.get(Court, race_data["court"]),
                stored[0].start_at,
                stored[0].end_at,
            )
        else:
            assert claims == []
