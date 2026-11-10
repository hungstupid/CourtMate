"""Lazy authoritative offer lifecycle. Every caller holds the parent court lock."""

from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Court, Slot, SlotOffer, User
from app.services.common import Clock, database_now, fail, lock_court, slot_state

TERMINAL = {"CANCELLED", "DEACTIVATED", "EXPIRED"}


def effective(
    session: Session, court: Court, slot: Slot, now: datetime, offer: SlotOffer
) -> dict:
    delta = slot.start_at - now
    applies_at = slot.start_at - timedelta(seconds=float(offer.lead_hours * 3600))
    reason = None
    if offer.status in TERMINAL:
        reason = f"Offer is {offer.status.lower()}."
    elif delta <= timedelta(0):
        offer.status = "EXPIRED"
        reason = "Slot has started; this offer has expired."
    elif now < applies_at:
        reason = "The configured lead-time window has not started."
    elif slot_state(session, court, slot, now) != "AVAILABLE":
        reason = (
            "Court/slot is inactive, unpublished, booked, blocked or outside hours."
        )
    elif not 0 < offer.price_vnd < slot.price_vnd:
        reason = "Offer price must remain below the current regular quote."
    else:
        offer.status = "ACTIVE"
    eligible = reason is None
    return {
        "id": offer.id,
        "slot_id": slot.id,
        "mode": offer.mode,
        "status": offer.status,
        "price_vnd": offer.price_vnd,
        "regular_price_vnd": slot.price_vnd,
        "lead_hours": offer.lead_hours,
        "applies_at": applies_at,
        "eligible": eligible,
        "reason": reason,
        "created_at": offer.created_at,
    }


def current(session: Session, court: Court, slot: Slot, now: datetime) -> dict | None:
    offer = session.scalar(
        select(SlotOffer).where(
            SlotOffer.slot_id == slot.id, SlotOffer.status.in_(["SCHEDULED", "ACTIVE"])
        )
    )
    return effective(session, court, slot, now, offer) if offer is not None else None


def quote(
    session: Session, court: Court, slot: Slot, now: datetime
) -> tuple[int, dict | None]:
    offer = current(session, court, slot, now)
    return (
        offer["price_vnd"] if offer and offer["eligible"] else slot.price_vnd,
        offer,
    )


def locked_slot(session: Session, owner: User, slot_id: UUID) -> tuple[Court, Slot]:
    court_id = session.scalar(select(Slot.court_id).where(Slot.id == slot_id))
    if court_id is None:
        fail("SLOT_NOT_FOUND", "Slot not found.", 404)
    court = lock_court(session, court_id, owner=owner)
    return court, session.get(Slot, slot_id, populate_existing=True)


def create_offer(
    session: Session,
    owner: User,
    slot_id: UUID,
    mode: str,
    price_vnd: int,
    lead_hours: Decimal,
    clock: Clock = database_now,
) -> dict:
    court, slot = locked_slot(session, owner, slot_id)
    now = clock(session)
    if (
        mode not in {"manual", "automatic"}
        or not lead_hours.is_finite()
        or not 0 < lead_hours <= 24
    ):
        fail(
            "INVALID_OFFER",
            "Lead time must be a number greater than 0 and at most 24 hours.",
            422,
        )
    if type(price_vnd) is not int or not 0 < price_vnd < slot.price_vnd:
        fail(
            "INVALID_OFFER_PRICE",
            "Use a positive whole-VND offer below the regular quote.",
            422,
        )
    existing = current(session, court, slot, now)
    if existing and existing["status"] not in TERMINAL:
        fail("OFFER_EXISTS", "This slot already has a scheduled or active offer.")
    if slot_state(session, court, slot, now) != "AVAILABLE":
        fail(
            "SLOT_UNAVAILABLE",
            "Offers require an active court and an available published future slot.",
        )
    if mode == "manual" and slot.start_at - now > timedelta(hours=24):
        fail(
            "MANUAL_WINDOW",
            "Manual offers require at most 24 hours until play; "
            "use automatic scheduling.",
        )
    offer = SlotOffer(
        slot_id=slot.id,
        mode=mode,
        price_vnd=price_vnd,
        lead_hours=Decimal(24) if mode == "manual" else lead_hours,
        status="SCHEDULED" if mode == "automatic" else "ACTIVE",
        created_at=now,
    )
    session.add(offer)
    court.version += 1
    session.flush()
    return effective(session, court, slot, now, offer)


def list_offers(
    session: Session, owner: User, slot_id: UUID, clock: Clock = database_now
) -> list[dict]:
    court, slot = locked_slot(session, owner, slot_id)
    now = clock(session)
    return [
        effective(session, court, slot, now, offer)
        for offer in session.scalars(
            select(SlotOffer)
            .where(SlotOffer.slot_id == slot.id)
            .order_by(SlotOffer.created_at.desc(), SlotOffer.id)
        )
    ]


def finish_offer(
    session: Session,
    owner: User,
    offer_id: UUID,
    action: str,
    clock: Clock = database_now,
) -> dict:
    slot_id = session.scalar(select(SlotOffer.slot_id).where(SlotOffer.id == offer_id))
    if slot_id is None:
        fail("OFFER_NOT_FOUND", "Offer not found.", 404)
    court, slot = locked_slot(session, owner, slot_id)
    offer = session.get(SlotOffer, offer_id, populate_existing=True)
    now = clock(session)
    result = effective(session, court, slot, now, offer)
    expected, target = (
        ("SCHEDULED", "CANCELLED") if action == "cancel" else ("ACTIVE", "DEACTIVATED")
    )
    if offer.status != expected:
        fail(
            "OFFER_STATE_CHANGED",
            "Offer state changed. Review it and confirm the appropriate action.",
            offer=result,
        )
    offer.status = target
    court.version += 1
    session.flush()
    return effective(session, court, slot, now, offer)
