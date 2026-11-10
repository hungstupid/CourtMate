"""Remove only a named browser run's rows from the guarded localhost test DB."""

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src/backend"))
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import (
    Booking,
    BookingSlot,
    Court,
    MaintenanceBlock,
    OperatingHours,
    Room,
    RoomMember,
    Slot,
    SlotClaim,
    SlotOffer,
    User,
)
from app.db.session import build_engine
from app.scripts.reset_test import ensure_test_database


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--marker", required=True)
    marker = parser.parse_args().marker
    if not re.fullmatch(r"e2e-[a-f0-9]{32}", marker):
        raise SystemExit("Expected an exact generated E2E run marker.")
    engine = build_engine(ensure_test_database())
    with Session(engine) as session, session.begin():
        users = list(
            session.scalars(
                select(User.id).where(
                    User.registration_email.startswith(marker + "-", autoescape=True)
                )
            )
        )
        courts = list(
            session.scalars(select(Court.id).where(Court.owner_id.in_(users)))
        )
        bookings = list(
            session.scalars(select(Booking.id).where(Booking.court_id.in_(courts)))
        )
        rooms = list(
            session.scalars(select(Room.id).where(Room.booking_id.in_(bookings)))
        )
        session.execute(delete(RoomMember).where(RoomMember.room_id.in_(rooms)))
        session.execute(delete(Room).where(Room.id.in_(rooms)))
        session.execute(delete(SlotClaim).where(SlotClaim.booking_id.in_(bookings)))
        session.execute(delete(BookingSlot).where(BookingSlot.booking_id.in_(bookings)))
        session.execute(delete(Booking).where(Booking.id.in_(bookings)))
        session.execute(
            delete(SlotOffer).where(
                SlotOffer.slot_id.in_(select(Slot.id).where(Slot.court_id.in_(courts)))
            )
        )
        session.execute(
            delete(MaintenanceBlock).where(MaintenanceBlock.court_id.in_(courts))
        )
        session.execute(delete(Slot).where(Slot.court_id.in_(courts)))
        session.execute(
            delete(OperatingHours).where(OperatingHours.court_id.in_(courts))
        )
        session.execute(delete(Court).where(Court.id.in_(courts)))
        session.execute(delete(User).where(User.id.in_(users)))
    engine.dispose()
    print(
        f"Targeted local browser cleanup: {len(users)} generated accounts, "
        f"{len(courts)} generated courts; existing data preserved."
    )


if __name__ == "__main__":
    main()
