from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.api.bookings import router as bookings_router
from app.api.courts import router as courts_router
from app.api.health import router as health_router
from app.api.identity import router as identity_router
from app.api.rooms import router as rooms_router
from app.core.config import get_cors_origins
from app.core.settings import get_settings
from app.db.session import get_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_settings().validate_runtime()
    yield
    get_engine().dispose()


app = FastAPI(
    lifespan=lifespan,
    title="CourtMate API",
    version="0.1.0",
    description="Draft court scheduling, atomic bookings and Open Play backend.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Accept", "Content-Type", "Authorization"],
)
app.include_router(health_router)
app.include_router(identity_router)
app.include_router(courts_router)
app.include_router(bookings_router)
app.include_router(rooms_router)


@app.exception_handler(IntegrityError)
def database_conflict(request: Request, error: IntegrityError) -> JSONResponse:
    # Never echo SQL, parameter values or provider messages into API errors.
    return JSONResponse(
        status_code=409,
        content={
            "detail": {
                "code": "database_conflict",
                "message": "The data changed or conflicts with a protected record. "
                "Review and retry.",
            }
        },
    )
