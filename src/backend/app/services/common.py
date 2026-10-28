from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    Booking,
    Court,
    MaintenanceBlock,
    OperatingHours,
    Slot,
    SlotClaim,
    User,
)

LOCAL_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
Clock = Callable[[Session], datetime]


def fail(code: str, message: str, status: int = 409, **details) -> None:
    raise HTTPException(status, {"code": code, "message": message, **details})


def database_now(session: Session) -> datetime:
    return session.scalar(select(func.clock_timestamp()))


def get_clock() -> Clock:
    return database_now


def lock_court(session: Session, court_id: UUID, owner: User | None = None) -> Court:
    court = session.scalar(
        select(Court)
        .where(Court.id == court_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if court is None:
        fail("court_not_found", "Court not found.", 404)
    if owner and (owner.role != "owner" or court.owner_id != owner.id):
        fail("court_forbidden", "This court belongs to another Court Owner.", 403)
    return court


def overlaps(
    start: datetime, end: datetime, other_start: datetime, other_end: datetime
) -> bool:
    return start < other_end and other_start < end


def playing_date(start: datetime) -> date:
    return start.astimezone(LOCAL_TZ).date()


def validate_interval(
    start: datetime, end: datetime, slot: bool = False
) -> tuple[datetime, datetime]:
    if (
        start.tzinfo is None
        or start.utcoffset() is None
        or end.tzinfo is None
        or end.utcoffset() is None
    ):
        fail("timezone_required", "Use timezone-aware start/end timestamps.", 422)
    start, end = start.astimezone(UTC), end.astimezone(UTC)
    if end <= start:
        fail("invalid_interval", "End must be later than start.", 422)
    if slot:
        if any(
            t.second or t.microsecond or t.minute % 30
            for t in (start.astimezone(LOCAL_TZ), end.astimezone(LOCAL_TZ))
        ):
            fail("slot_grid", "Slot boundaries must align to 30 minutes.", 422)
        if not timedelta(minutes=60) <= end - start <= timedelta(minutes=240):
            fail("slot_duration", "Each slot must last 60–240 minutes.", 422)
        if playing_date(start) != playing_date(end - timedelta(microseconds=1)):
            fail("slot_date", "A slot must stay within one local playing day.", 422)
    return start, end


def in_hours(session: Session, court: Court, start: datetime, end: datetime) -> bool:
    start, end = start.astimezone(LOCAL_TZ), end.astimezone(LOCAL_TZ)
    if start.date() != (end - timedelta(microseconds=1)).date():
        return False
    window = session.get(
        OperatingHours, (court.id, start.weekday()), populate_existing=True
    )
    if window is None:
        return False
    midnight = datetime.combine(start.date(), datetime.min.time(), LOCAL_TZ)
    return midnight + timedelta(
        minutes=window.opens_minute
    ) <= start and end <= midnight + timedelta(minutes=window.closes_minute)


def slot_state(session: Session, court: Court, slot: Slot, now: datetime) -> str:
    occupied = session.get(SlotClaim, slot.id)
    conflict = session.scalar(
        select(Booking.id)
        .where(
            Booking.court_id == court.id,
            Booking.status == "CONFIRMED",
            Booking.start_at < slot.end_at,
            Booking.end_at > slot.start_at,
        )
        .limit(1)
    )
    if occupied or conflict:
        return "BOOKED"
    maintenance = session.scalar(
        select(MaintenanceBlock.id)
        .where(
            MaintenanceBlock.court_id == court.id,
            MaintenanceBlock.start_at < slot.end_at,
            MaintenanceBlock.end_at > slot.start_at,
        )
        .limit(1)
    )
    if slot.blocked or maintenance:
        return "BLOCKED"
    if (
        not court.active
        or not slot.published
        or slot.start_at <= now
        or not in_hours(session, court, slot.start_at, slot.end_at)
    ):
        return "UNAVAILABLE"
    return "AVAILABLE"
