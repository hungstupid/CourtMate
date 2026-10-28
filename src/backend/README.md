# Backend

Holds CourtMate's **server-side implementation**: API endpoints, business rules, authentication/authorization, data access, database migrations and backend tests. The foundation uses FastAPI, uv, Python 3.12, PostgreSQL and Firebase Authentication. The current backend contains a reviewed-by-tests implementation draft for court scheduling, atomic booking/cancellation and Open Play; formal PA3/PA4 team review remains pending.

Use the [current SRS](https://docs.google.com/document/d/1zL3Ra_0LceKOF_2pZa9iWpq7HIbRtALB/edit) and [backend design draft](../../docs/development/backend-core-design.md) for slot, booking, cancellation and room rules. Real PostgreSQL concurrency tests cover overlapping confirmations and capacity races; they do not establish performance NFRs or complete product acceptance.

Database/Auth initialization starts with the [development guide](../../docs/development/setup.md). Never commit credentials, `.env` or real customer information. See the [API integration guide](../../docs/development/backend-api.md) and [verification report](../../docs/development/backend-core-report.md). Business frontend, F09 deals and profile remain outside this draft.

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
make setup
make db-up
make migrate
make auth-emulator
# In another terminal, also from the repository root:
make dev-api
```

Keep the server in this terminal and stop it with Ctrl+C. Start the frontend in another terminal using [its guide](../frontend/README.md).

| URL | Purpose |
| --- | --- |
| http://localhost:8000/health | HTTP 200 with `{"status":"ok","service":"courtmate-api"}` |
| http://localhost:8000/docs | Interactive OpenAPI documentation |
| http://localhost:8000/openapi.json | OpenAPI schema |

The API root `/` has no endpoint and returns 404; use `/health` to verify startup.

## Configuration

`app/core/config.py` and `app/core/settings.py` read `src/backend/.env`; exported environment variables take precedence. `make setup` generates matching local configuration without replacing existing values. Restart the server after changing configuration.

```dotenv
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

`CORS_ORIGINS` accepts a comma-separated list of complete origins. These two origins are also the defaults when unset. Explicitly add other development ports if needed; wildcard `*` is rejected. CORS allows GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS and Accept/Content-Type/Authorization headers, with cookie credentials disabled. Keep origins explicit.

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

The suite currently has 209 tests covering foundation, strict court/slot validation, whole-booking snapshots/cancellation, Open Play, real PostgreSQL contention and additive migration upgrades, plus Auth Emulator → HTTP → committed PostgreSQL integration. Start those isolated services using the development guide; TEST_DATABASE_URL must reference a separate local database ending `_test`. No cloud credentials or demo data are used. HTTPX2 was added for current Starlette TestClient support while retaining HTTPX for smoke tooling.

To apply Ruff formatting before review, run `uv run ruff format .`.

## Package layout

| Path | Purpose |
| --- | --- |
| `app/main.py` | FastAPI metadata, middleware and routes |
| `app/api/` | Health/identity, Owner courts/schedules, Player bookings and public/Player rooms |
| `app/services/` | Transactional scheduling, quote/booking/cancellation and room invariants |
| `app/core/config.py` | Local environment and CORS configuration |
| `app/core/settings.py`, `app/core/auth.py` | Runtime settings and Firebase/role/ownership checks |
| `app/db/`, `migrations/` | Identity/business models, one-request transaction, additive revisions 0001→0002→0003 |
| `app/scripts/` | Controlled seed, Owner grant, test reset, backup and release commands |
| `tests/` | pytest tests using FastAPI TestClient |
| `pyproject.toml` | Dependencies, Python constraints and tool configuration |
| `uv.lock` | Resolved dependency versions |

Run commands from this directory so `app.main:app` imports correctly. Use the existing [contribution rules](../../CONTRIBUTING.md) for further changes; this authorized implementation draft remains on `chore/project-bootstrap` and must not be merged automatically.
