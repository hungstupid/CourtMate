"""Owner/public API and schedule invariants against the isolated PostgreSQL DB."""

from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select

from app.api.courts import CourtCreate, CourtPatch, SlotCreate, SlotPatch
from app.core.auth import current_user
from app.db.models import Booking, Court, MaintenanceBlock, OperatingHours, Slot, User
from app.main import app
from app.services import courts
from app.services.common import LOCAL_TZ, get_clock

NOW = datetime(2030, 1, 1, tzinfo=UTC)
DAY = date(2030, 1, 2)


def clock(_):
    return NOW


def start(hour=8, minute=0, day=DAY):
    return datetime(
        day.year, day.month, day.day, hour, minute, tzinfo=LOCAL_TZ
    ).astimezone(UTC)


def court_values(**changes):
    values = {
        "name": "Draft test court",
        "sport": "badminton",
        "address": "Test venue address",
        "area": "Test area",
        "description": "Integration test court",
        "contact": "Venue contact",
        "photo_urls": [],
        "base_price_vnd": 100_000,
        "max_players": 8,
    }
    values.update(changes)
    return values


def slot_values(hour=8, minutes=60, **changes):
    values = {
        "start_at": start(hour),
        "end_at": start(hour) + timedelta(minutes=minutes),
        "price_vnd": 100_000,
    }
    values.update(changes)
    return values


@pytest.fixture
def graph(db_session):
    owner = User(firebase_uid="court-owner-" + uuid4().hex, role="owner")
    other = User(firebase_uid="other-owner-" + uuid4().hex, role="owner")
    player = User(firebase_uid="court-player-" + uuid4().hex, role="player")
    db_session.add_all([owner, other, player])
    db_session.flush()
    court = courts.create_court(db_session, owner, court_values())
    courts.replace_hours(
        db_session,
        owner,
        court.id,
        [
            {"weekday": day, "opens_minute": 360, "closes_minute": 1320}
            for day in range(7)
        ],
        clock=clock,
    )
    return owner, other, player, court


@pytest.mark.parametrize(
    "field,value",
    [
        ("base_price_vnd", 0),
        ("base_price_vnd", -1),
        ("base_price_vnd", 1.5),
        ("base_price_vnd", True),
        ("max_players", 1),
        ("max_players", 31),
        ("max_players", 2.5),
        ("max_players", True),
        ("name", " "),
        ("role", "owner"),
        ("owner_id", str(uuid4())),
    ],
)
def test_court_api_rejects_invalid_fields_and_elevation(field, value):
    with pytest.raises(ValidationError):
        CourtCreate(**court_values(**{field: value}))


@pytest.mark.parametrize("value", [0, -1, 2.5, True, "100000"])
def test_slot_quote_requires_positive_whole_vnd(value):
    with pytest.raises(ValidationError):
        SlotCreate(**slot_values(price_vnd=value))


@pytest.mark.parametrize(
    "model,payload",
    [(CourtPatch, {}), (CourtPatch, {"name": None}), (SlotPatch, {"start_at": None})],
)
def test_patch_rejects_empty_or_null_updates(model, payload):
    with pytest.raises(ValidationError):
        model(**payload)


def test_owner_public_endpoints_and_server_guard(api_client, db_session, graph):
    owner, other, player, court = graph
    app.dependency_overrides[current_user] = lambda: owner
    app.dependency_overrides[get_clock] = lambda: clock
    response = api_client.post(
        "/api/owner/courts", json=court_values(name="A public draft court")
    )
    assert response.status_code == 201, response.text
    assert response.json()["owner_id"] == str(owner.id)
    assert response.json()["max_players"] == 8
    assert (
        api_client.get(f"/api/courts/{court.id}").json()["contact"] == "Venue contact"
    )
    assert (
        api_client.get(
            "/api/courts?q=Draft&sport=badminton&area=Test%20area"
        ).status_code
        == 200
    )
    assert api_client.get("/api/courts?q=not-found").json() == []
    app.dependency_overrides[current_user] = lambda: other
    assert (
        api_client.patch(
            f"/api/owner/courts/{court.id}", json={"name": "stolen"}
        ).status_code
        == 403
    )
    assert api_client.get(f"/api/owner/courts/{court.id}").status_code == 403
    app.dependency_overrides[current_user] = lambda: player
    assert api_client.post("/api/owner/courts", json=court_values()).status_code == 403
    assert db_session.get(Court, court.id).name == "Draft test court"


