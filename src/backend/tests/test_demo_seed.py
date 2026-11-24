from datetime import timedelta
from pathlib import Path

import pytest
from pydantic import SecretStr
from sqlalchemy import select

from app.core.settings import Settings
from app.db.models import Court, User
from app.scripts import demo_seed
from app.scripts.demo_verify import verify_catalog
from app.services.common import database_now


def test_catalog_has_public_addresses_and_sport_specific_assets():
    rows = demo_seed.read_catalog()
    images = Path(__file__).resolve().parents[2] / "frontend/public/images/demo"
    assert 60 <= len(rows) <= 100
    assert set(r["sport"] for r in rows) == set(demo_seed.SPORTS)
    assert len({(r["name"], r["address"]) for r in rows}) == len(rows)
    for sport in demo_seed.SPORTS.values():
        for variant in (1, 2):
            image = images / f"{sport[0]}-{variant}.webp"
            assert 1_000 < image.stat().st_size < 100_000


@pytest.mark.parametrize(
    "url, project",
    [
        ("postgresql://demo@remote.invalid/courtmate_demo_demo", "demo-courtmate"),
        ("postgresql://demo@localhost/courtmate_test", "demo-courtmate"),
        ("postgresql://demo@localhost/courtmate_demo_demo", "courtmate-production"),
    ],
)
def test_demo_seed_refuses_unapproved_targets(url, project):
    settings = Settings(
        _env_file=None,
        app_env="local",
        database_url=SecretStr(url),
        firebase_project_id=project,
        firebase_auth_emulator_host="127.0.0.1:9099",
    )
    with pytest.raises(SystemExit, match="localhost courtmate_demo"):
        demo_seed.validate_target(settings)


def test_catalog_seed_is_repeatable_and_preserves_user_edits(db_session):
    session = db_session
    rows = demo_seed.read_catalog()[:4]
    origin = "http://localhost:5173"
    now = database_now(session)
    ids = demo_seed.seed_catalog(session, rows, origin, now)
    first = verify_catalog(session, ids)
    assert first["courts"] == 4
    assert first["rooms"] == 4
    assert first["open_rooms"] == first["full_rooms"] == 1
    assert first["closed_rooms"] == 2
    assert first["maintenance"] == 2
    assert first["bookings"] == 30
    assert first["violations"] == {}
    player = session.get(User, demo_seed.fixture_id("player-01"))
    assert player.display_name == "An · Sáng sớm"
    player.display_name = "An · Tập sau giờ học"

    court = session.get(Court, ids[0])
    court.description = "Updated by the demo Owner."
    session.flush()
    assert demo_seed.seed_catalog(session, rows, origin, now) == ids
    assert verify_catalog(session, ids) == first
    assert player.display_name == "An · Tập sau giờ học"
    assert session.scalar(select(Court.description).where(Court.id == ids[0])) == (
        "Updated by the demo Owner."
    )
    demo_seed.seed_catalog(session, rows, origin, now + timedelta(days=1))
    refreshed = verify_catalog(session, ids)
    assert refreshed["courts"] == first["courts"]
    assert refreshed["published_slots"] > first["published_slots"]
    assert refreshed["violations"] == {}
