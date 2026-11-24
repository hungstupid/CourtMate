"""Repeatable, non-destructive catalogue for an isolated demo database."""

import argparse
import csv
import json
import os
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from random import Random
from urllib.parse import urlsplit
from uuid import UUID, uuid5

from firebase_admin import auth
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.auth import firebase_app
from app.core.database_urls import local_host, postgres_url
from app.core.settings import Settings, get_settings
from app.db.models import (
    Booking,
    Court,
    MaintenanceBlock,
    OperatingHours,
    Slot,
    SlotOffer,
    User,
)
from app.db.readiness import check_schema
from app.db.session import get_engine
from app.scripts.demo_verify import verify_catalog
from app.services import bookings, courts, offers, rooms
from app.services.common import (
    LOCAL_TZ,
    Clock,
    database_now,
    playing_day_bounds,
    slot_state,
)

CATALOG = Path(__file__).with_name("demo_data") / "venues.csv"
NAMESPACE = UUID("344f5741-c2f9-4798-9f62-6d2cc00ad57b")
PREFIX = "courtmate-catalog-"
OWNER_COUNT = 18
PLAYER_COUNT = 128
DAYS_AHEAD = 16
DEMO_LOGINS = ("owner-01", "player-01", "player-02", "player-03", "player-04")
SPORTS = {
    "Bóng đá": ("football", 220_000, 14, "trận bóng đá sân nhỏ theo đội"),
    "Pickleball": ("pickleball", 110_000, 4, "buổi đánh đôi hoặc giao lưu sau giờ làm"),
    "Cầu lông": ("badminton", 75_000, 4, "buổi tập cầu lông theo cặp"),
    "Tennis": ("tennis", 145_000, 4, "lượt đánh đơn hoặc tập cùng bạn"),
    "Bóng rổ": ("basketball", 165_000, 10, "buổi tập ném rổ hoặc đấu giao lưu"),
}
HOURS = (7, 8, 11, 12, 15, 17, 18, 19, 20)
DISCLOSURE = (
    "Địa điểm tham khảo. Ảnh, giờ mở cửa, giá và lịch đặt trên CourtMate "
    "là dữ liệu mô phỏng. Lượt đặt demo không giữ chỗ tại sân thực tế."
)


def fixed_clock(moment: datetime) -> Clock:
    return lambda _: moment


def fixture_id(key: str) -> UUID:
    return uuid5(NAMESPACE, key)


def read_catalog() -> list[dict[str, str]]:
    with CATALOG.open(encoding="utf-8", newline="") as source:
        rows = list(csv.DictReader(source))
    if len({row["key"] for row in rows}) != len(rows) or any(
        row["sport"] not in SPORTS
        or not row["name"]
        or not row["address"]
        or not row["area"]
        or urlsplit(row["source"]).scheme != "https"
        for row in rows
    ):
        raise RuntimeError("Invalid demo venue catalogue.")
    return rows


def validate_target(settings: Settings) -> str:
    db = postgres_url(settings.database_url.get_secret_value())
    if (
        settings.app_env == "production"
        or not local_host(db.host or "")
        or not (db.database or "").startswith("courtmate_demo_")
        or not settings.firebase_project_id.startswith("demo-")
        or not settings.firebase_auth_emulator_host
    ):
        raise SystemExit(
            "Use a localhost courtmate_demo_* database and demo Auth Emulator."
        )
    settings.validate_runtime()
    return db.database


def login_email(key: str) -> str:
    return f"demo-{key}@courtmate.test"


def provision(password: str) -> None:
    app = firebase_app()
    for key in DEMO_LOGINS:
        uid = PREFIX + key
        email = login_email(key)
        try:
            account = auth.get_user(uid, app=app)
        except auth.UserNotFoundError:
            auth.create_user(uid=uid, email=email, password=password, app=app)
        else:
            if account.email != email or account.disabled:
                raise RuntimeError(
                    f"Existing emulator account {key} requires operator review."
                )


