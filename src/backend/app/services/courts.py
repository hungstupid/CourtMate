"""Court scheduling operations. Caller owns the transaction and its commit."""

from datetime import date, datetime, time, timedelta
from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

from sqlalchemy import delete, select
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
from app.services.common import (
    LOCAL_TZ,
    Clock,
    database_now,
    fail,
    in_hours,
    lock_court,
    playing_date,
    slot_state,
    validate_interval,
)

COURT_FIELDS = {
    "name",
    "sport",
    "address",
    "area",
    "description",
    "contact",
    "photo_urls",
    "base_price_vnd",
    "max_players",
    "active",
}
SLOT_FIELDS = {"start_at", "end_at", "price_vnd", "published", "blocked"}
MAX_VND = 2**63 - 1


def _owner(owner: User) -> None:
    if owner.role != "owner":
        fail("OWNER_REQUIRED", "Court Owner access is required.", status=403)


def _validate_fields(values: dict[str, Any], allowed: set[str]) -> None:
    if values.keys() - allowed:
        fail("INVALID_FIELDS", "Unknown fields are not allowed.", status=422)


def _price(value: Any) -> None:
    if type(value) is not int or not 1 <= value <= MAX_VND:
        fail("INVALID_PRICE", "Price must be a positive whole-VND integer.", status=422)


def _court_values(values: dict[str, Any]) -> None:
    _validate_fields(values, COURT_FIELDS)
    if "base_price_vnd" in values:
        _price(values["base_price_vnd"])
    if "max_players" in values:
        value = values["max_players"]
        if type(value) is not int or not 2 <= value <= 30:
            fail(
                "INVALID_CAPACITY",
                "Court max_players must be an integer from 2 to 30.",
                status=422,
            )
    if "active" in values and type(values["active"]) is not bool:
        fail("INVALID_ACTIVE", "active must be a boolean.", status=422)
    for name, limit in {"name": 150, "sport": 80, "address": 300, "area": 120}.items():
        if name in values:
            value = values[name]
            if (
                not isinstance(value, str)
                or not value.strip()
                or len(value.strip()) > limit
            ):
                fail("INVALID_COURT", f"A valid {name} is required.", status=422)
            values[name] = value.strip()
    for name, limit in {"description": 4000, "contact": 200}.items():
        if name in values:
            value = values[name]
            if not isinstance(value, str) or len(value) > limit:
                fail("INVALID_COURT", f"Invalid {name}.", status=422)
    if "photo_urls" in values:
        urls = values["photo_urls"]
        if not isinstance(urls, list) or len(urls) > 20:
            fail("INVALID_PHOTOS", "Supply at most 20 photo URLs.", status=422)
        for value in urls:
            if not isinstance(value, str) or len(value) > 2048:
                fail("INVALID_PHOTOS", "Photo URLs must use HTTP or HTTPS.", status=422)
            try:
                parsed = urlsplit(value)
                valid = (
                    parsed.scheme in {"http", "https"}
                    and parsed.hostname
                    and not parsed.username
                )
            except ValueError:
                valid = False
            if not valid:
                fail("INVALID_PHOTOS", "Photo URLs must use HTTP or HTTPS.", status=422)


def create_court(session: Session, owner: User, values: dict[str, Any]) -> Court:
    _owner(owner)
    values = dict(values)
    _court_values(values)
    if (
        not {"name", "sport", "address", "area", "base_price_vnd", "max_players"}
        <= values.keys()
    ):
        fail("INVALID_COURT", "Required court details are missing.", status=422)
    court = Court(
        owner_id=owner.id,
        description="",
        contact="",
        photo_urls=[],
        active=True,
        version=1,
    )
    for key, value in values.items():
        setattr(court, key, value)
    session.add(court)
    session.flush()
    return court


def update_court(
    session: Session,
    owner: User,
    court_id: UUID,
    values: dict[str, Any],
    *,
    clock: Clock = database_now,
) -> Court:
    _owner(owner)
    court = lock_court(session, court_id, owner=owner)
    values = dict(values)
    _court_values(values)
    # The room-capacity guard is added with Phase B after Phase A passes.
    clock(session)
    for key, value in values.items():
        setattr(court, key, value)
    court.version += 1
    session.flush()
    return court


def _fits_windows(
    start: datetime, end: datetime, windows: list[dict[str, int]]
) -> bool:
    start_local, end_local = start.astimezone(LOCAL_TZ), end.astimezone(LOCAL_TZ)
    end_minute = end_local.hour * 60 + end_local.minute
    if end_local.date() != start_local.date():
        if (
            end_local.date() != start_local.date() + timedelta(days=1)
            or end_local.time() != time.min
        ):
            return False
        end_minute = 1440
    start_minute = start_local.hour * 60 + start_local.minute
    return any(
        row["weekday"] == start_local.weekday()
        and row["opens_minute"] <= start_minute
        and end_minute <= row["closes_minute"]
        for row in windows
    )


