from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from app.db.session import get_engine

router = APIRouter()


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["courtmate-api"] = "courtmate-api"


@router.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    return HealthResponse()


@router.get("/ready", tags=["health"])
def ready() -> dict[str, str]:
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1 FROM alembic_version"))
        return {"status": "ready", "database": "ok"}
    except Exception as error:
        raise HTTPException(
            503, "Database is not ready; check connectivity and migrations."
        ) from error
