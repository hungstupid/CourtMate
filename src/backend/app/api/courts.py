from datetime import date, datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    StringConstraints,
    model_validator,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import require_owner
from app.db.models import Court, OperatingHours, User
from app.db.session import get_session
from app.services import courts
from app.services.common import Clock, get_clock, lock_court

router = APIRouter(prefix="/api", tags=["courts and availability"])
Database = Annotated[Session, Depends(get_session, scope="function")]
Owner = Annotated[User, Depends(require_owner)]
ServerClock = Annotated[Clock, Depends(get_clock)]
Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)
]
Sport = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
]
Address = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)
]
Area = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
]
Description = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)
]
Contact = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]
Money = Annotated[StrictInt, Field(ge=1, le=courts.MAX_VND)]
Capacity = Annotated[StrictInt, Field(ge=2, le=30)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CourtCreate(Input):
    name: Name
    sport: Sport
    address: Address
    area: Area
    description: Description
    contact: Contact
    photo_urls: list[str] = Field(default_factory=list, max_length=20)
    base_price_vnd: Money
    max_players: Capacity
    active: StrictBool = True


class Patch(Input):
    @model_validator(mode="after")
    def non_null_fields(self):
        if not self.model_fields_set:
            raise ValueError("Supply at least one field to update.")
        if any(getattr(self, name) is None for name in self.model_fields_set):
            raise ValueError("Updated fields cannot be null.")
        return self


class CourtPatch(Patch):
    name: Name | None = None
    sport: Sport | None = None
    address: Address | None = None
    area: Area | None = None
    description: Description | None = None
    contact: Contact | None = None
    photo_urls: list[str] | None = Field(default=None, max_length=20)
    base_price_vnd: Money | None = None
    max_players: Capacity | None = None
    active: StrictBool | None = None


class HoursWindow(Input):
    weekday: Annotated[StrictInt, Field(ge=0, le=6)]
    opens_minute: Annotated[StrictInt, Field(ge=0, le=1439)]
    closes_minute: Annotated[StrictInt, Field(ge=1, le=1440)]


class HoursReplace(Input):
    windows: list[HoursWindow] = Field(max_length=7)


class SlotCreate(Input):
    start_at: AwareDatetime
    end_at: AwareDatetime
    price_vnd: Money
    published: StrictBool = True
    blocked: StrictBool = False


class SlotPatch(Patch):
    start_at: AwareDatetime | None = None
    end_at: AwareDatetime | None = None
    price_vnd: Money | None = None
    published: StrictBool | None = None
    blocked: StrictBool | None = None


class MaintenanceCreate(Input):
    start_at: AwareDatetime
    end_at: AwareDatetime


class CourtResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    sport: str
    address: str
    area: str
    description: str
    contact: str
    photo_urls: list[str]
    base_price_vnd: int
    max_players: int
    active: bool
    version: int


class SlotResponse(BaseModel):
    id: UUID
    court_id: UUID
    playing_date: date
    start_at: datetime
    end_at: datetime
    price_vnd: int
    version: int
    published: bool
    blocked: bool


def hours_response(rows: list[OperatingHours]) -> list[dict[str, int]]:
    return [
        {
            "weekday": row.weekday,
            "opens_minute": row.opens_minute,
            "closes_minute": row.closes_minute,
        }
        for row in rows
    ]


@router.get("/courts", response_model=list[CourtResponse])
def list_courts(
    session: Database,
    q: Annotated[str | None, Query(max_length=150)] = None,
    sport: Annotated[str | None, Query(max_length=80)] = None,
    area: Annotated[str | None, Query(max_length=120)] = None,
):
    query = select(Court).where(Court.active.is_(True))
    if q and q.strip():
        # Treat wildcard characters as literal court-name input.
        query = query.where(Court.name.icontains(q.strip(), autoescape=True))
    if sport:
        query = query.where(Court.sport == sport)
    if area:
        query = query.where(Court.area == area)
    return [
        courts.dump_court(court)
        for court in session.scalars(query.order_by(Court.name, Court.id))
    ]


@router.get("/courts/{court_id}", response_model=CourtResponse)
def court_detail(court_id: UUID, session: Database):
    return courts.dump_court(courts.public_court(session, court_id))


@router.get("/courts/{court_id}/availability")
def court_availability(
    court_id: UUID,
    session: Database,
    clock: ServerClock,
    day: Annotated[date, Query(alias="date")],
):
    return courts.availability(session, court_id, day, clock=clock)


@router.post("/owner/courts", response_model=CourtResponse, status_code=201)
def court_create(payload: CourtCreate, session: Database, owner: Owner):
    return courts.dump_court(courts.create_court(session, owner, payload.model_dump()))


@router.get("/owner/courts", response_model=list[CourtResponse])
def owner_courts(session: Database, owner: Owner):
    return [
        courts.dump_court(court)
        for court in session.scalars(
            select(Court)
            .where(Court.owner_id == owner.id)
            .order_by(Court.name, Court.id)
        )
    ]


@router.get("/owner/courts/{court_id}", response_model=CourtResponse)
def owner_court_detail(court_id: UUID, session: Database, owner: Owner):
    return courts.dump_court(lock_court(session, court_id, owner=owner))


@router.patch("/owner/courts/{court_id}", response_model=CourtResponse)
def court_update(
    court_id: UUID,
    payload: CourtPatch,
    session: Database,
    owner: Owner,
    clock: ServerClock,
):
    return courts.dump_court(
        courts.update_court(
            session,
            owner,
            court_id,
            payload.model_dump(exclude_unset=True),
            clock=clock,
        )
    )


@router.put("/owner/courts/{court_id}/hours")
def hours_replace(
    court_id: UUID,
    payload: HoursReplace,
    session: Database,
    owner: Owner,
    clock: ServerClock,
):
    return hours_response(
        courts.replace_hours(
            session,
            owner,
            court_id,
            [window.model_dump() for window in payload.windows],
            clock=clock,
        )
    )


@router.get("/owner/courts/{court_id}/hours")
def hours_get(court_id: UUID, session: Database, owner: Owner):
    lock_court(session, court_id, owner=owner)
    return hours_response(
        list(
            session.scalars(
                select(OperatingHours)
                .where(OperatingHours.court_id == court_id)
                .order_by(OperatingHours.weekday)
            )
        )
    )


@router.post(
    "/owner/courts/{court_id}/slots", response_model=SlotResponse, status_code=201
)
def slot_publish(
    court_id: UUID,
    payload: SlotCreate,
    session: Database,
    owner: Owner,
    clock: ServerClock,
):
    return courts.dump_slot(
        courts.publish_slot(session, owner, court_id, payload.model_dump(), clock=clock)
    )


@router.patch("/owner/slots/{slot_id}", response_model=SlotResponse)
def slot_update(
    slot_id: UUID,
    payload: SlotPatch,
    session: Database,
    owner: Owner,
    clock: ServerClock,
):
    return courts.dump_slot(
        courts.update_slot(
            session, owner, slot_id, payload.model_dump(exclude_unset=True), clock=clock
        )
    )


@router.post("/owner/courts/{court_id}/maintenance", status_code=201)
def maintenance_create(
    court_id: UUID,
    payload: MaintenanceCreate,
    session: Database,
    owner: Owner,
    clock: ServerClock,
) -> dict[str, Any]:
    block = courts.add_maintenance(
        session, owner, court_id, payload.model_dump(), clock=clock
    )
    return {
        "id": block.id,
        "court_id": block.court_id,
        "start_at": block.start_at,
        "end_at": block.end_at,
    }


@router.delete("/owner/maintenance/{block_id}", status_code=204)
def maintenance_remove(
    block_id: UUID, session: Database, owner: Owner, clock: ServerClock
):
    courts.remove_maintenance(session, owner, block_id, clock=clock)
    return Response(status_code=204)
