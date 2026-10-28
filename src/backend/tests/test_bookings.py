"""Real PostgreSQL booking transactions; production verification is unchanged."""

import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.bookings import Confirmation, Selection
from app.db.models import Booking, BookingSlot, SlotClaim, User
from app.services import bookings, courts

NOW = datetime(2035, 1, 1, tzinfo=UTC)
START = NOW + timedelta(days=1, hours=3)


def fixed_clock(_session: Session) -> datetime:
    return NOW


@pytest.fixture
def booking_data(db_session):
    users = [
        User(firebase_uid=f"booking-{uuid.uuid4().hex}", role=role)
        for role in ("owner", "owner", "player", "player")
    ]
    db_session.add_all(users)
    db_session.flush()
    owner, other_owner, player, other_player = users
    values = {
        "name": "Booking integration court",
        "sport": "badminton",
        "address": "Local test address",
        "area": "Local test area",
        "description": "Isolated rollback-only fixture",
        "contact": "Venue public contact",
        "photo_urls": [],
        "base_price_vnd": 100_000,
        "max_players": 8,
    }
    court = courts.create_court(db_session, owner, values)
    other_court = courts.create_court(db_session, other_owner, values)
    hours = [
        {"weekday": day, "opens_minute": 0, "closes_minute": 1440} for day in range(7)
    ]
    for resource, user in ((court, owner), (other_court, other_owner)):
        courts.replace_hours(db_session, user, resource.id, hours, clock=fixed_clock)
    return SimpleNamespace(
        session=db_session,
        owner=owner,
        other_owner=other_owner,
        player=player,
        other_player=other_player,
        court=court,
        other_court=other_court,
    )


def publish(data, start=START, minutes=60, price=100_000, other=False):
    return courts.publish_slot(
        data.session,
        data.other_owner if other else data.owner,
        data.other_court.id if other else data.court.id,
        {
            "start_at": start,
            "end_at": start + timedelta(minutes=minutes),
            "price_vnd": price,
        },
        clock=fixed_clock,
    )


def confirm(data, slots, player=None):
    user = player or data.player
    ids = [slot.id for slot in slots]
    review = bookings.review_booking(data.session, user, ids, fixed_clock)
    return bookings.confirm_booking(
        data.session, user, ids, review["quote"], fixed_clock
    )


def count(session, model):
    return session.scalar(select(func.count()).select_from(model))


def test_owner_publish_review_confirm_history_and_whole_cancel(booking_data):
    d = booking_data
    first = publish(d, price=100_000)
    second = publish(d, START + timedelta(hours=1), price=120_000)
    ids = [second.id, first.id]
    review = bookings.review_booking(d.session, d.player, ids, fixed_clock)
    assert review["slot_ids"] == [first.id, second.id]
    assert review["duration_minutes"] == 120
    assert review["total_price_vnd"] == 220_000
    assert count(d.session, Booking) == count(d.session, SlotClaim) == 0
    booking = bookings.confirm_booking(
        d.session, d.player, ids, review["quote"], fixed_clock
    )
    assert booking["status"] == "CONFIRMED"
    assert booking["total_price_vnd"] == 220_000
    assert [row["slot_id"] for row in booking["slots"]] == [first.id, second.id]
    assert count(d.session, Booking) == 1
    assert count(d.session, BookingSlot) == count(d.session, SlotClaim) == 2
    assert (
        bookings.player_booking(d.session, d.player, booking["id"], fixed_clock)["id"]
        == booking["id"]
    )
    assert [
        row["id"] for row in bookings.player_bookings(d.session, d.player, fixed_clock)
    ] == [booking["id"]]
    view = courts.availability(
        d.session, d.court.id, first.playing_date, clock=fixed_clock
    )
    assert [slot["status"] for slot in view["slots"]] == ["BOOKED", "BOOKED"]
    result = bookings.cancel_booking(d.session, d.player, booking["id"], fixed_clock)
    assert result["status"] == "CANCELLED" and not result["can_cancel"]
    assert result["total_price_vnd"] == 220_000
    assert count(d.session, SlotClaim) == 0
    assert count(d.session, BookingSlot) == 2
    view = courts.availability(
        d.session, d.court.id, first.playing_date, clock=fixed_clock
    )
    assert [slot["status"] for slot in view["slots"]] == ["AVAILABLE", "AVAILABLE"]


