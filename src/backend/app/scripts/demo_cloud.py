"""Publish a verified CourtMate catalogue from an isolated local PostgreSQL DB."""

import argparse
import json
import os
from pathlib import Path

import firebase_admin
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.database_urls import local_host, postgres_url
from app.db.models import Court, User
from app.db.readiness import check_schema
from app.db.session import build_engine
from app.scripts.demo_seed import (
    DEMO_LOGINS,
    OWNER_COUNT,
    PLAYER_COUNT,
    PREFIX,
    fixture_id,
    read_catalog,
)
from app.scripts.demo_verify import verify_catalog

HOST = "ep-royal-dawn-aole8zkc.c-2.ap-southeast-1.aws.neon.tech"
DATABASE = "neondb"
PROJECT = "courtmate-t05-nexora"
TARGET = f"{HOST}/{DATABASE}@{PROJECT}"
ORIGIN = "https://courtmate-court-mate.vercel.app"
COURTS = "court_id = ANY(:ids)"
BOOKINGS = "booking_id IN (SELECT id FROM bookings WHERE " + COURTS + ")"
SLOTS = "slot_id IN (SELECT id FROM slots WHERE " + COURTS + ")"
TABLES = {
    "users": "id = ANY(:user_ids)",
    "courts": "id = ANY(:ids)",
    "operating_hours": COURTS,
    "slots": COURTS,
    "maintenance_blocks": COURTS,
    "bookings": COURTS,
    "booking_slots": BOOKINGS,
    "slot_claims": BOOKINGS,
    "rooms": BOOKINGS,
    "room_members": "room_id IN (SELECT id FROM rooms WHERE " + BOOKINGS + ")",
    "slot_offers": SLOTS,
}


def validate_scope(source: str, target: str) -> None:
    local = postgres_url(source, "COURTMATE_DEMO_SOURCE_URL")
    cloud = postgres_url(target, "COURTMATE_DEMO_CLOUD_URL")
    if not local_host(local.host or "") or not (local.database or "").startswith(
        "courtmate_demo_"
    ):
        raise SystemExit("Use a dedicated local courtmate_demo_* source.")
    if (
        cloud.host != HOST
        or cloud.database != DATABASE
        or cloud.port not in (5432, None)
        or os.environ.get("FIREBASE_AUTH_EMULATOR_HOST")
    ):
        raise SystemExit(
            "Cloud mode requires the pinned Neon target and real Firebase."
        )


def snapshot(source: str, ids: list, expected_users: dict) -> dict:
    engine = build_engine(source)
    try:
        with Session(engine) as session:
            session.execute(
                text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
            )
            check_schema(session.connection())
            report = verify_catalog(session, ids)
            users = dict(
                session.execute(
                    select(User.id, User.firebase_uid).where(
                        User.id.in_(expected_users)
                    )
                ).all()
            )
            images = session.scalars(select(Court.photo_urls).where(Court.id.in_(ids)))
            if (
                users != expected_users
                or report["courts"] != len(ids)
                or report["future_slots"] < 5_000
                or report["violations"]
                or any(
                    not photos
                    or any(
                        not url.startswith(ORIGIN + "/images/demo/") for url in photos
                    )
                    for photos in images
                )
            ):
                raise SystemExit(
                    "The isolated source is incomplete or failed validation."
                )
            return {
                name: session.scalar(
                    text(
                        f"SELECT coalesce(jsonb_agg(to_jsonb(row)), '[]') "
                        f"FROM public.{name} row WHERE {scope}"
                    ),
                    {"ids": ids, "user_ids": list(expected_users)},
                )
                for name, scope in TABLES.items()
            }
    finally:
        engine.dispose()


def validate_existing(session: Session, rows: dict, expected_users: dict) -> None:
    for uid, firebase_uid, role in session.execute(
        select(User.id, User.firebase_uid, User.role).where(
            User.id.in_(expected_users) | User.firebase_uid.startswith(PREFIX)
        )
    ):
        if expected_users.get(uid) != firebase_uid or not firebase_uid.startswith(
            f"{PREFIX}{role}-"
        ):
            raise SystemExit(
                "An existing identity conflicts with the reserved namespace."
            )
    owners = {row["id"]: row["owner_id"] for row in rows["courts"]}
    for court_id, owner_id in session.execute(
        select(Court.id, Court.owner_id).where(Court.id.in_(owners))
    ):
        if owners[str(court_id)] != str(owner_id):
            raise SystemExit("An existing court conflicts with the reserved namespace.")


