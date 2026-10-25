# Backend

Holds CourtMate's **server-side implementation**: API endpoints, business rules, authentication/authorization, data access, database migrations and backend tests. The development bootstrap uses FastAPI and uv with Python 3.12. PostgreSQL and business endpoints will be added in later work.

The booking-duration and confirmation/approval rules must be agreed before implementation. Preventing overlapping valid bookings requires a verified server/database approach.

The setup, run and check commands below have been verified locally. Never commit credentials, `.env` or real customer information. No database, migration, authentication or business feature is implemented in this bootstrap.

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

The health endpoint needs no database or credentials. `.env`, `.venv/` and caches are ignored; `.env.example`, `.python-version` and `uv.lock` are tracked.

## Quality checks

Run from `src/backend/`:

```bash
uv sync --locked
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

`uv sync` installs the locked runtime and development dependencies into the local `.venv/`. `--locked` additionally rejects a stale lockfile. Commit `uv.lock` alongside dependency changes made with `uv add` or `uv add --dev`. There is no parallel requirements.txt workflow.

The tests cover the health response, OpenAPI/docs, allowed and denied CORS origins, preflight, custom origins, wildcard rejection and reading configuration from `.env`. They need no external services. The current Starlette TestClient emits a deprecation warning about HTTPX; tests still pass. Keep the HTTPX dependency required by this bootstrap and review that upstream migration when upgrading the test stack.

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