@pytest.mark.parametrize("minutes", [60, 240])
def test_single_slot_duration_boundaries(booking_data, minutes):
    d = booking_data
    slot = publish(d, minutes=minutes)
    booking = confirm(d, [slot])
    assert booking["end_at"] - booking["start_at"] == timedelta(minutes=minutes)
    assert len(booking["slots"]) == 1


def test_four_consecutive_slots_form_one_240_minute_booking(booking_data):
    d = booking_data
    slots = [publish(d, START + timedelta(hours=index)) for index in range(4)]
    result = confirm(d, list(reversed(slots)))
    assert result["end_at"] - result["start_at"] == timedelta(hours=4)
    assert len(result["slots"]) == 4
    assert count(d.session, Booking) == 1


@pytest.mark.parametrize("mode", ["gap", "cross-court", "cross-date", "too-long"])
def test_incompatible_selection_reserves_nothing(booking_data, mode):
    d = booking_data
    first = publish(d)
    if mode == "gap":
        second = publish(d, START + timedelta(hours=2))
    elif mode == "cross-court":
        second = publish(d, START + timedelta(hours=1), other=True)
    elif mode == "cross-date":
        second = publish(d, START + timedelta(days=1))
    else:
        second = publish(d, START + timedelta(hours=1), minutes=240)
    with pytest.raises(HTTPException):
        bookings.review_booking(d.session, d.player, [first.id, second.id], fixed_clock)
    assert count(d.session, Booking) == count(d.session, SlotClaim) == 0


@pytest.mark.parametrize(
    "mode",
    ["blocked", "unpublished", "past", "maintenance", "inactive", "outside-hours"],
)
def test_unavailable_slots_never_create_booking(booking_data, mode):
    d = booking_data
    slot = publish(d)
    clock = fixed_clock
    if mode in {"blocked", "unpublished"}:
        values = {"blocked": True} if mode == "blocked" else {"published": False}
        courts.update_slot(d.session, d.owner, slot.id, values, clock=fixed_clock)
    elif mode == "maintenance":
        courts.add_maintenance(
            d.session,
            d.owner,
            d.court.id,
            {"start_at": slot.start_at, "end_at": slot.end_at},
            clock=fixed_clock,
        )
    elif mode == "inactive":
        courts.update_court(
            d.session, d.owner, d.court.id, {"active": False}, clock=fixed_clock
        )
    elif mode == "outside-hours":
        # This simulates a stale persisted schedule, not an Owner API bypass.
        from app.db.models import OperatingHours

        window = d.session.get(
            OperatingHours, (d.court.id, slot.playing_date.weekday())
        )
        window.closes_minute = 60
        d.session.flush()
    else:

        def clock(_session):
            return slot.start_at

    with pytest.raises(HTTPException) as error:
        bookings.confirm_booking(d.session, d.player, [slot.id], "0" * 64, clock)
    assert error.value.status_code == 409
    assert count(d.session, Booking) == count(d.session, SlotClaim) == 0


def test_quote_change_rejects_every_slot_and_returns_fresh_review(booking_data):
    d = booking_data
    slots = [publish(d), publish(d, START + timedelta(hours=1), price=120_000)]
    ids = [slot.id for slot in slots]
    before = bookings.review_booking(d.session, d.player, ids, fixed_clock)
    courts.update_slot(
        d.session, d.owner, slots[1].id, {"price_vnd": 130_000}, clock=fixed_clock
    )
    with pytest.raises(HTTPException) as error:
        bookings.confirm_booking(d.session, d.player, ids, before["quote"], fixed_clock)
    assert error.value.status_code == 409
    assert error.value.detail["code"] == "QUOTE_CHANGED"
    assert error.value.detail["review"]["total_price_vnd"] == 230_000
    assert count(d.session, Booking) == count(d.session, SlotClaim) == 0
    current = bookings.review_booking(d.session, d.player, ids, fixed_clock)
    assert (
        bookings.confirm_booking(
            d.session, d.player, ids, current["quote"], fixed_clock
        )["total_price_vnd"]
        == 230_000
    )


