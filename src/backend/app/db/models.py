import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('player', 'owner')", name="ck_users_role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True)
    role: Mapped[str] = mapped_column(
        String(16), default="player", server_default="player"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Court(Base):
    __tablename__ = "courts"
    __table_args__ = (
        CheckConstraint("base_price_vnd > 0", name="ck_court_price"),
        CheckConstraint("max_players BETWEEN 2 AND 30", name="ck_court_capacity"),
        CheckConstraint("version > 0", name="ck_court_version"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    sport: Mapped[str] = mapped_column(String(80))
    address: Mapped[str] = mapped_column(String(300))
    area: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(
        String(4000), default="", server_default=""
    )
    contact: Mapped[str] = mapped_column(String(200), default="", server_default="")
    photo_urls: Mapped[list[str]] = mapped_column(
        JSONB, default=list, server_default="[]"
    )
    base_price_vnd: Mapped[int] = mapped_column(BigInteger)
    max_players: Mapped[int] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")


class OperatingHours(Base):
    __tablename__ = "operating_hours"
    __table_args__ = (
        CheckConstraint("weekday BETWEEN 0 AND 6", name="ck_hours_weekday"),
        CheckConstraint(
            "0 <= opens_minute AND opens_minute < closes_minute "
            "AND closes_minute <= 1440",
            name="ck_hours_window",
        ),
    )
    court_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("courts.id"), primary_key=True
    )
    weekday: Mapped[int] = mapped_column(Integer, primary_key=True)
    opens_minute: Mapped[int] = mapped_column(Integer)
    closes_minute: Mapped[int] = mapped_column(Integer)


class Slot(Base):
    __tablename__ = "slots"
    __table_args__ = (
        CheckConstraint("price_vnd > 0", name="ck_slot_price"),
        CheckConstraint("version > 0", name="ck_slot_version"),
        CheckConstraint(
            "end_at >= start_at + interval '60 minutes' "
            "AND end_at <= start_at + interval '240 minutes'",
            name="ck_slot_duration",
        ),
        CheckConstraint(
            "mod(extract(epoch from start_at)::numeric,1800)=0 "
            "AND mod(extract(epoch from end_at)::numeric,1800)=0",
            name="ck_slot_grid",
        ),
        CheckConstraint(
            "playing_date = (start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date "
            "AND end_at <= ((playing_date + 1)::timestamp "
            "AT TIME ZONE 'Asia/Ho_Chi_Minh')",
            name="ck_slot_playing_date",
        ),
        Index("ix_slots_court_start", "court_id", "start_at"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    court_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courts.id"))
    playing_date: Mapped[date] = mapped_column(Date)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    price_vnd: Mapped[int] = mapped_column(BigInteger)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    published: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    blocked: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )


class MaintenanceBlock(Base):
    __tablename__ = "maintenance_blocks"
    __table_args__ = (
        CheckConstraint("end_at > start_at", name="ck_maintenance_interval"),
        Index("ix_maintenance_court_start", "court_id", "start_at"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    court_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courts.id"))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint(
            "status IN ('CONFIRMED', 'CANCELLED')", name="ck_booking_status"
        ),
        CheckConstraint("total_price_vnd > 0", name="ck_booking_total"),
        CheckConstraint(
            "end_at >= start_at + interval '60 minutes' "
            "AND end_at <= start_at + interval '240 minutes'",
            name="ck_booking_duration",
        ),
        CheckConstraint(
            "(status='CONFIRMED' AND cancelled_at IS NULL) "
            "OR (status='CANCELLED' AND cancelled_at IS NOT NULL)",
            name="ck_booking_cancellation",
        ),
        Index("ix_bookings_court_start", "court_id", "start_at"),
        Index("ix_bookings_player_created", "player_id", "created_at"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    court_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courts.id"))
    player_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(
        String(16), default="CONFIRMED", server_default="CONFIRMED"
    )
    total_price_vnd: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp()
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BookingSlot(Base):
    __tablename__ = "booking_slots"
    __table_args__ = (
        UniqueConstraint("booking_id", "position", name="uq_booking_slot_position"),
        CheckConstraint("position BETWEEN 0 AND 3", name="ck_booking_slot_position"),
        CheckConstraint("price_vnd > 0", name="ck_booking_slot_price"),
        CheckConstraint("end_at > start_at", name="ck_booking_slot_interval"),
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id"), primary_key=True
    )
    slot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("slots.id"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    price_vnd: Mapped[int] = mapped_column(BigInteger)
    slot_version: Mapped[int] = mapped_column(Integer)


class SlotClaim(Base):
    __tablename__ = "slot_claims"
    __table_args__ = (
        ForeignKeyConstraint(
            ["booking_id", "slot_id"],
            ["booking_slots.booking_id", "booking_slots.slot_id"],
        ),
    )
    slot_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    booking_id: Mapped[uuid.UUID] = mapped_column(index=True)


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (
        CheckConstraint("capacity BETWEEN 2 AND 60", name="ck_room_capacity"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id"), unique=True
    )
    organizer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    capacity: Mapped[int] = mapped_column(Integer)
    closed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp()
    )


class RoomMember(Base):
    __tablename__ = "room_members"
    room_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rooms.id"), primary_key=True)
    player_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), primary_key=True
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp()
    )
