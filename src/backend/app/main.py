from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.core.config import get_cors_origins

app = FastAPI(
    title="CourtMate API",
    version="0.1.0",
    description="Development bootstrap for T05 Nexora's sports court platform.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Accept", "Content-Type"],
)
app.include_router(health_router)