def users(session: Session, role: str, count: int) -> list[User]:
    result = []
    role_name = "Chủ sân" if role == "owner" else "Người chơi"
    for number in range(1, count + 1):
        key = f"{role}-{number:02}"
        uid = PREFIX + key
        user = session.get(User, fixture_id(key))
        if user is None:
            user = User(
                id=fixture_id(key),
                firebase_uid=uid,
                role=role,
                display_name=f"{role_name} demo {number:02}",
                registration_email=login_email(key) if key in DEMO_LOGINS else None,
            )
            session.add(user)
        elif user.firebase_uid != uid or user.role != role:
            raise RuntimeError("Demo identity identifier is already in use.")
        result.append(user)
    session.flush()
    return result


def venue(session: Session, row: dict[str, str], owner: User, origin: str) -> Court:
    court_id = fixture_id(row["key"])
    court = session.get(Court, court_id)
    if court is not None:
        if court.owner_id != owner.id:
            raise RuntimeError("Demo venue identifier is already in use.")
        return court

    image, base, capacity, activity = SPORTS[row["sport"]]
    rand = Random(20261124 + int(row["key"].split("-")[1]))
    court = courts.create_court(
        session,
        owner,
        {
            "name": f"{row['name']} · Demo",
            "address": f"{row['address']}, TP.HCM",
            "area": row["area"],
            "sport": row["sport"],
            "base_price_vnd": base + rand.randrange(0, 9) * 10_000,
            "max_players": capacity,
            "description": (
                f"Kịch bản {row['sport'].lower()} tại khu vực {row['area']}, "
                f"phù hợp để thử đặt {activity}. {DISCLOSURE}"
            ),
            "contact": "Dữ liệu demo CourtMate",
            "photo_urls": [f"{origin}/images/demo/{image}-{rand.choice((1, 2))}.webp"],
        },
    )
    court.id = court_id
    session.flush()
    opening = rand.choice((360, 390, 420))
    closing = rand.choice((1260, 1290, 1320))
    courts.replace_hours(
        session,
        owner,
        court.id,
        [
            {"weekday": weekday, "opens_minute": opening, "closes_minute": closing}
            for weekday in range(7)
        ],
    )
    return court


def publish(
    session: Session, court: Court, owner: User, day: date, hours: tuple[int, ...]
) -> dict[int, Slot]:
    start, end = playing_day_bounds(day)
    rows = list(
        session.scalars(
            select(Slot).where(
                Slot.court_id == court.id, Slot.start_at >= start, Slot.start_at < end
            )
        )
    )
    if not rows:
        # A user's existing maintenance, even without slots, takes precedence.
        if (
            session.scalar(
                select(MaintenanceBlock.id)
                .where(
                    MaintenanceBlock.court_id == court.id,
                    MaintenanceBlock.start_at < end,
                    MaintenanceBlock.end_at > start,
                )
                .limit(1)
            )
            is not None
        ):
            return {}
        window = session.get(OperatingHours, (court.id, day.weekday()))
        if window is None:
            return {}
        rows = courts.publish_batch(
            session,
            owner,
            court.id,
            [
                {
                    "start_at": start + timedelta(hours=hour),
                    "end_at": start + timedelta(hours=hour + 1),
                    "price_vnd": court.base_price_vnd
                    + (20_000 if hour >= 17 or day.weekday() >= 5 else 0),
                }
                for hour in hours
                if window.opens_minute <= hour * 60
                and (hour + 1) * 60 <= window.closes_minute
            ],
            clock=lambda _: start - timedelta(days=2),
        )
    return {
        local.hour: slot
        for slot in rows
        if (local := slot.start_at.astimezone(LOCAL_TZ)).minute == 0
    }


