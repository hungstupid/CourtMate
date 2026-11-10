"""Current SRS F09: effective clock, accepted quote protection and lock races."""

from datetime import timedelta
from decimal import Decimal

import pytest
import test_concurrency as races
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Booking, Slot, SlotOffer, User
from app.services import bookings, courts, offers

race_data = races.race_data


def configure(data, *, mode="automatic", lead=Decimal(3), now=None, index=0):
    with Session(data["engine"]) as session, session.begin():
        owner = session.get(User, data["owner"])
        return offers.create_offer(
            session,
            owner,
            data["slots"][index],
            mode,
            80_000,
            lead,
            lambda s: now or races.NOW,
        )


def test_automatic_window_fraction_equality_and_stale_review(race_data):
    data = race_data
    with Session(data["engine"]) as session:
        start = session.get(Slot, data["slots"][0]).start_at
    scheduled = configure(data, lead=Decimal("0.5"))
    assert scheduled["status"] == "SCHEDULED" and not scheduled["eligible"]
    assert scheduled["applies_at"] == start - timedelta(minutes=30)
    selected = data["slots"][:2]

    def review(now):
        with Session(data["engine"]) as session, session.begin():
            return bookings.review_booking(
                session, session.get(User, data["players"][0]), selected, lambda s: now
            )

    old = review(start - timedelta(minutes=30, microseconds=1))
    assert old["slots"][0]["price_vnd"] == 100_000
    active = review(start - timedelta(minutes=30))
    assert (
        active["slots"][0]["price_vnd"] == 80_000
        and active["slots"][1]["price_vnd"] == 120_000
    )
    with Session(data["engine"]) as session:
        with pytest.raises(HTTPException) as error, session.begin():
            bookings.confirm_booking(
                session,
                session.get(User, data["players"][0]),
                selected,
                old["quote"],
                lambda s: start - timedelta(minutes=20),
            )
        assert error.value.detail["code"] == "QUOTE_CHANGED"
        assert (
            session.scalar(
                select(func.count())
                .select_from(Booking)
                .where(Booking.court_id == data["court"])
            )
            == 0
        )
    with Session(data["engine"]) as session, session.begin():
        booked = bookings.confirm_booking(
            session,
            session.get(User, data["players"][0]),
            selected,
            active["quote"],
            lambda s: start - timedelta(minutes=20),
        )
        assert booked["total_price_vnd"] == 200_000
        offers.finish_offer(
            session,
            session.get(User, data["owner"]),
            scheduled["id"],
            "deactivate",
            lambda s: start - timedelta(minutes=10),
        )
        assert session.get(Booking, booked["id"]).total_price_vnd == 200_000


@pytest.mark.parametrize(
    "lead",
    [Decimal(0), Decimal(-1), Decimal("24.001"), Decimal("NaN"), Decimal("Infinity")],
)
def test_invalid_lead_rejected_without_offer(race_data, lead):
    with pytest.raises(HTTPException) as error:
        configure(race_data, lead=lead)
    assert error.value.status_code == 422


def test_24_hour_boundary_manual_automatic_and_pending_cancel(race_data):
    data = race_data
    with Session(data["engine"]) as session:
        start = session.get(Slot, data["slots"][0]).start_at
    with pytest.raises(HTTPException):
        configure(data, mode="manual", now=start - timedelta(hours=24, microseconds=1))
    scheduled = configure(data, lead=Decimal(24), now=start - timedelta(hours=48))
    assert scheduled["status"] == "SCHEDULED"
    with Session(data["engine"]) as session, session.begin():
        owner = session.get(User, data["owner"])
        cancelled = offers.finish_offer(
            session,
            owner,
            scheduled["id"],
            "cancel",
            lambda s: start - timedelta(hours=25),
        )
        assert cancelled["status"] == "CANCELLED"
    manual = configure(data, mode="manual", now=start - timedelta(hours=24))
    assert manual["status"] == "ACTIVE" and manual["eligible"]
    with Session(data["engine"]) as session, session.begin():
        state = offers.list_offers(
            session, session.get(User, data["owner"]), data["slots"][0], lambda s: start
        )[0]
        assert state["status"] == "EXPIRED"
        courts.update_slot(
            session,
            session.get(User, data["owner"]),
            data["slots"][0],
            {
                "start_at": start + timedelta(days=7),
                "end_at": start + timedelta(days=7, hours=1),
            },
            clock=lambda s: start,
        )
        rows = offers.list_offers(
            session, session.get(User, data["owner"]), data["slots"][0], lambda s: start
        )
        assert {row["status"] for row in rows} == {"EXPIRED", "CANCELLED"}


