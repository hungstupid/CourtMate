"""Atomic, Player-only booking flow over Owner-published PostgreSQL slots."""

import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import Booking, BookingSlot, Court, Room, Slot, SlotClaim, User
from app.services.common import (
    Clock,
    database_now,
    fail,
    lock_court,
    playing_date,
    slot_state,
    validate_interval,
)


def _player(user: User) -> None:
    if user.role != "player":
        fail("PLAYER_REQUIRED", "Only a Player may book or cancel a booking.", 403)


def _owner(user: User) -> None:
    if user.role != "owner":
        fail("OWNER_REQUIRED", "Court Owner access is required.", 403)


def _quote(player: User, court: Court, slots: list[Slot]) -> str:
    value = {
        "player": str(player.id),
        "court": str(court.id),
        "court_version": court.version,
        "slots": [
            {
                "id": str(slot.id),
                "version": slot.version,
                "start": slot.start_at.astimezone(UTC).isoformat(),
                "end": slot.end_at.astimezone(UTC).isoformat(),
                "price_vnd": slot.price_vnd,
            }
            for slot in slots
        ],
    }
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _locked_selection(
    session: Session, player: User, slot_ids: list[UUID], clock: Clock
) -> tuple[Court, list[Slot], datetime]:
    _player(player)
    if not 1 <= len(slot_ids) <= 4 or len(set(slot_ids)) != len(slot_ids):
        fail("INVALID_SELECTION", "Select one to four distinct published slots.", 422)
    destinations = list(
        session.execute(select(Slot.id, Slot.court_id).where(Slot.id.in_(slot_ids)))
    )
    if len(destinations) != len(slot_ids):
        fail("SLOT_NOT_FOUND", "A selected slot does not exist.", 404)
    court_ids = {row.court_id for row in destinations}
    if len(court_ids) != 1:
        fail("INVALID_SELECTION", "All selected slots must belong to the same court.")
    court_id = court_ids.pop()
    court = lock_court(session, court_id)
    # Every writer for this court takes its row lock before checking eligibility.
    # Lock slots by UUID independently of their display order to keep lock order stable.
    slots = list(
        session.scalars(
            select(Slot)
            .where(Slot.id.in_(slot_ids), Slot.court_id == court.id)
            .order_by(Slot.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    )
    now = clock(session)
    if len(slots) != len(slot_ids):
        fail("SLOT_NOT_FOUND", "A selected slot does not exist.", 404)
    if not court.active:
        fail("COURT_INACTIVE", "This court is unavailable for new bookings.")
    if any(slot.court_id != court.id for slot in slots):
        fail("INVALID_SELECTION", "All selected slots must belong to the same court.")
    slots.sort(key=lambda slot: (slot.start_at, slot.id))
    selected_date = slots[0].playing_date
    for slot in slots:
        validate_interval(slot.start_at, slot.end_at, slot=True)
        if (
            slot.playing_date != selected_date
            or playing_date(slot.start_at) != selected_date
        ):
            fail("INVALID_SELECTION", "Selected slots violate the date or time grid.")
        if slot.start_at <= now or slot_state(session, court, slot, now) != "AVAILABLE":
            fail("SLOT_UNAVAILABLE", "A selected slot is no longer available.")
        if slot.price_vnd <= 0:
            fail("SLOT_UNAVAILABLE", "A selected slot has no valid current quote.")
    if any(
        left.end_at != right.start_at
        for left, right in zip(slots, slots[1:], strict=False)
    ):
        fail("INVALID_SELECTION", "Select strictly consecutive slots without a gap.")
    duration = (slots[-1].end_at - slots[0].start_at).total_seconds() / 60
    if duration < 60 or duration > 240:
        fail("INVALID_SELECTION", "Combined booking duration must be 60–240 minutes.")
    conflict = session.scalar(
        select(Booking.id)
        .where(
            Booking.court_id == court.id,
            Booking.status == "CONFIRMED",
            Booking.start_at < slots[-1].end_at,
            Booking.end_at > slots[0].start_at,
        )
        .limit(1)
    )
    if conflict is not None:
        fail("BOOKING_CONFLICT", "The selected interval is already booked.")
    return court, slots, now


def _review(player: User, court: Court, slots: list[Slot]) -> dict:
    total = sum(slot.price_vnd for slot in slots)
    if total > 2**63 - 1:
        fail("QUOTE_TOTAL_TOO_LARGE", "The combined quote exceeds the VND limit.", 422)
    return {
        "court_id": court.id,
        "slot_ids": [slot.id for slot in slots],
        "slots": [
            {
                "id": slot.id,
                "start_at": slot.start_at,
                "end_at": slot.end_at,
                "price_vnd": slot.price_vnd,
                "version": slot.version,
            }
            for slot in slots
        ],
        "start_at": slots[0].start_at,
        "end_at": slots[-1].end_at,
        "duration_minutes": int(
            (slots[-1].end_at - slots[0].start_at).total_seconds() / 60
        ),
        "total_price_vnd": total,
        "quote": _quote(player, court, slots),
    }


def review_booking(
    session: Session, player: User, slot_ids: list[UUID], clock: Clock = database_now
) -> dict:
    court, slots, _ = _locked_selection(session, player, slot_ids, clock)
    return _review(player, court, slots)


def _cancellation(booking: Booking, now: datetime) -> tuple[bool, str | None]:
    if booking.status != "CONFIRMED":
        return False, "Booking is already cancelled."
    if now >= booking.start_at:
        return False, "Booking has already started."
    if booking.start_at - now < timedelta(hours=6):
        return False, "Cancellation requires at least six hours before the first slot."
    return True, None


def _serialize(session: Session, booking: Booking, now: datetime) -> dict:
    snapshots = list(
        session.scalars(
            select(BookingSlot)
            .where(BookingSlot.booking_id == booking.id)
            .order_by(BookingSlot.position)
        )
    )
    can_cancel, reason = _cancellation(booking, now)
    return {
        "id": booking.id,
        "court_id": booking.court_id,
        "player_id": booking.player_id,
        "start_at": booking.start_at,
        "end_at": booking.end_at,
        "status": booking.status,
        "total_price_vnd": booking.total_price_vnd,
        "created_at": booking.created_at,
        "cancelled_at": booking.cancelled_at,
        "slots": [
            {
                "slot_id": snapshot.slot_id,
                "position": snapshot.position,
                "start_at": snapshot.start_at,
                "end_at": snapshot.end_at,
                "price_vnd": snapshot.price_vnd,
                "slot_version": snapshot.slot_version,
            }
            for snapshot in snapshots
        ],
        "can_cancel": can_cancel,
        "cancellation_reason": reason,
    }


def confirm_booking(
    session: Session,
    player: User,
    slot_ids: list[UUID],
    quote: str,
    clock: Clock = database_now,
) -> dict:
    court, slots, now = _locked_selection(session, player, slot_ids, clock)
    review = _review(player, court, slots)
    if not hmac.compare_digest(quote, review["quote"]):
        # Fresh quotes are returned only after the whole selection revalidates.
        from fastapi.encoders import jsonable_encoder

        fail(
            "QUOTE_CHANGED",
            "The quote changed. Review and explicitly accept the current prices.",
            review=jsonable_encoder(review),
        )
    # Availability changes invalidate old reviews, including a delayed retry
    # arriving after this booking has subsequently been cancelled.
    court.version += 1
    booking = Booking(
        court_id=court.id,
        player_id=player.id,
        start_at=slots[0].start_at,
        end_at=slots[-1].end_at,
        status="CONFIRMED",
        total_price_vnd=review["total_price_vnd"],
        created_at=now,
    )
    session.add(booking)
    session.flush()
    for position, slot in enumerate(slots):
        session.add(
            BookingSlot(
                booking_id=booking.id,
                slot_id=slot.id,
                position=position,
                start_at=slot.start_at,
                end_at=slot.end_at,
                price_vnd=slot.price_vnd,
                slot_version=slot.version,
            )
        )
    session.flush()
    session.add_all(SlotClaim(slot_id=slot.id, booking_id=booking.id) for slot in slots)
    session.flush()
    return _serialize(session, booking, now)


def player_bookings(
    session: Session, player: User, clock: Clock = database_now
) -> list[dict]:
    _player(player)
    now = clock(session)
    bookings = session.scalars(
        select(Booking)
        .where(Booking.player_id == player.id)
        .order_by(Booking.created_at.desc(), Booking.id.desc())
        .limit(10)
    )
    return [_serialize(session, booking, now) for booking in bookings]


def player_booking(
    session: Session, player: User, booking_id: UUID, clock: Clock = database_now
) -> dict:
    _player(player)
    booking = session.get(Booking, booking_id)
    if booking is None:
        fail("BOOKING_NOT_FOUND", "Booking not found.", 404)
    if booking.player_id != player.id:
        fail("NOT_BOOKING_OWNER", "This booking belongs to another Player.", 403)
    return _serialize(session, booking, clock(session))


def cancel_booking(
    session: Session, player: User, booking_id: UUID, clock: Clock = database_now
) -> dict:
    _player(player)
    court_id = session.scalar(select(Booking.court_id).where(Booking.id == booking_id))
    if court_id is None:
        fail("BOOKING_NOT_FOUND", "Booking not found.", 404)
    court = lock_court(session, court_id)
    booking = session.scalar(
        select(Booking)
        .where(Booking.id == booking_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if booking is None:
        fail("BOOKING_NOT_FOUND", "Booking not found.", 404)
    if booking.player_id != player.id:
        fail("NOT_BOOKING_OWNER", "This booking belongs to another Player.", 403)
    # Every room mutation follows Court -> Booking -> Room. Lock the linked room
    # before reading time so cancellation eligibility is checked after all waits.
    room = session.scalar(
        select(Room)
        .where(Room.booking_id == booking.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    now = clock(session)
    eligible, reason = _cancellation(booking, now)
    if not eligible:
        code = (
            "BOOKING_ALREADY_CANCELLED"
            if booking.status == "CANCELLED"
            else "CANCELLATION_TOO_LATE"
        )
        fail(code, reason)
    if room is not None:
        room.closed = True
    booking.status = "CANCELLED"
    booking.cancelled_at = now
    court.version += 1
    session.execute(delete(SlotClaim).where(SlotClaim.booking_id == booking.id))
    session.flush()
    return _serialize(session, booking, now)


def _owner_view(session: Session, booking: Booking, now: datetime) -> dict:
    result = _serialize(session, booking, now)
    # SRS FR-029 does not approve a concrete Player contact/privacy field set.
    for key in ("player_id", "can_cancel", "cancellation_reason"):
        result.pop(key)
    return result


def owner_bookings(
    session: Session, owner: User, clock: Clock = database_now
) -> list[dict]:
    _owner(owner)
    now = clock(session)
    bookings = session.scalars(
        select(Booking)
        .join(Court, Court.id == Booking.court_id)
        .where(Court.owner_id == owner.id)
        .order_by(Booking.created_at.desc(), Booking.id.desc())
    )
    return [_owner_view(session, booking, now) for booking in bookings]


def owner_booking(
    session: Session, owner: User, booking_id: UUID, clock: Clock = database_now
) -> dict:
    _owner(owner)
    booking = session.get(Booking, booking_id)
    if booking is None:
        fail("BOOKING_NOT_FOUND", "Booking not found.", 404)
    court = session.get(Court, booking.court_id)
    if court.owner_id != owner.id:
        fail("NOT_COURT_OWNER", "This booking belongs to another Court Owner.", 403)
    return _owner_view(session, booking, clock(session))
