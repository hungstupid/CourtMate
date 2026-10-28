import os
from typing import Literal

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app.db.readiness import check_schema
from app.db.session import get_engine

router = APIRouter()


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["courtmate-api"] = "courtmate-api"


@router.get("/health", response_model=HealthResponse, tags=["health"])
def health(response: Response) -> HealthResponse:
    commit = os.getenv("RENDER_GIT_COMMIT")
    if commit:
        response.headers["X-CourtMate-Commit"] = commit
    return HealthResponse()


@router.get("/ready", tags=["health"])
def ready() -> dict[str, str]:
    try:
        with get_engine().connect() as connection:
            check_schema(connection)
        return {"status": "ready", "database": "ok"}
    except Exception as error:
        raise HTTPException(
            503, "Database is not ready; check connectivity and migrations."
        ) from error
