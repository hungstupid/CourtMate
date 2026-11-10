"""Regressions for the 10 November SRS, not the previous draft baseline."""

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from test_core_api import START, create_court
from test_core_api import committed_api as committed_api
from test_identity import emulator_token

from app.db.models import Booking, RoomMember, Slot


def test_initial_roles_are_validated_once_and_profile_cannot_escalate(api_client):
    for role in ["player", "owner"]:
        token, _ = emulator_token()
        headers = {"Authorization": f"Bearer {token}"}
        assert api_client.get("/api/me", headers=headers).status_code == 403
        for invalid in ["admin", ["player", "owner"], None]:
            assert (
                api_client.post(
                    "/api/register", headers=headers, json={"role": invalid}
                ).status_code
                == 422
            )
        registered = api_client.post(
            "/api/register", headers=headers, json={"role": role}
        )
        assert registered.status_code == 201 and registered.json()["role"] == role
        assert (
            api_client.post(
                "/api/register", headers=headers, json={"role": role}
            ).json()["id"]
            == registered.json()["id"]
        )
        other = "owner" if role == "player" else "player"
        assert (
            api_client.post(
                "/api/register", headers=headers, json={"role": other}
            ).status_code
            == 409
        )
        assert (
            api_client.patch(
                "/api/profile",
                headers=headers,
                json={
                    "display_name": "Test",
                    "contact_preferences": "Email only",
                    "role": other,
                },
            ).status_code
            == 422
        )
        valid = {
            "display_name": "  CourtMate user  ",
            "contact_preferences": "Email only",
        }
        assert (
            api_client.patch("/api/profile", headers=headers, json=valid).status_code
            == 200
        )
        profile = api_client.get("/api/profile", headers=headers).json()
        assert profile["display_name"] == "CourtMate user" and profile["role"] == role
        assert profile["registration_email"].endswith("@courtmate.test")
        assert (
            api_client.patch(
                "/api/profile",
                headers=headers,
                json={**valid, "display_name": "x" * 101},
            ).status_code
            == 422
        )
        assert api_client.get("/api/profile", headers=headers).json() == profile


def publish(client, owner, court, hours=1):
    return client.post(
        f"/api/owner/courts/{court}/slots/batch",
        headers=owner,
        json={
            "slots": [
                {
                    "start_at": (START + timedelta(hours=i)).isoformat(),
                    "end_at": (START + timedelta(hours=i + 1)).isoformat(),
                    "price_vnd": 120_000,
                }
                for i in range(hours)
            ]
        },
    )


def test_search_address_optional_bounds_preview_and_atomic_batch(
    committed_api, database_engine
):
    client, actor = committed_api
    owner = actor("owner")
    court = create_court(client, owner)
    assert (
        client.patch(
            f"/api/owner/courts/{court}",
            headers=owner,
            json={"address": "12 Đường số 8, Thủ Đức", "area": "Thủ Đức"},
        ).status_code
        == 200
    )
    published = publish(client, owner, court, 4)
    assert published.status_code == 201 and len(published.json()) == 4
    bounds = {
        "start": (START + timedelta(hours=1)).isoformat(),
        "end": (START + timedelta(hours=3)).isoformat(),
    }
    assert any(
        c["id"] == court
        for c in client.get(
            "/api/courts", params={"area": "  thủ đức  ", **bounds}
        ).json()
    )
    for params, count in [
        ({}, 4),
        (bounds, 2),
        ({"start": bounds["start"]}, 3),
        ({"end": bounds["end"]}, 3),
    ]:
        rows = client.get(f"/api/courts/{court}/preview", params=params).json()["slots"]
        assert len(rows) == count and all(row["status"] == "AVAILABLE" for row in rows)
    assert (
        client.get(
            "/api/courts", params={"start": bounds["end"], "end": bounds["start"]}
        ).status_code
        == 422
    )
    assert client.get("/api/courts", params={"start": "invalid"}).status_code == 422
    assert not any(
        c["id"] == court
        for c in client.get(
            "/api/courts", params={"area": "no-matching-location"}
        ).json()
    )
    # A valid first row and conflicting second row must publish nothing.
    result = client.post(
        f"/api/owner/courts/{court}/slots/batch",
        headers=owner,
        json={
            "slots": [
                {
                    "start_at": (START + timedelta(hours=5)).isoformat(),
                    "end_at": (START + timedelta(hours=6)).isoformat(),
                    "price_vnd": 120_000,
                },
                {
                    "start_at": START.isoformat(),
                    "end_at": (START + timedelta(hours=1)).isoformat(),
                    "price_vnd": 120_000,
                },
            ]
        },
    )
    assert result.status_code == 409
    with Session(database_engine) as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(Slot)
                .where(Slot.court_id == uuid.UUID(court))
            )
            == 4
        )


@pytest.mark.parametrize("capacity", [2, 3])
def test_manual_room_closure_preserves_membership_and_booking(
    committed_api, database_engine, capacity
):
    client, actor = committed_api
    owner, organizer, member, stranger = [
        actor(role) for role in ["owner", "player", "player", "player"]
    ]
    court = create_court(client, owner)
    slot = publish(client, owner, court).json()[0]
    selection = {"slot_ids": [slot["id"]]}
    quote = client.post(
        "/api/bookings/review", headers=organizer, json=selection
    ).json()
    booking = client.post(
        "/api/bookings", headers=organizer, json={**selection, "quote": quote["quote"]}
    ).json()
    room = client.post(
        f"/api/bookings/{booking['id']}/room",
        headers=organizer,
        json={"capacity": capacity},
    ).json()
    path = f"/api/rooms/{room['id']}"
    assert client.post(path + "/join", headers=member).status_code == 200
    for headers in [{}, owner, stranger, member]:
        assert client.post(path + "/close", headers=headers).status_code in [401, 403]
    before = client.get(f"/api/bookings/{booking['id']}", headers=organizer).json()
    assert client.get(path + "/membership", headers=member).json()["is_member"] is True
    closed = client.post(path + "/close", headers=organizer)
    assert closed.status_code == 200 and closed.json()["status"] == "CLOSED"
    assert closed.json()["member_count"] == 2
    assert client.post(path + "/close", headers=organizer).json() == closed.json()
    assert (
        client.get(f"/api/bookings/{booking['id']}", headers=organizer).json() == before
    )
    assert client.post(path + "/join", headers=stranger).status_code == 409
    assert client.post(path + "/leave", headers=member).status_code == 409
    assert (
        client.post(
            f"/api/bookings/{booking['id']}/room",
            headers=organizer,
            json={"capacity": capacity},
        ).status_code
        == 409
    )
    assert client.get("/api/rooms", params={"location": "test ADDRESS"}).json()
    assert not client.get(
        "/api/rooms", params={"location": "nothing-matches-here"}
    ).json()
    with Session(database_engine) as session:
        assert session.get(Booking, uuid.UUID(booking["id"])).status == "CONFIRMED"
        assert (
            session.scalar(
                select(func.count())
                .select_from(RoomMember)
                .where(RoomMember.room_id == uuid.UUID(room["id"]))
            )
            == 2
        )
