from collections.abc import Generator
from functools import lru_cache

import certifi
from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core.settings import get_settings


def normalize_url(value: str) -> str:
    url = make_url(value)
    if url.get_backend_name() != "postgresql":
        raise ValueError("CourtMate requires PostgreSQL.")
    return url.set(drivername="postgresql+psycopg").render_as_string(
        hide_password=False
    )


def build_engine(value: str) -> Engine:
    # Keep a small pool under free-tier limits. UTC is transaction/session explicit.
    return create_engine(
        normalize_url(value),
        pool_size=3,
        max_overflow=2,
        pool_pre_ping=True,
        hide_parameters=True,
        connect_args=connection_options(value),
    )


def connection_options(value: str) -> dict[str, str | int]:
    options: dict[str, str | int] = {
        "connect_timeout": 10,
        "options": "-c timezone=UTC",
    }
    if (make_url(value).host or "").endswith(".neon.tech"):
        options.update(sslmode="verify-full", sslrootcert=certifi.where())
    return options


@lru_cache
def get_engine() -> Engine:
    value = get_settings().database_url.get_secret_value()
    if not value:
        raise RuntimeError("DATABASE_URL is missing. Run make setup.")
    return build_engine(value)


def get_session() -> Generator[Session, None, None]:
    with Session(get_engine()) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