def test_publish_bounds_grid_overlap_and_hours(db_session, graph):
    owner, _, _, court = graph
    first = courts.publish_slot(
        db_session, owner, court.id, slot_values(8, 60), clock=clock
    )
    last = courts.publish_slot(
        db_session, owner, court.id, slot_values(10, 240), clock=clock
    )
    assert first.end_at - first.start_at == timedelta(minutes=60)
    assert last.end_at - last.start_at == timedelta(minutes=240)
    for values, code in [
        (
            slot_values(8, 60, start_at=start(8, 30), end_at=start(9, 30)),
            "SLOT_OVERLAP",
        ),
        (slot_values(5, 60), "OUTSIDE_HOURS"),
        (slot_values(16, 30), "slot_duration"),
        (slot_values(16, 270), "slot_duration"),
        (slot_values(16, 60, start_at=start(16, 15)), "slot_grid"),
    ]:
        with pytest.raises(HTTPException) as error, db_session.begin_nested():
            courts.publish_slot(db_session, owner, court.id, values, clock=clock)
        assert error.value.detail["code"] == code
    assert (
        len(db_session.scalars(select(Slot).where(Slot.court_id == court.id)).all())
        == 2
    )


def test_slot_day_midnight_and_aware_instants(db_session, graph):
    owner, _, _, court = graph
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
        db_session, owner, court.id, slot_values(23, 60), clock=clock
    )
    assert slot.playing_date == DAY
    with pytest.raises(HTTPException) as error:
        courts.publish_slot(
            db_session, owner, court.id, slot_values(22, 180), clock=clock
        )
    assert error.value.detail["code"] == "slot_date"
    with pytest.raises(HTTPException) as error:
        courts.publish_slot(
            db_session,
            owner,
            court.id,
            slot_values(start_at=datetime(2030, 1, 2, 8)),
            clock=clock,
        )
    assert error.value.status_code == 422


def test_effective_availability_block_maintenance_unpublish_and_past(db_session, graph):
    owner, _, _, court = graph
    available = courts.publish_slot(
        db_session, owner, court.id, slot_values(8), clock=clock
    )
    blocked = courts.publish_slot(
        db_session, owner, court.id, slot_values(10, blocked=True), clock=clock
    )
    maintenance_slot = courts.publish_slot(
        db_session, owner, court.id, slot_values(12), clock=clock
    )
    unpublished = courts.publish_slot(
        db_session, owner, court.id, slot_values(14), clock=clock
    )
    courts.update_slot(
        db_session, owner, unpublished.id, {"published": False}, clock=clock
    )
    maintenance = courts.add_maintenance(
        db_session,
        owner,
        court.id,
        {"start_at": start(12, 30), "end_at": start(13)},
        clock=clock,
    )
    response = courts.availability(db_session, court.id, DAY, clock=clock)
    states = {row["id"]: row["status"] for row in response["slots"]}
    assert states == {
        available.id: "AVAILABLE",
        blocked.id: "BLOCKED",
        maintenance_slot.id: "BLOCKED",
    }
    assert response["maintenance"][0]["id"] == maintenance.id
    states = {
        row["id"]: row["status"]
        for row in courts.availability(
            db_session, court.id, DAY, clock=lambda _: start(8)
        )["slots"]
    }
    assert states[available.id] == "UNAVAILABLE"
    courts.remove_maintenance(db_session, owner, maintenance.id, clock=clock)
    assert db_session.get(MaintenanceBlock, maintenance.id) is None


