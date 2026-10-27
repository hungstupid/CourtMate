# Backend

Holds CourtMate's **server-side implementation**: API endpoints, business rules, authentication/authorization, data access, database migrations and backend tests. The development bootstrap uses FastAPI and uv with Python 3.12. PostgreSQL and business endpoints will be added in later work.

The booking-duration and confirmation/approval rules must be agreed before implementation. Preventing overlapping valid bookings requires a verified server/database approach.

The original setup commands below are retained, but database/Auth initialization now starts with the [development guide](../../docs/development/setup.md): `make setup`, `make db-up`, `make migrate`, and a running Auth Emulator. Never commit credentials, `.env` or real customer information. Identity/role foundation is implemented; court, booking and room business features are not.

**Not for:** PA documentation; finalized course submissions go in `pa/PAx/`.

## Requirements and setup

Use **Python 3.12**, managed by **uv**. `.python-version` selects 3.12; `requires-python` restricts the project to `>=3.12,<3.13`. Leave your system Python unchanged.

Install uv if missing. On macOS, Homebrew is an option (`brew install uv`). The official standalone installer was used on this machine because Homebrew required a large source build on macOS 14:

```bash
curl -LsSf https://astral.sh/uv/install.sh -o /tmp/uv-install.sh
sh /tmp/uv-install.sh
```

See the [official uv installation guide](https://docs.astral.sh/uv/getting-started/installation/) for platform-specific instructions. Ensure `uv` is available in a new terminal. Do not install project dependencies with global pip.

From the repository root:

```bash
cd src/backend
uv python install 3.12
uv sync
cp .env.example .env
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Keep the server in this terminal and stop it with Ctrl+C. Start the frontend in another terminal using [its guide](../frontend/README.md).

| URL | Purpose |
| --- | --- |
| http://localhost:8000/health | HTTP 200 with `{"status":"ok","service":"courtmate-api"}` |
| http://localhost:8000/docs | Interactive OpenAPI documentation |
| http://localhost:8000/openapi.json | OpenAPI schema |

The API root `/` has no endpoint and returns 404; use `/health` to verify startup.

## Configuration

`app/core/config.py` reads `src/backend/.env` through python-dotenv at startup. Exported environment variables take precedence. Copy the example only during initial setup and restart the server after changing configuration.

```dotenv
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

`CORS_ORIGINS` accepts a comma-separated list of complete origins. These two origins are also the defaults when unset. Explicitly add other development ports if needed; wildcard `*` is rejected. CORS currently allows GET requests and Accept/Content-Type headers, with credentials disabled. Update deliberately when approved features require other methods.

The liveness endpoint needs no database query. API startup requires DATABASE_URL and FIREBASE_PROJECT_ID. `/ready` checks the database/migration, `/api/me` verifies a Firebase token and provisions Player, and `/api/owner/access` tests the stored Owner role. Runtime/migration/test URL separation, cloud credentials, local emulator and operator role scripts are documented in the development guide. `.env`, `.secrets/`, `.venv/` and caches are ignored; examples and lockfiles are tracked.

## Quality checks

Run from `src/backend/`:

```bash
uv sync --locked
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

`uv sync` installs the locked runtime and development dependencies into the local `.venv/`. `--locked` additionally rejects a stale lockfile. Commit `uv.lock` alongside dependency changes made with `uv add` or `uv add --dev`. There is no parallel requirements.txt workflow.

The tests cover health/docs/CORS/config plus real PostgreSQL and Auth Emulator identity/authorization integration. Start those isolated services using the development guide; TEST_DATABASE_URL must reference a separate local database ending `_test`. No cloud credentials or demo data are used. HTTPX2 was added for current Starlette TestClient support while retaining HTTPX for smoke tooling.

To apply Ruff formatting before review, run `uv run ruff format .`.

## Package layout

| Path | Purpose |
| --- | --- |
| `app/main.py` | FastAPI metadata, middleware and routes |
| `app/api/health.py` | Typed `/health` response |
| `app/core/config.py` | Local environment and CORS configuration |
| `tests/` | pytest tests using FastAPI TestClient |
| `pyproject.toml` | Dependencies, Python constraints and tool configuration |
| `uv.lock` | Resolved dependency versions |

Run commands from this directory so `app.main:app` imports correctly. Use the existing [contribution rules](../../CONTRIBUTING.md) and a feature branch for further changes.
