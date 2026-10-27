from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
        if (
            self.app_env == "production"
            and not self.firebase_service_account_json.get_secret_value()
        ):
            raise RuntimeError(
                "Production requires FIREBASE_SERVICE_ACCOUNT_JSON runtime credential."
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