def replace_hours(
    session: Session,
    owner: User,
    court_id: UUID,
    windows: list[dict[str, int]],
    *,
    clock: Clock = database_now,
) -> list[OperatingHours]:
    _owner(owner)
    court = lock_court(session, court_id, owner=owner)
    now = clock(session)
    weekdays: set[int] = set()
    for row in windows:
        if set(row) != {"weekday", "opens_minute", "closes_minute"} or any(
            type(v) is not int for v in row.values()
        ):
            fail(
                "INVALID_HOURS",
                "Hours require integer weekday/open/close minutes.",
                status=422,
            )
        day, opens, closes = row["weekday"], row["opens_minute"], row["closes_minute"]
        if not 0 <= day <= 6 or day in weekdays or not 0 <= opens < closes <= 1440:
            fail(
                "INVALID_HOURS",
                "Use one valid opening window per weekday.",
                status=422,
            )
        weekdays.add(day)
    slots = session.scalars(
        select(Slot).where(
            Slot.court_id == court.id, Slot.published.is_(True), Slot.end_at > now
        )
    )
    for slot in slots:
        if not _fits_windows(slot.start_at, slot.end_at, windows):
            fail(
                "SCHEDULE_CONFLICT",
                "The new hours would invalidate a published future slot.",
            )
    for booking in session.scalars(
        select(Booking).where(
            Booking.court_id == court.id, Booking.status == "CONFIRMED"
        )
    ):
        if not _fits_windows(booking.start_at, booking.end_at, windows):
            fail(
                "BOOKING_PROTECTED",
                "The new hours would invalidate a confirmed booking.",
            )
    session.execute(delete(OperatingHours).where(OperatingHours.court_id == court.id))
    hours = [OperatingHours(court_id=court.id, **row) for row in windows]
    session.add_all(hours)
    court.version += 1
    session.flush()
    return sorted(hours, key=lambda row: row.weekday)


def _confirmed_overlap(
    session: Session, court_id: UUID, start: datetime, end: datetime
) -> bool:
    return (
        session.scalar(
            select(Booking.id)
            .where(
                Booking.court_id == court_id,
                Booking.status == "CONFIRMED",
                Booking.start_at < end,
                Booking.end_at > start,
            )
            .limit(1)
        )
        is not None
    )


def _validate_slot(session: Session, court: Court, slot: Slot, now: datetime) -> None:
    slot.start_at, slot.end_at = validate_interval(
        slot.start_at, slot.end_at, slot=True
    )
    slot.playing_date = playing_date(slot.start_at)
    _price(slot.price_vnd)
    if type(slot.published) is not bool or type(slot.blocked) is not bool:
        fail("INVALID_SLOT", "Slot flags must be booleans.", status=422)
    if not slot.published:
        return
    if slot.start_at <= now:
        fail("SLOT_PAST", "Published slots must start strictly after server time.")
    if not in_hours(session, court, slot.start_at, slot.end_at):
        fail("OUTSIDE_HOURS", "The slot must fit the court's operating hours.")
    conflict = select(Slot.id).where(
        Slot.court_id == court.id,
        Slot.published.is_(True),
        Slot.start_at < slot.end_at,
        Slot.end_at > slot.start_at,
    )
    if slot.id:
        conflict = conflict.where(Slot.id != slot.id)
    # Avoid autoflush until every invariant has been checked.
    with session.no_autoflush:
        if session.scalar(conflict.limit(1)) is not None:
            fail("SLOT_OVERLAP", "Published slots for a court must not overlap.")
        if (
            session.scalar(
                select(MaintenanceBlock.id)
                .where(
                    MaintenanceBlock.court_id == court.id,
                    MaintenanceBlock.start_at < slot.end_at,
                    MaintenanceBlock.end_at > slot.start_at,
                )
                .limit(1)
            )
            is not None
        ):
            fail("MAINTENANCE_CONFLICT", "The slot intersects maintenance.")
        if _confirmed_overlap(session, court.id, slot.start_at, slot.end_at):
            fail("BOOKING_PROTECTED", "The slot would overlap a confirmed booking.")


def publish_slot(
    session: Session,
    owner: User,
    court_id: UUID,
    values: dict[str, Any],
    *,
    clock: Clock = database_now,
) -> Slot:
    _owner(owner)
    court = lock_court(session, court_id, owner=owner)
    _validate_fields(values, SLOT_FIELDS)
    if not {"start_at", "end_at", "price_vnd"} <= values.keys():
        fail("INVALID_SLOT", "Slot interval and quoted price are required.", status=422)
    slot = Slot(court_id=court.id, version=1, published=True, blocked=False)
    for key, value in values.items():
        setattr(slot, key, value)
    with session.no_autoflush:
        _validate_slot(session, court, slot, clock(session))
    session.add(slot)
    court.version += 1
    session.flush()
    return slot