def test_protected_booking_preserves_slot_schedule_price_and_status(db_session, graph):
    owner, _, player, court = graph
    slot = courts.publish_slot(db_session, owner, court.id, slot_values(), clock=clock)
    booking = Booking(
        court_id=court.id,
        player_id=player.id,
        start_at=slot.start_at,
        end_at=slot.end_at,
        status="CONFIRMED",
        total_price_vnd=100_000,
    )
    db_session.add(booking)
    db_session.flush()
    operations = [
        lambda: courts.update_slot(
            db_session, owner, slot.id, {"price_vnd": 200_000}, clock=clock
        ),
        lambda: courts.update_slot(
            db_session, owner, slot.id, {"published": False}, clock=clock
        ),
        lambda: courts.replace_hours(db_session, owner, court.id, [], clock=clock),
        lambda: courts.add_maintenance(
            db_session,
            owner,
            court.id,
            {"start_at": start(8, 30), "end_at": start(9, 30)},
            clock=clock,
        ),
    ]
    for operation in operations:
        with pytest.raises(HTTPException), db_session.begin_nested():
            operation()
    assert db_session.get(Slot, slot.id).price_vnd == 100_000
    assert db_session.get(Slot, slot.id).published is True
    assert db_session.get(Booking, booking.id).status == "CONFIRMED"
    assert db_session.get(OperatingHours, (court.id, DAY.weekday())).opens_minute == 360
    courts.update_court(db_session, owner, court.id, {"active": False}, clock=clock)
    assert booking.status == "CONFIRMED"
    with pytest.raises(HTTPException) as error:
        courts.public_court(db_session, court.id)
    assert error.value.status_code == 404


@pytest.mark.parametrize(
    "windows",
    [
        [{"weekday": 7, "opens_minute": 0, "closes_minute": 1440}],
        [{"weekday": 1, "opens_minute": -1, "closes_minute": 600}],
        [{"weekday": 1, "opens_minute": 600, "closes_minute": 600}],
        [{"weekday": 1, "opens_minute": 0, "closes_minute": 1440}] * 2,
    ],
)
def test_invalid_hours_preserve_existing_schedule(db_session, graph, windows):
    owner, _, _, court = graph
    with pytest.raises(HTTPException):
        courts.replace_hours(db_session, owner, court.id, windows, clock=clock)
    assert db_session.get(OperatingHours, (court.id, 1)).opens_minute == 360


def test_bookable_slot_edits_bump_versions_and_reject_new_maintenance(
    db_session, graph
):
    owner, other, player, court = graph
    slot = courts.publish_slot(db_session, owner, court.id, slot_values(), clock=clock)
    old_court_version, old_slot_version = court.version, slot.version
    courts.update_slot(db_session, owner, slot.id, {"price_vnd": 150_000}, clock=clock)
    assert court.version == old_court_version + 1
    assert slot.version == old_slot_version + 1
    assert slot.price_vnd == 150_000
    for actor in (other, player):
        with pytest.raises(HTTPException) as error:
            courts.update_slot(
                db_session, actor, slot.id, {"blocked": True}, clock=clock
            )
        assert error.value.status_code == 403
    courts.add_maintenance(
        db_session,
        owner,
        court.id,
        {"start_at": start(10), "end_at": start(11)},
        clock=clock,
    )
    with pytest.raises(HTTPException) as error:
        courts.publish_slot(db_session, owner, court.id, slot_values(10), clock=clock)
    assert error.value.detail["code"] == "MAINTENANCE_CONFLICT"


def test_rejected_slot_edit_does_not_dirty_row_or_autoflush_on_next_query(
    db_session, graph
):
    owner, _, _, court = graph
    first = courts.publish_slot(
        db_session, owner, court.id, slot_values(8), clock=clock
    )
    courts.publish_slot(db_session, owner, court.id, slot_values(10), clock=clock)
    original = (
        first.start_at,
        first.end_at,
        first.price_vnd,
        first.version,
        court.version,
    )
    with pytest.raises(HTTPException) as error:
        courts.update_slot(
            db_session,
            owner,
            first.id,
            {"start_at": start(10, 30), "end_at": start(11, 30), "price_vnd": 200_000},
            clock=clock,
        )
    assert error.value.detail["code"] == "SLOT_OVERLAP"
    # This SELECT can autoflush: rejection must leave the Session safe even if a
    # caller catches the service's HTTPException inside its own transaction.
    saved = db_session.scalar(
        select(Slot)
        .where(Slot.id == first.id)
        .execution_options(populate_existing=True)
    )
    assert (
        saved.start_at,
        saved.end_at,
        saved.price_vnd,
        saved.version,
        court.version,
    ) == original


def test_non_grid_operating_hours_still_allow_grid_aligned_slots(db_session, graph):
    owner, _, _, court = graph
    courts.replace_hours(
        db_session,
        owner,
        court.id,
        [{"weekday": DAY.weekday(), "opens_minute": 375, "closes_minute": 1325}],
        clock=clock,
    )
    slot = courts.publish_slot(db_session, owner, court.id, slot_values(8), clock=clock)
    assert slot.start_at == start(8)