def test_quote_is_bound_to_player_and_server_computed_values(booking_data):
    d = booking_data
    slot = publish(d)
    quote = bookings.review_booking(d.session, d.player, [slot.id], fixed_clock)[
        "quote"
    ]
    with pytest.raises(HTTPException, match="409"):
        bookings.confirm_booking(
            d.session, d.other_player, [slot.id], quote, fixed_clock
        )
    assert count(d.session, Booking) == 0
    assert confirm(d, [slot])["total_price_vnd"] == 100_000


def test_middle_slot_conflict_rejects_whole_selection_and_keeps_winner(booking_data):
    d = booking_data
    slots = [publish(d, START + timedelta(hours=index)) for index in range(3)]
    review = bookings.review_booking(
        d.session, d.player, [slot.id for slot in slots], fixed_clock
    )
    winner = confirm(d, [slots[1]], d.other_player)
    with pytest.raises(HTTPException) as error:
        bookings.confirm_booking(
            d.session,
            d.player,
            [slot.id for slot in slots],
            review["quote"],
            fixed_clock,
        )
    assert error.value.status_code == 409
    assert count(d.session, Booking) == 1
    claims = list(d.session.scalars(select(SlotClaim)))
    assert len(claims) == 1 and claims[0].slot_id == slots[1].id
    assert claims[0].booking_id == winner["id"]
    assert bookings.player_bookings(d.session, d.player, fixed_clock) == []


@pytest.mark.parametrize(
    "offset,allowed",
    [
        (timedelta(hours=6), True),
        (timedelta(hours=6) - timedelta(microseconds=1), False),
        (timedelta(), False),
    ],
)
def test_cancellation_boundary_uses_clock_after_lock(booking_data, offset, allowed):
    d = booking_data
    slot = publish(d)
    booking = confirm(d, [slot])
    now = slot.start_at - offset

    def clock(_session):
        return now

    if allowed:
        assert (
            bookings.cancel_booking(d.session, d.player, booking["id"], clock)["status"]
            == "CANCELLED"
        )
        assert count(d.session, SlotClaim) == 0
    else:
        with pytest.raises(HTTPException) as error:
            bookings.cancel_booking(d.session, d.player, booking["id"], clock)
        assert error.value.status_code == 409
        assert count(d.session, SlotClaim) == 1
        assert d.session.get(Booking, booking["id"]).status == "CONFIRMED"


def test_cancel_repeat_foreign_owner_and_rebook_preserve_history(booking_data):
    d = booking_data
    slot = publish(d)
    original = confirm(d, [slot])
    for function in (bookings.player_booking, bookings.cancel_booking):
        with pytest.raises(HTTPException) as error:
            function(d.session, d.other_player, original["id"], fixed_clock)
        assert error.value.status_code == 403
    bookings.cancel_booking(d.session, d.player, original["id"], fixed_clock)
    with pytest.raises(HTTPException) as error:
        bookings.cancel_booking(d.session, d.player, original["id"], fixed_clock)
    assert error.value.detail["code"] == "BOOKING_ALREADY_CANCELLED"
    replacement = confirm(d, [slot], d.other_player)
    assert replacement["id"] != original["id"]
    assert count(d.session, Booking) == count(d.session, BookingSlot) == 2
    assert count(d.session, SlotClaim) == 1
    assert (
        bookings.player_booking(d.session, d.player, original["id"], fixed_clock)[
            "total_price_vnd"
        ]
        == 100_000
    )