def update_slot(
    session: Session,
    owner: User,
    slot_id: UUID,
    values: dict[str, Any],
    *,
    clock: Clock = database_now,
) -> Slot:
    _owner(owner)
    _validate_fields(values, SLOT_FIELDS)
    court_id = session.scalar(select(Slot.court_id).where(Slot.id == slot_id))
    if court_id is None:
        fail("NOT_FOUND", "Slot not found.", status=404)
    court = lock_court(session, court_id, owner=owner)
    slot = session.get(Slot, slot_id, populate_existing=True)
    if slot is None:
        fail("NOT_FOUND", "Slot not found.", status=404)
    if session.get(SlotClaim, slot.id) is not None or _confirmed_overlap(
        session, court.id, slot.start_at, slot.end_at
    ):
        fail("BOOKING_PROTECTED", "Slots in a confirmed booking cannot be edited.")
    candidate = Slot(
        id=slot.id,
        court_id=slot.court_id,
        start_at=slot.start_at,
        end_at=slot.end_at,
        price_vnd=slot.price_vnd,
        published=slot.published,
        blocked=slot.blocked,
        version=slot.version,
    )
    for key, value in values.items():
        setattr(candidate, key, value)
    with session.no_autoflush:
        _validate_slot(session, court, candidate, clock(session))
    for key in SLOT_FIELDS | {"playing_date"}:
        setattr(slot, key, getattr(candidate, key))
    slot.version += 1
    court.version += 1
    session.flush()
    return slot


def add_maintenance(
    session: Session,
    owner: User,
    court_id: UUID,
    values: dict[str, Any],
    *,
    clock: Clock = database_now,
) -> MaintenanceBlock:
    _owner(owner)
    court = lock_court(session, court_id, owner=owner)
    _validate_fields(values, {"start_at", "end_at"})
    if set(values) != {"start_at", "end_at"}:
        fail("INVALID_MAINTENANCE", "A maintenance interval is required.", status=422)
    start, end = validate_interval(values["start_at"], values["end_at"])
    clock(session)
    if _confirmed_overlap(session, court.id, start, end):
        fail("BOOKING_PROTECTED", "Maintenance cannot intersect a confirmed booking.")
    block = MaintenanceBlock(court_id=court.id, start_at=start, end_at=end)
    session.add(block)
    court.version += 1
    session.flush()
    return block


def remove_maintenance(
    session: Session, owner: User, block_id: UUID, *, clock: Clock = database_now
) -> None:
    _owner(owner)
    court_id = session.scalar(
        select(MaintenanceBlock.court_id).where(MaintenanceBlock.id == block_id)
    )
    if court_id is None:
        fail("NOT_FOUND", "Maintenance block not found.", status=404)
    court = lock_court(session, court_id, owner=owner)
    block = session.get(MaintenanceBlock, block_id, populate_existing=True)
    if block is None:
        fail("NOT_FOUND", "Maintenance block not found.", status=404)
    clock(session)
    session.delete(block)
    court.version += 1
    session.flush()


def public_court(session: Session, court_id: UUID) -> Court:
    court = session.get(Court, court_id)
    if court is None or not court.active:
        fail("NOT_FOUND", "Active court not found.", status=404)
    return court


def dump_court(court: Court) -> dict[str, Any]:
    return {
        key: getattr(court, key)
        for key in ["id", "owner_id", *sorted(COURT_FIELDS), "version"]
    }


def dump_slot(slot: Slot, state: str | None = None) -> dict[str, Any]:
    result = {
        key: getattr(slot, key)
        for key in [
            "id",
            "court_id",
            "playing_date",
            "start_at",
            "end_at",
            "price_vnd",
            "version",
            "published",
            "blocked",
        ]
    }
    if state is not None:
        result["status"] = state
    return result


def availability(
    session: Session, court_id: UUID, day: date, *, clock: Clock = database_now
) -> dict[str, Any]:
    court = public_court(session, court_id)
    now = clock(session)
    slots = session.scalars(
        select(Slot)
        .where(
            Slot.court_id == court.id,
            Slot.playing_date == day,
            Slot.published.is_(True),
        )
        .order_by(Slot.start_at, Slot.id)
    ).all()
    lower = datetime.combine(day, time.min, LOCAL_TZ)
    upper = lower + timedelta(days=1)
    blocks = session.scalars(
        select(MaintenanceBlock)
        .where(
            MaintenanceBlock.court_id == court.id,
            MaintenanceBlock.start_at < upper,
            MaintenanceBlock.end_at > lower,
        )
        .order_by(MaintenanceBlock.start_at, MaintenanceBlock.id)
    ).all()
    return {
        "court_id": court.id,
        "playing_date": day,
        "timezone": str(LOCAL_TZ),
        "server_now": now,
        "slots": [
            dump_slot(slot, slot_state(session, court, slot, now)) for slot in slots
        ],
        "maintenance": [
            {"id": block.id, "start_at": block.start_at, "end_at": block.end_at}
            for block in blocks
        ],
    }
