"""Idempotent identity fixtures for the local Auth Emulator only."""

from firebase_admin import auth
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.auth import firebase_app
from app.core.settings import get_settings
from app.db.models import User
from app.db.session import get_engine


def main() -> None:
    settings = get_settings()
    if (
        settings.app_env == "production"
        or not settings.firebase_project_id.startswith("demo-")
        or not settings.firebase_auth_emulator_host
    ):
        raise SystemExit(
            "Seed requires a demo-* Auth Emulator project. Cloud data was not touched."
        )
    for uid, role in [("local-player", "player"), ("local-owner", "owner")]:
        try:
            auth.get_user(uid, app=firebase_app())
        except auth.UserNotFoundError:
            auth.create_user(
                uid=uid,
                email=f"{uid}@courtmate.test",
                password="Local-only-123!",
                app=firebase_app(),
            )
        with Session(get_engine()) as session, session.begin():
            session.execute(
                insert(User)
                .values(firebase_uid=uid, role=role)
                .on_conflict_do_nothing(index_elements=[User.firebase_uid])
            )
    print("Local emulator Player/Owner fixtures are ready; no cloud user was created.")


if __name__ == "__main__":
    main()