def test_cancelled_booking_confirmation_retry_requires_new_review(booking_data):
    d = booking_data
    slot = publish(d)
    old_review = bookings.review_booking(d.session, d.player, [slot.id], fixed_clock)
    original = bookings.confirm_booking(
        d.session, d.player, [slot.id], old_review["quote"], fixed_clock
    )
    bookings.cancel_booking(d.session, d.player, original["id"], fixed_clock)
    version = d.court.version
    with pytest.raises(HTTPException) as error:
        bookings.confirm_booking(
            d.session, d.player, [slot.id], old_review["quote"], fixed_clock
        )
    assert error.value.status_code == 409
    assert error.value.detail["code"] == "QUOTE_CHANGED"
    assert count(d.session, Booking) == count(d.session, BookingSlot) == 1
    assert count(d.session, SlotClaim) == 0
    assert d.court.version == version
    fresh = confirm(d, [slot])
    assert fresh["id"] != original["id"]
    assert count(d.session, Booking) == 2
    assert count(d.session, SlotClaim) == 1


def test_history_is_ten_newest_and_only_current_players_bookings(booking_data):
    d = booking_data
    records = []
    for index in range(12):
        slot = publish(d, START + timedelta(days=index))
        booking = confirm(d, [slot])
        d.session.get(Booking, booking["id"]).created_at = NOW + timedelta(
            seconds=index
        )
        records.append(booking["id"])
    d.session.flush()
    assert [
        row["id"] for row in bookings.player_bookings(d.session, d.player, fixed_clock)
    ] == list(reversed(records[-10:]))
    assert bookings.player_bookings(d.session, d.other_player, fixed_clock) == []


def test_owner_views_are_scoped_and_do_not_expose_unapproved_identity(booking_data):
    d = booking_data
    booking = confirm(d, [publish(d)])
    view = bookings.owner_booking(d.session, d.owner, booking["id"], fixed_clock)
    assert view["id"] == booking["id"] and "player_id" not in view
    assert not {"firebase_uid", "email", "phone", "can_cancel"} & view.keys()
    assert len(bookings.owner_bookings(d.session, d.owner, fixed_clock)) == 1
    assert bookings.owner_bookings(d.session, d.other_owner, fixed_clock) == []
    with pytest.raises(HTTPException) as error:
        bookings.owner_booking(d.session, d.other_owner, booking["id"], fixed_clock)
    assert error.value.status_code == 403


def test_owner_is_not_implicitly_a_player(booking_data):
    d = booking_data
    slot = publish(d)
    with pytest.raises(HTTPException) as error:
        bookings.review_booking(d.session, d.owner, [slot.id], fixed_clock)
    assert error.value.status_code == 403
    with pytest.raises(HTTPException) as error:
        bookings.owner_bookings(d.session, d.player, fixed_clock)
    assert error.value.status_code == 403


def test_combined_price_cannot_overflow_database_integer(booking_data):
    d = booking_data
    slots = [
        publish(d, START + timedelta(hours=index), price=2**63 - 1)
        for index in range(2)
    ]
    with pytest.raises(HTTPException) as error:
        bookings.review_booking(
            d.session, d.player, [slot.id for slot in slots], fixed_clock
        )
    assert error.value.status_code == 422
    assert count(d.session, Booking) == 0


@pytest.mark.parametrize(
    "extra",
    [{"role": "owner"}, {"total_price_vnd": 1}, {"player_id": str(uuid.uuid4())}],
)
def test_client_cannot_supply_privilege_identity_or_total(extra):
    with pytest.raises(ValidationError):
        Confirmation.model_validate(
            {"slot_ids": [uuid.uuid4()], "quote": "0" * 64, **extra}
        )


@pytest.mark.parametrize(
    "ids", [[], [uuid.uuid4()] * 2, [uuid.uuid4() for _ in range(5)]]
)
def test_selection_rejects_empty_duplicate_or_excess_slots(ids):
    with pytest.raises(ValidationError):
        Selection(slot_ids=ids)
