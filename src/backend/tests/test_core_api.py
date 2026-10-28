"""Real Firebase Emulator → HTTP → committed PostgreSQL business flow."""

import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.db import session as database
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
from app.main import app
from app.services.common import get_clock

NOW = datetime(2035, 1, 1, tzinfo=UTC)
START = datetime(2035, 1, 2, 1, tzinfo=UTC)  # 08:00 in Vietnam.


@pytest.fixture
def committed_api(database_engine, monkeypatch):
    monkeypatch.setattr(database, "get_engine", lambda: database_engine)
    app.dependency_overrides[get_clock] = lambda: lambda session: NOW
    user_ids, tokens = [], []
    host = get_settings().firebase_auth_emulator_host
    with TestClient(app) as client:

        def actor(role):
            response = httpx.post(
                f"http://{host}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
                json={
                    "email": f"api-core-{uuid.uuid4().hex}@courtmate.test",
                    "password": "Local-api-only-123!",
                    "returnSecureToken": True,
                },
            )
            assert response.status_code == 200
            token = response.json()["idToken"]
            headers = {"Authorization": f"Bearer {token}"}
            result = client.get("/api/me", headers=headers)
            assert result.status_code == 200
            identity = uuid.UUID(result.json()["id"])
            user_ids.append(identity)
            tokens.append(token)
            with Session(database_engine) as session, session.begin():
                session.get(User, identity).role = role
            return headers

        try:
            yield client, actor
        finally:
            app.dependency_overrides.pop(get_clock, None)
            with Session(database_engine) as session, session.begin():
                court_ids = list(
                    session.scalars(
                        select(Court.id).where(Court.owner_id.in_(user_ids))
                    )
                )
                booking_ids = list(
                    session.scalars(
                        select(Booking.id).where(Booking.court_id.in_(court_ids))
                    )
                )
                if "rooms" in Base.metadata.tables:
                    rooms = Base.metadata.tables["rooms"]
                    members = Base.metadata.tables["room_members"]
                    room_ids = list(
                        session.scalars(
                            select(rooms.c.id).where(
                                rooms.c.booking_id.in_(booking_ids)
                            )
                        )
                    )
                    session.execute(
                        delete(members).where(members.c.room_id.in_(room_ids))
                    )
                    session.execute(delete(rooms).where(rooms.c.id.in_(room_ids)))
                session.execute(
                    delete(SlotClaim).where(SlotClaim.booking_id.in_(booking_ids))
                )
                session.execute(
                    delete(BookingSlot).where(BookingSlot.booking_id.in_(booking_ids))
                )
                session.execute(delete(Booking).where(Booking.id.in_(booking_ids)))
                session.execute(
                    delete(MaintenanceBlock).where(
                        MaintenanceBlock.court_id.in_(court_ids)
                    )
                )
                session.execute(delete(Slot).where(Slot.court_id.in_(court_ids)))
                session.execute(
                    delete(OperatingHours).where(OperatingHours.court_id.in_(court_ids))
                )
                session.execute(delete(Court).where(Court.id.in_(court_ids)))
                session.execute(delete(User).where(User.id.in_(user_ids)))
            for token in tokens:
                httpx.post(
                    f"http://{host}/identitytoolkit.googleapis.com/v1/accounts:delete?key=demo-key",
                    json={"idToken": token},
                )


def create_court(client, owner):
    response = client.post(
        "/api/owner/courts",
        headers=owner,
        json={
            "name": "API fixture",
            "sport": "badminton",
            "address": "Test address",
            "area": "Test area",
            "description": "Local fixture only",
            "contact": "Test venue",
            "base_price_vnd": 100_000,
            "max_players": 8,
        },
    )
    assert response.status_code == 201, response.text
    court_id = response.json()["id"]
    response = client.put(
        f"/api/owner/courts/{court_id}/hours",
        headers=owner,
        json={
            "windows": [
                {"weekday": day, "opens_minute": 0, "closes_minute": 1440}
                for day in range(7)
            ],
        },
    )
    assert response.status_code == 200, response.text
    return court_id


