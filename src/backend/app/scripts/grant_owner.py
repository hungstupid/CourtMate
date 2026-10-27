import argparse

from firebase_admin import auth
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.auth import firebase_app
from app.db.models import User
from app.db.session import get_engine


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Internal operator-only Owner provisioning by Firebase UID."
    )
    parser.add_argument("uid")
    parser.add_argument(
        "--confirm",
        required=True,
        help="Repeat the exact UID to confirm the role grant.",
    )
    args = parser.parse_args()
    if args.confirm != args.uid:
        parser.error("--confirm must match the Firebase UID.")
    user = auth.get_user(args.uid, app=firebase_app())
    if user.disabled:
        raise SystemExit("Cannot grant access to a disabled Firebase identity.")
    with Session(get_engine()) as session, session.begin():
        session.execute(
            insert(User)
            .values(firebase_uid=args.uid, role="owner")
            .on_conflict_do_update(
                index_elements=[User.firebase_uid], set_={"role": "owner"}
            )
        )
        assert (
            session.scalar(select(User.role).where(User.firebase_uid == args.uid))
            == "owner"
        )
    print("Owner role stored in PostgreSQL for the confirmed Firebase UID.")


if __name__ == "__main__":
    main()