def make_booking(
    session: Session, court: Court, player: User, slots: list[Slot], clock_at: datetime
) -> dict | None:
    if any(slot_state(session, court, slot, clock_at) != "AVAILABLE" for slot in slots):
        return None
    start = slots[0].start_at
    end = slots[-1].end_at
    if (
        session.scalar(
            select(Booking.id)
            .where(
                Booking.court_id == court.id,
                Booking.start_at < end,
                Booking.end_at > start,
            )
            .limit(1)
        )
        is not None
    ):
        # Also preserve cancelled bookings, so reruns never regenerate them.
        return None
    ids = [slot.id for slot in slots]
    clock = fixed_clock(clock_at)
    quote = bookings.review_booking(session, player, ids, clock)["quote"]
    return bookings.confirm_booking(session, player, ids, quote, clock)


def past_bookings(
    session: Session,
    court: Court,
    owner: User,
    players: list[User],
    day: date,
    index: int,
) -> None:
    for sample in range(6):
        past = day - timedelta(days=5 + sample * 7 + index % 6)
        rows = publish(session, court, owner, past, (17, 18))
        hours = (17, 18) if (index + sample) % 3 == 0 else (17,)
        if not all(hour in rows for hour in hours):
            continue
        selected = [rows[hour] for hour in hours]
        player = players[
            0 if index % OWNER_COUNT == 0 else (index * 6 + sample) % len(players)
        ]
        before = selected[0].start_at - timedelta(days=1)
        booking = make_booking(session, court, player, selected, before)
        if not booking:
            continue
        if (sample + index) % 5 == 0:
            bookings.cancel_booking(
                session, player, booking["id"], fixed_clock(before + timedelta(hours=8))
            )


def demo_room(
    session: Session,
    booking: dict,
    organizer: User,
    players: list[User],
    court: Court,
    index: int,
    now: datetime,
) -> None:
    full = index % 4 == 1
    capacity = min(4 if full else 6, court.max_players * 2)
    clock = fixed_clock(now)
    room = rooms.create_room(session, organizer, booking["id"], capacity, clock)
    others = [player for player in players[4:] if player.id != organizer.id]
    for offset in range(capacity - 1 if full else 1 + index % 3):
        rooms.join_room(
            session, others[(index * 3 + offset) % len(others)], room["id"], clock
        )
    if index % 4 == 2:
        rooms.close_room(session, organizer, room["id"], clock)
    elif index % 4 == 3:
        bookings.cancel_booking(session, organizer, booking["id"], clock)


def future_activity(
    session: Session,
    court: Court,
    owner: User,
    players: list[User],
    index: int,
    now: datetime,
    by_day: dict[date, dict[int, Slot]],
) -> None:
    tomorrow = now.date() + timedelta(days=1)
    day = tomorrow + timedelta(days=index % 3)
    room_slot = by_day[day].get(17)
    if room_slot:
        organizer = players[4 + index % (len(players) - 4)]
        booking = make_booking(session, court, organizer, [room_slot], now)
        if booking:
            demo_room(session, booking, organizer, players, court, index, now)
    if index == 0:
        for player, hour in zip(players[:2], (18, 19), strict=True):
            slot = by_day[tomorrow].get(hour)
            if slot:
                make_booking(session, court, player, [slot], now)

    maintenance = by_day[tomorrow].get(11)
    if (
        index % 2 == 0
        and maintenance
        and slot_state(session, court, maintenance, now) == "AVAILABLE"
    ):
        courts.add_maintenance(
            session,
            owner,
            court.id,
            {"start_at": maintenance.start_at, "end_at": maintenance.end_at},
            clock=lambda _: now,
        )

    if not get_settings().slot_offers_enabled:
        return
    if index >= 48:
        historical_day = now.date() - timedelta(days=2 + index % 3)
        slot = publish(session, court, owner, historical_day, (12,)).get(12)
        if (
            slot
            and slot_state(session, court, slot, slot.start_at - timedelta(hours=2))
            == "AVAILABLE"
        ):
            if (
                session.scalar(
                    select(SlotOffer.id).where(SlotOffer.slot_id == slot.id).limit(1)
                )
                is None
            ):
                offers.create_offer(
                    session,
                    owner,
                    slot.id,
                    "manual",
                    slot.price_vnd * 3 // 4,
                    Decimal(24),
                    fixed_clock(slot.start_at - timedelta(hours=2)),
                )
            offers.current(session, court, slot, now)
        return
    # There is always a next occurrence within 24h for each of these hours.
    hour = (7, 8, 12, 15, 20)[index % 5]
    start_day = (
        now.date() if (now.hour, now.minute, now.second) < (hour, 0, 0) else tomorrow
    )
    scheduled = index % 4 == 0
    if scheduled:
        start_day = tomorrow + timedelta(days=1)
    slot = by_day[start_day].get(hour)
    if (
        slot is not None
        and slot_state(session, court, slot, now) == "AVAILABLE"
        and session.scalar(
            select(SlotOffer.id).where(SlotOffer.slot_id == slot.id).limit(1)
        )
        is None
    ):
        offers.create_offer(
            session,
            owner,
            slot.id,
            "automatic" if scheduled else "manual",
            slot.price_vnd * 3 // 4,
            Decimal("22.5"),
            lambda _: now,
        )