def insert_records(session: Session, rows: dict) -> dict[str, int]:
    added = {}
    for name in TABLES:
        added[name] = session.execute(
            text(
                f"INSERT INTO public.{name} SELECT * FROM jsonb_populate_recordset("
                f"NULL::public.{name}, CAST(:rows AS jsonb)) ON CONFLICT DO NOTHING"
            ),
            {"rows": json.dumps(rows[name], ensure_ascii=False)},
        ).rowcount
    return added


def run(
    *,
    apply: bool,
    recovery_point: Path | None,
    firebase_app: firebase_admin.App | None = None,
) -> None:
    source = os.environ.get("COURTMATE_DEMO_SOURCE_URL", "")
    target = os.environ.get("COURTMATE_DEMO_CLOUD_URL", "")
    validate_scope(source, target)
    ids = [fixture_id(row["key"]) for row in read_catalog()]
    keys = [f"owner-{n:02}" for n in range(1, OWNER_COUNT + 1)] + [
        f"player-{n:02}" for n in range(1, PLAYER_COUNT + 1)
    ]
    expected_users = {fixture_id(key): PREFIX + key for key in keys}
    rows = snapshot(source, ids, expected_users)
    login_emails = {PREFIX + key: cloud_email(key) for key in DEMO_LOGINS}
    for row in rows["users"]:
        row["registration_email"] = login_emails.get(row["firebase_uid"])
    engine = build_engine(target)
    try:
        with Session(engine) as session, session.begin():
            if not apply:
                session.execute(text("SET TRANSACTION READ ONLY"))
            check_schema(session.connection())
            validate_existing(session, rows, expected_users)
            before = verify_catalog(session, ids)
            if not apply:
                print(
                    json.dumps(
                        {
                            "target": TARGET,
                            "mode": "dry-run",
                            "existing_demo_courts": before["courts"],
                            "source_counts": {
                                name: len(items) for name, items in rows.items()
                            },
                            "required_firebase_logins": len(DEMO_LOGINS),
                        }
                    )
                )
                return
            if not firebase_app or firebase_app.project_id != PROJECT:
                raise SystemExit(
                    "Firebase credential must target the pinned cloud project."
                )
            assert recovery_point is not None
            session.execute(text("SELECT pg_advisory_xact_lock(3447541)"))
            validate_existing(session, rows, expected_users)
            timestamp = session.scalar(text("SELECT clock_timestamp()"))
            with recovery_point.open("x", encoding="utf-8") as evidence:
                json.dump(
                    {"target": TARGET, "point_in_time_utc": timestamp.isoformat()},
                    evidence,
                )
            provision_cloud(firebase_app)
            added = insert_records(session, rows)
            report = verify_catalog(session, ids)
            if report["violations"] or report["courts"] != len(ids):
                raise RuntimeError(
                    f"Cloud import failed invariant checks: {report['violations']}"
                )
            if before["courts"] == 0 and any(
                added[name] != len(rows[name]) for name in added
            ):
                raise RuntimeError(
                    "Initial cloud import encountered an existing row conflict."
                )
        print(json.dumps({"target": TARGET, "inserted": added, "validation": report}))
    finally:
        engine.dispose()


def cloud_email(key: str) -> str:
    return f"cloud-{key}@courtmate.test"


def provision_cloud(app: firebase_admin.App) -> None:
    from firebase_admin import auth

    source = Path(os.environ["COURTMATE_DEMO_PASSWORD_FILE"])
    if source.stat().st_mode & 0o077:
        raise SystemExit("Use a private password file with permissions 0600.")
    passwords = json.loads(source.read_text())
    if (
        set(passwords) != set(DEMO_LOGINS)
        or any(
            not isinstance(password, str) or len(password) < 20
            for password in passwords.values()
        )
        or len(set(passwords.values())) != len(DEMO_LOGINS)
    ):
        raise SystemExit(
            "Use five distinct strong passwords, keyed by the demo login names."
        )
    for key in DEMO_LOGINS:
        uid = PREFIX + key
        email = cloud_email(key)
        try:
            record = auth.get_user(uid, app=app)
        except auth.UserNotFoundError:
            auth.create_user(uid=uid, email=email, password=passwords[key], app=app)
        else:
            if record.email != email or record.disabled:
                raise RuntimeError(
                    f"Existing demo account {key} requires operator review."
                )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm-target")
    parser.add_argument("--recovery-point", type=Path)
    args = parser.parse_args()
    app = None
    if args.apply:
        if args.confirm_target != TARGET or args.recovery_point is None:
            parser.error(
                "--apply needs the exact --confirm-target and --recovery-point"
            )
        app = firebase_admin.initialize_app(options={"projectId": PROJECT})
    run(apply=args.apply, recovery_point=args.recovery_point, firebase_app=app)


if __name__ == "__main__":
    main()
