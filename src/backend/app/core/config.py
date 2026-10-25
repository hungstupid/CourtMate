import os
from pathlib import Path

from dotenv import load_dotenv


def get_cors_origins() -> list[str]:
    """Read backend/.env without overriding exported environment variables."""
    load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)
    value = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    origins = [origin.strip().rstrip("/") for origin in value.split(",")]
    if "*" in origins:
        raise ValueError("CORS_ORIGINS must list explicit origins, not '*'.")
    return [origin for origin in origins if origin]
