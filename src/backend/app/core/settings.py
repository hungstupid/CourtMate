import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.database_urls import local_host, migration_url, postgres_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        extra="ignore",
        hide_input_in_errors=True,
    )
    app_env: Literal["local", "test", "production"] = "local"
    database_url: SecretStr = SecretStr("")
    migration_database_url: SecretStr = SecretStr("")
    test_database_url: SecretStr = SecretStr("")
    firebase_project_id: str = ""
    firebase_service_account_json: SecretStr = SecretStr("")
    firebase_auth_emulator_host: str = ""

    @model_validator(mode="after")
    def cloud_must_verify_signed_tokens(self) -> "Settings":
        if self.app_env == "production" and self.firebase_auth_emulator_host:
            raise ValueError("Firebase Auth Emulator is forbidden in production.")
        if self.app_env == "production" and self.firebase_project_id.startswith(
            "demo-"
        ):
            raise ValueError("Production requires a real Firebase project.")
        return self

    def validate_runtime(self) -> None:
        if not self.database_url.get_secret_value():
            raise RuntimeError(
                "DATABASE_URL is required. Run make setup; see backend README."
            )
        if not self.firebase_project_id:
            raise RuntimeError("FIREBASE_PROJECT_ID is required; see backend README.")
        if not re.fullmatch(r"[a-z][a-z0-9-]{4,28}[a-z0-9]", self.firebase_project_id):
            raise RuntimeError(
                "FIREBASE_PROJECT_ID must be a valid project identifier."
            )
        runtime = postgres_url(self.database_url.get_secret_value(), "DATABASE_URL")
        migration = migration_url(
            self.database_url.get_secret_value(),
            self.migration_database_url.get_secret_value(),
        )
        if (
            self.firebase_project_id.startswith("demo-")
            and not self.firebase_auth_emulator_host
        ):
            raise RuntimeError("A demo Firebase project requires the Auth Emulator.")
        if self.firebase_auth_emulator_host:
            from urllib.parse import urlsplit

            try:
                emulator = urlsplit("//" + self.firebase_auth_emulator_host)
                valid = (
                    emulator.hostname
                    and local_host(emulator.hostname)
                    and emulator.port
                    and not emulator.path
                    and not emulator.username
                    and not emulator.query
                    and not emulator.fragment
                )
            except ValueError:
                valid = False
            if not valid:
                raise RuntimeError(
                    "Firebase Auth Emulator requires a loopback host:port."
                )
        if self.app_env == "production":
            if local_host(runtime.host or ""):
                raise RuntimeError("Production requires a cloud PostgreSQL endpoint.")
            if not self.migration_database_url.get_secret_value():
                raise RuntimeError("Production requires MIGRATION_DATABASE_URL.")
            if (runtime.host or "").endswith(".neon.tech") and "-pooler." not in (
                runtime.host or ""
            ):
                raise RuntimeError(
                    "Production Neon runtime requires the pooled endpoint."
                )
        for url in (runtime, postgres_url(migration)):
            if not local_host(url.host or "") and url.query.get("sslmode") in {
                "disable",
                "allow",
                "prefer",
            }:
                raise RuntimeError("Cloud PostgreSQL requires TLS.")
        if (
            self.app_env == "production"
            and not self.firebase_service_account_json.get_secret_value()
        ):
            raise RuntimeError(
                "Production requires FIREBASE_SERVICE_ACCOUNT_JSON runtime credential."
            )
        raw = self.firebase_service_account_json.get_secret_value()
        if raw:
            try:
                from firebase_admin import credentials

                data = json.loads(raw)
                if (
                    not isinstance(data, dict)
                    or data.get("type") != "service_account"
                    or data.get("project_id") != self.firebase_project_id
                    or not data.get("client_email", "").endswith(".gserviceaccount.com")
                ):
                    raise ValueError
                # Parse/signing-key validation is offline; no provider request here.
                credentials.Certificate(data)
            except Exception:
                raise RuntimeError(
                    "FIREBASE_SERVICE_ACCOUNT_JSON requires a valid service account "
                    "and private key for FIREBASE_PROJECT_ID."
                ) from None


@lru_cache
def get_settings() -> Settings:
    return Settings()