def seed_catalog(
    session: Session, catalog: list[dict[str, str]], origin: str, now: datetime
) -> list[UUID]:
    session.execute(text("SELECT pg_advisory_xact_lock(3447541)"))
    owners = users(session, "owner", OWNER_COUNT)
    players = users(session, "player", PLAYER_COUNT)
    now = now.astimezone(LOCAL_TZ)
    court_ids = []
    for index, row in enumerate(catalog):
        owner = owners[index % len(owners)]
        court = venue(session, row, owner, origin)
        court_ids.append(court.id)
        if not court.active:
            continue
        past_bookings(session, court, owner, players, now.date(), index)
        days = [now.date() + timedelta(days=offset) for offset in range(DAYS_AHEAD)]
        by_day = {day: publish(session, court, owner, day, HOURS) for day in days}
        future_activity(session, court, owner, players, index, now, by_day)
    return court_ids


def validate_origin(origin: str) -> str:
    url = urlsplit(origin)
    if (
        not url.hostname
        or url.username
        or url.query
        or url.fragment
        or url.path not in ("", "/")
        or not (
            url.scheme == "https" or (url.scheme == "http" and local_host(url.hostname))
        )
    ):
        raise SystemExit("Use an HTTPS web origin or localhost HTTP for illustrations.")
    return origin.rstrip("/")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--apply", action="store_true", help="Write to a verified local demo target."
    )
    mode.add_argument(
        "--verify",
        action="store_true",
        help="Check an existing demo target without writing.",
    )
    parser.add_argument("--web-origin", default="http://localhost:5173")
    args = parser.parse_args()
    catalog = read_catalog()
    origin = validate_origin(args.web_origin)
    if not args.apply and not args.verify:
        print(
            json.dumps(
                {
                    "mode": "dry-run",
                    "courts": len(catalog),
                    "owners": OWNER_COUNT,
                    "players": PLAYER_COUNT,
                    "firebase_accounts": len(DEMO_LOGINS),
                    "days_including_today": DAYS_AHEAD,
                    "image_origin": origin,
                }
            )
        )
        return

    target = validate_target(get_settings())
    court_ids = [fixture_id(row["key"]) for row in catalog]
    with Session(get_engine()) as session, session.begin():
        check_schema(session.connection())
        if args.apply:
            password = os.environ.get("COURTMATE_DEMO_PASSWORD", "")
            if len(password) < 12:
                parser.error(
                    "Set private COURTMATE_DEMO_PASSWORD (at least 12 characters)."
                )
            seed_catalog(session, catalog, origin, database_now(session))
        report = verify_catalog(session, court_ids)
        if report["violations"]:
            raise RuntimeError(f"Demo integrity check failed: {report['violations']}")
    if args.apply:
        # Firebase is a separate system. If provisioning fails, re-run safely.
        provision(password)
    print(json.dumps({"database": target, **report}, ensure_ascii=False))


if __name__ == "__main__":
    main()
