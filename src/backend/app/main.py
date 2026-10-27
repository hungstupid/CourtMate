from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.identity import router as identity_router
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
    description="Development bootstrap for T05 Nexora's sports court platform.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Accept", "Content-Type", "Authorization"],
)
app.include_router(health_router)
app.include_router(identity_router)