def test_real_http_owner_to_player_booking_cancel_and_rebook(
    committed_api, database_engine
):
    client, actor = committed_api
    owner, player, other_owner, other_player = (
        actor(role) for role in ["owner", "player", "owner", "player"]
    )
    court_id = create_court(client, owner)
    slots = []
    for i, price in enumerate([100_000, 120_000]):
        response = client.post(
            f"/api/owner/courts/{court_id}/slots",
            headers=owner,
            json={
                "start_at": (START + timedelta(hours=i)).isoformat(),
                "end_at": (START + timedelta(hours=i + 1)).isoformat(),
                "price_vnd": price,
            },
        )
        assert response.status_code == 201, response.text
        slots.append(response.json()["id"])
    availability = client.get(
        f"/api/courts/{court_id}/availability", params={"date": "2035-01-02"}
    )
    assert availability.status_code == 200
    review = client.post(
        "/api/bookings/review", headers=player, json={"slot_ids": slots}
    )
    assert review.status_code == 200, review.text
    quote = review.json()
    assert quote["total_price_vnd"] == 220_000
    assert quote["duration_minutes"] == 120
    with Session(database_engine) as observer:
        assert (
            observer.scalar(
                select(func.count())
                .select_from(Booking)
                .where(Booking.court_id == uuid.UUID(court_id))
            )
            == 0
        )
    payload = {"slot_ids": slots, "quote": quote["quote"]}
    assert client.post("/api/bookings", headers=owner, json=payload).status_code == 403
    assert (
        client.post(
            "/api/bookings",
            headers=player,
            json={**payload, "total_price_vnd": 1, "role": "owner"},
        ).status_code
        == 422
    )
    response = client.post("/api/bookings", headers=player, json=payload)
    assert response.status_code == 201, response.text
    booking = response.json()
    assert booking["total_price_vnd"] == 220_000 and len(booking["slots"]) == 2
    with Session(database_engine) as observer:
        assert observer.get(Booking, uuid.UUID(booking["id"])).status == "CONFIRMED"
    assert client.post("/api/bookings", headers=player, json=payload).status_code == 409
    assert client.get("/api/bookings", headers=player).json()[0]["id"] == booking["id"]
    assert (
        client.get(f"/api/bookings/{booking['id']}", headers=other_player).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/owner/bookings/{booking['id']}", headers=other_owner
        ).status_code
        == 403
    )
    details = client.get(f"/api/owner/bookings/{booking['id']}", headers=owner)
    assert details.status_code == 200
    assert "firebase_uid" not in details.text and "email" not in details.text
    for method, path, json_body in [
        ("patch", f"/api/owner/slots/{slots[0]}", {"price_vnd": 5}),
        (
            "post",
            f"/api/owner/courts/{court_id}/maintenance",
            {
                "start_at": START.isoformat(),
                "end_at": (START + timedelta(hours=1)).isoformat(),
            },
        ),
    ]:
        assert (
            getattr(client, method)(path, headers=owner, json=json_body).status_code
            == 409
        )
    assert (
        client.patch(
            f"/api/owner/courts/{court_id}", headers=other_owner, json={"active": False}
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/owner/courts/{court_id}", headers=player, json={"active": False}
        ).status_code
        == 403
    )
    cancelled = client.post(f"/api/bookings/{booking['id']}/cancel", headers=player)
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "CANCELLED"
    assert (
        client.post(f"/api/bookings/{booking['id']}/cancel", headers=player).status_code
        == 409
    )
    quote = client.post(
        "/api/bookings/review", headers=player, json={"slot_ids": slots}
    ).json()
    response = client.post(
        "/api/bookings",
        headers=player,
        json={"slot_ids": slots, "quote": quote["quote"]},
    )
    assert response.status_code == 201 and response.json()["id"] != booking["id"]
    assert len(client.get("/api/bookings", headers=player).json()) == 2
    assert client.get("/api/bookings").status_code == 401


def test_real_http_public_room_player_membership_and_atomic_cancel(
    committed_api, database_engine
):
    client, actor = committed_api
    owner, organizer, member = (actor(role) for role in ["owner", "player", "player"])
    court_id = create_court(client, owner)
    slot = client.post(
        f"/api/owner/courts/{court_id}/slots",
        headers=owner,
        json={
            "start_at": START.isoformat(),
            "end_at": (START + timedelta(hours=1)).isoformat(),
            "price_vnd": 100_001,
        },
    )
    assert slot.status_code == 201
    selection = {"slot_ids": [slot.json()["id"]]}
    review = client.post(
        "/api/bookings/review", headers=organizer, json=selection
    ).json()
    booking = client.post(
        "/api/bookings", headers=organizer, json={**selection, "quote": review["quote"]}
    ).json()
    path = f"/api/bookings/{booking['id']}/room"
    assert client.post(path, headers=owner, json={"capacity": 2}).status_code == 403
    assert client.post(path, headers=member, json={"capacity": 2}).status_code == 403
    assert (
        client.post(path, headers=organizer, json={"capacity": 2.5}).status_code == 422
    )
    created = client.post(path, headers=organizer, json={"capacity": 2})
    assert created.status_code == 201, created.text
    room = created.json()
    assert room["member_count"] == 1 and room["status"] == "OPEN"
    assert client.post(path, headers=organizer, json={"capacity": 2}).status_code == 409
    room_path = f"/api/rooms/{room['id']}"
    public = client.get(room_path)
    assert public.status_code == 200 and "firebase_uid" not in public.text
    assert any(x["id"] == room["id"] for x in client.get("/api/rooms").json())
    assert client.post(room_path + "/join", headers=owner).status_code == 403
    assert client.post(room_path + "/join").status_code == 401
    joined = client.post(room_path + "/join", headers=member)
    assert joined.status_code == 200 and joined.json()["status"] == "FULL"
    assert joined.json()["estimated_share_vnd"] == 50_001
    assert client.post(room_path + "/join", headers=member).status_code == 409
    assert client.post(room_path + "/leave", headers=organizer).status_code == 409
    left = client.post(room_path + "/leave", headers=member)
    assert left.status_code == 200 and left.json()["status"] == "OPEN"
    assert client.post(room_path + "/join", headers=member).status_code == 200
    # Persist closure on the rejected start-time request, including a later
    # clock correction. Only this injected test clock moves, never system time.
    app.dependency_overrides[get_clock] = lambda: lambda session: START
    assert client.post(room_path + "/leave", headers=member).status_code == 409
    app.dependency_overrides[get_clock] = lambda: lambda session: NOW
    assert client.get(room_path).json()["status"] == "CLOSED"
    cancelled = client.post(f"/api/bookings/{booking['id']}/cancel", headers=organizer)
    assert cancelled.status_code == 200
    public = client.get(room_path).json()
    assert public["status"] == "CLOSED" and public["member_count"] == 2
    assert client.post(room_path + "/leave", headers=member).status_code == 409
    assert client.post(room_path + "/join", headers=member).status_code == 409
    from app.db.models import Room

    with Session(database_engine) as observer:
        assert observer.get(Room, uuid.UUID(room["id"])).closed is True
        assert (
            observer.scalar(
                select(func.count())
                .select_from(SlotClaim)
                .where(SlotClaim.booking_id == uuid.UUID(booking["id"]))
            )
            == 0
        )