def test_temporary_ineligibility_price_edit_and_cancellation_restore(race_data):
    data = race_data
    with Session(data["engine"]) as session:
        start = session.get(Slot, data["slots"][0]).start_at
    now = start - timedelta(hours=8)
    configured = configure(data, lead=Decimal(24), now=now)
    with Session(data["engine"]) as session, session.begin():
        owner = session.get(User, data["owner"])
        courts.update_slot(
            session, owner, data["slots"][0], {"blocked": True}, clock=lambda s: now
        )
        state = offers.list_offers(session, owner, data["slots"][0], lambda s: now)[0]
        assert not state["eligible"] and state["reason"]
        courts.update_slot(
            session,
            owner,
            data["slots"][0],
            {"blocked": False, "price_vnd": 70_000},
            clock=lambda s: now,
        )
        assert not offers.list_offers(session, owner, data["slots"][0], lambda s: now)[
            0
        ]["eligible"]
        courts.update_slot(
            session,
            owner,
            data["slots"][0],
            {"price_vnd": 100_000},
            clock=lambda s: now,
        )
        player = session.get(User, data["players"][0])
        selection = data["slots"][:2]
        quote = bookings.review_booking(session, player, selection, lambda s: now)
        booking = bookings.confirm_booking(
            session, player, selection, quote["quote"], lambda s: now
        )
        assert booking["total_price_vnd"] == 200_000
        assert not offers.list_offers(session, owner, data["slots"][0], lambda s: now)[
            0
        ]["eligible"]
        bookings.cancel_booking(session, player, booking["id"], lambda s: now)
        assert offers.list_offers(session, owner, data["slots"][0], lambda s: now)[0][
            "eligible"
        ]
        offers.finish_offer(
            session, owner, configured["id"], "deactivate", lambda s: now
        )
        assert (
            offers.list_offers(session, owner, data["slots"][0], lambda s: now)[0][
                "status"
            ]
            == "DEACTIVATED"
        )
        assert session.get(Booking, booking["id"]).total_price_vnd == 200_000


def test_simultaneous_manual_and_automatic_configuration_is_unique(race_data):
    data = race_data

    def create(mode):
        def operation(session):
            slot = session.get(Slot, data["slots"][0])
            return offers.create_offer(
                session,
                session.get(User, data["owner"]),
                slot.id,
                mode,
                80_000,
                Decimal(24),
                lambda s: slot.start_at - timedelta(hours=12),
            )

        return operation

    result = races.contended(data, [create("manual"), create("automatic")])
    assert sum(row["ok"] for row in result) == 1
    with Session(data["engine"]) as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(SlotOffer)
                .where(SlotOffer.slot_id == data["slots"][0])
            )
            == 1
        )


@pytest.mark.parametrize("action", ["cancel", "deactivate", "book"])
def test_activation_racing_state_change_or_booking(race_data, action):
    data = race_data
    with Session(data["engine"]) as session:
        start = session.get(Slot, data["slots"][0]).start_at
    offer = configure(data, lead=Decimal(3))
    now = start - timedelta(hours=3)
    old = races.quote_for(data, data["players"][0], data["slots"][:1])

    def activate(session):
        return offers.list_offers(
            session, session.get(User, data["owner"]), data["slots"][0], lambda s: now
        )

    def change(session):
        if action == "book":
            return bookings.confirm_booking(
                session,
                session.get(User, data["players"][0]),
                data["slots"][:1],
                old,
                lambda s: now,
            )
        return offers.finish_offer(
            session,
            session.get(User, data["owner"]),
            offer["id"],
            action,
            lambda s: now,
        )

    result = races.contended(data, [activate, change])
    assert result[0]["ok"]
    assert result[1]["ok"] == (action == "deactivate")
    with Session(data["engine"]) as session:
        status = session.get(SlotOffer, offer["id"]).status
        assert status == ("DEACTIVATED" if action == "deactivate" else "ACTIVE")
        assert (
            session.scalar(
                select(func.count())
                .select_from(Booking)
                .where(Booking.court_id == data["court"])
            )
            == 0
        )
