# Development, identity and deployment

Stack: React/TypeScript/Vite, FastAPI/Python 3.12/uv, PostgreSQL 17, Firebase Authentication. PostgreSQL is hosted on Neon; the API on Render and the frontend on Vercel. Only Player and Court Owner are application roles. This foundation does not implement booking, courts, rooms, deals, payments or chat.

## Clean local setup

Install Node 24/npm, uv, Docker Desktop/Compose, and Firebase CLI 15.34.1 (`npm install -g firebase-tools@15.34.1`). Auth-only emulation does not require Java. Start Docker Desktop, then clone the setup branch and run from the repository root:

```bash
git clone --branch chore/project-bootstrap --single-branch https://github.com/hungstupid/CourtMate.git
cd CourtMate
```

```bash
make setup
make db-up
make migrate
```

`make setup` uses the committed npm/uv lockfiles and generates a random local database password. It creates ignored `.env` files or appends missing keys without replacing existing values. Do not copy placeholder password examples over these generated files. Python 3.12 is selected by uv; keep system Python unchanged.

Use three terminals at the root:

```bash
make auth-emulator
make dev-api
make dev-web
```

These are separate long-running commands, one per terminal. URLs: frontend http://localhost:5173; API http://localhost:8000/health; readiness http://localhost:8000/ready; docs http://localhost:8000/docs. Firebase Auth Emulator listens only on 127.0.0.1:9099 with project `demo-courtmate`. No real Google login or cloud credentials are needed for local development or CI.

After the emulator is running, `make seed` creates local Player/Owner fixtures idempotently. Their fixture credentials are defined only in the emulator seed script. Seed refuses real Firebase projects and production. Sign up in the development page to create another Player and select “Verify with backend” to test the full identity/database path.

Stop each dev server with Ctrl+C in its own terminal. `make db-stop` stops only the CourtMate database without removing its volume. Never use a global kill command or remove unrelated Docker resources.

## Configuration and secrets

| Variable | Purpose / location |
| --- | --- |
| Root `POSTGRES_PASSWORD`, `POSTGRES_PORT` | Generated local Compose `.env`; never commit |
| `DATABASE_URL` | Backend runtime connection; Neon pooled URL on Render |
| `MIGRATION_DATABASE_URL` | Direct PostgreSQL URL for Alembic/release/export |
| `TEST_DATABASE_URL` | Separate localhost database ending `_test`; never demo |
| `APP_ENV` | `local`, `test` or `production` |
| `FIREBASE_PROJECT_ID` | `demo-courtmate` locally; `courtmate-t05-nexora` on cloud |
| `FIREBASE_AUTH_EMULATOR_HOST` | Local/test only; production rejects it |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Private runtime credential managed in Render environment secrets |
| `CORS_ORIGINS` | Comma-separated exact frontend origins, no wildcard |
| `VITE_API_BASE_URL` | Public backend URL; Vercel build environment |
| `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_AUTH_DOMAIN` | Public matching Firebase Web App configuration in Vercel |
| `VITE_FIREBASE_AUTH_EMULATOR_URL` | Local Vite dev only; production bundle never connects to emulator |

Examples contain names and placeholders only. Local credentials and account fixtures live in ignored `.env`/`.secrets` files with restricted permissions. Backend keys never go into VITE variables. The Firebase Web API key is public SDK configuration, not a Firebase Admin credential. Firebase CLI login is operator access, not API runtime authentication. The runtime service account has read-only Firebase Auth access for ID-token revocation/disabled-account checks.

Neon connections enforce certificate/hostname verification through psycopg and certifi; local Docker uses a loopback connection. Runtime pool is capped at 3 connections plus 2 overflow, with pre-ping and UTC. Migrations use a direct connection to the same database as runtime (Neon direct/pooler hosts normalize to the same endpoint) and a separate transaction. Startup validates PostgreSQL URL structure, required production configuration and matching Firebase service-account structure/private key offline. Configuration errors fail startup with sanitized messages; network/provider outages are separate runtime 503 conditions. Local/test emulation needs no cloud credential. Do not point TEST_DATABASE_URL at Neon/demo or put passwords in command arguments/logs.

## Migration and role workflow

```bash
make migrate
cd src/backend
uv run alembic revision --autogenerate -m "describe approved schema change"
uv run alembic upgrade head
uv run alembic current
```

Review generated migrations before committing. Database schema changes belong in migration files, not ad hoc console edits. Start from a clean test database to verify both migration application and repeated `upgrade head`. Use the Neon development branch to validate cloud compatibility; never run destructive tests against demo.

Public registration and `/api/me` always provision Player; the backend ignores role claims and uses the database role. Internal operators with both trusted database and matching Firebase access can grant Owner:

```bash
cd src/backend
uv run python -m app.scripts.grant_owner FIREBASE_UID --confirm FIREBASE_UID
```

The script checks that the UID exists and is enabled before modifying the role. This is not a public endpoint or Admin UI. Apply `require_owner` plus `require_resource_ownership` when approved Owner resources are added. Organizer is a future room membership relation, not a role. Secrets needed for cloud operator commands must be supplied from ignored local configuration/secret storage, never committed or copied into docs.

## Tests and data lifecycle

Start local database and Auth Emulator, then:

```bash
make test
cd src/frontend
npx playwright install chromium
npm run test:e2e
npm run test:a11y
cd ../..
make load
make export-demo
make restore-test
```

Use `BROWSER_CHANNEL=chrome make e2e` when Google Chrome is already installed. Playwright starts/stops its frontend server; the backend and emulator remain explicit prerequisites. Trace/video/screenshots are disabled for authenticated tests to avoid recording credentials/tokens. Database tests roll back per test. `make reset-test` and restore share the same destination guard: PostgreSQL, loopback host, database suffix `_test`, non-production environment, and a destination different from both runtime and migration databases. Driver spelling, user/password and ordinary query options do not make a database distinct. Default port 5432, localhost, IPv4 loopback and IPv6 loopback normalize together; DNS aliases such as `db` are not supported reset targets. Query options overriding host/port/database/service are rejected. Local backup/restore must match the port of this Compose server, preventing pg_restore from silently redirecting a different port. Running tests migrates the isolated database again. Missing database/emulator prerequisites fail integration tests instead of silently skipping them. CI fails if the real integration checks fail; no cloud secret is required.

Export/restore uses pg_dump/pg_restore inside the CourtMate Docker container. Backups are ignored `.secrets/demo.dump` files; restore is restricted to localhost `_test`. Do not run restore against demo. For Neon export, use its direct URL through ignored configuration; keep the container/client PostgreSQL major version compatible. Cloud data is never reset by ordinary `make test`.

The 20-request/5-worker load probe measures only liveness. Playwright/axe exercise the development/identity foundation UI. Local `client.spec.ts` deliberately injects API failures for HTTP error, timeout/cancellation and session regression tests; it is excluded from real cloud acceptance, which uses existing Firebase accounts and real API/PostgreSQL requests. Add real page accessibility tests, booking/room race tests, boundary tests and repeatable load scenarios when their PA5 implementations exist. Current evidence does not establish business ACs or performance NFRs.


## Frontend foundations (not business features)

`/` is public, `/account` requires a verified session, and `/owner` additionally requires the server-returned Owner role. Direct navigation and reload use Vercel's SPA rewrite; unknown paths show a not-found page. These are foundation routes, not completed account/court/booking screens. React Router is used only in declarative mode within the existing Vite app. Existing visual styles and accessible native buttons/fields are retained; no UI framework or replacement Figma design was added.

`SessionProvider` waits for Firebase initialization and `/api/me` before showing protected content, cancels stale requests, handles sign-out/401 expiry, and offers retry for provider/network failure. `apiRequest` attaches the current Firebase ID token, JSON content type, cancellation and a bounded timeout (including token retrieval). It exposes status-aware errors for 401/403/409/422/5xx without echoing provider payloads. It never automatically replays mutations. Pass a relative API path and an AbortSignal; use `authenticated: false` only for public endpoints. Frontend guards are navigation helpers: every protected backend endpoint must still apply the appropriate role/ownership dependencies. A future expired/disabled/deleted identity gets 401; an actual Firebase provider outage gets 503.

## Cloud resources and deployment lifecycle

| Service | Identity |
| --- | --- |
| Firebase | `courtmate-t05-nexora`; Web App `1:1025822356886:web:690e2d75083929893c19b7` |
| Neon | `courtmate` / `divine-sun-63104113`; Singapore; demo `br-small-glitter-aomatkd1`, development `br-wild-bread-ao8ejarx` |
| Vercel | `courtmate` / `prj_M5RVrPKXbHI7AvHwtNEb7CELAIsw`; project root `src/frontend` |
| Render workspace | My Workspace / `tea-dbg8buh42hec73dt859g`; account `hungkydau2@gmail.com` |

Verified public frontend: https://courtmate-court-mate.vercel.app (also https://courtmate-virid.vercel.app). API: https://courtmate-api-cs7b.onrender.com; health `/health`, readiness `/ready`, docs `/docs`. Render service: `srv-dbg8tmu7bikc73fdlb7g`. Deployment and GitHub CI identifiers/evidence are recorded in [bootstrap-report.md](bootstrap-report.md).

Quality workflow `.github/workflows/quality.yml` runs on PRs, `main` and the setup branch. It installs from lockfiles, checks the frontend and tests backend/migrations/Auth/browser integration against fresh CI-only services. Keep `.github/workflows/repo-check.yml` for document/secret-filename checks. Existing team PR/review rules remain in CONTRIBUTING.md.

The current demo source on **both hosts is `chore/project-bootstrap`**, without merging main. Each host has exactly one normal deployment mechanism: its Git integration. There is no Actions deploy job, deploy hook, or CI provider credential. Render waits for all CI checks (`autoDeployTrigger: checksPass`). Vercel builds the production branch through Git and holds public domain assignment until the exact commit's `frontend-push` and `integration-push` checks succeed. It may build before CI finishes; release to the public domain is gated. These job names intentionally differ from PR jobs to avoid check-name collisions. A failed check cannot release the new frontend. Vercel Native Deployment Checks were accepted on the existing Hobby project; no paid option was enabled.

`render.yaml` records the setup branch, root, commands and `/ready` probe. `src/frontend/vercel.json` permits only the setup branch and includes a SPA fallback for client routes. Vercel's provider-side production branch must also be `chore/project-bootstrap`; project settings remain root `src/frontend`, Node `24.x`, install `npm ci`, build `npm run build`, output `dist`. Render remains Python `3.12.15`, root `src/backend`, build `pip install uv==0.13.5 && uv sync --locked --no-dev`, start `uv run --no-sync python -m app.scripts.start`. Changing repository files alone does not apply provider settings.

After a push, inspect the **push** quality run, provider deployment SHA/ID, then `/version.json` on the public frontend and `X-CourtMate-Commit` on API `/health`; all must match the intended SHA. `/health` is process liveness and preserves its original JSON. `/ready` queries PostgreSQL and compares the full set of Alembic current revisions with this code's migration heads; disconnected, empty, older or unknown revisions return 503. Render uses `/ready`, so a listening server with the wrong revision cannot pass deployment readiness.

To switch to main **later, after human review/merge approval**: update `render.yaml` branch and the allowed branch in `src/frontend/vercel.json`; change the existing Render service branch to main while retaining checksPass and `/ready`; change Vercel Settings → Environments → Production → Branch Tracking to main and retain both push check gates. Do these as one coordinated reviewed change. Do not enable a second Actions deploy trigger. This task does not perform that future switch.

Render Free lacks a pre-deploy command. `app.scripts.start` takes a PostgreSQL advisory lock, applies Alembic and then execs Uvicorn on 0.0.0.0:$PORT. Failed/overlapping migration prevents startup; it does not silently run an incompatible release. Future migrations must be backward-compatible with the previous live version. `render.yaml` documents the target settings and was validated by Render CLI; existing live service settings/secrets are applied through authenticated service configuration, not by assuming a Blueprint file self-deploys.

Inspect CI with `gh run list` / `gh run view RUN_ID --log-failed`. Inspect Render via `render deploys list SERVICE_ID --output json` and `render logs --help`; inspect Vercel via its deployment dashboard/API or authenticated CLI. Roll back to an observed previous successful deployment through the provider's supported rollback operation after checking migration compatibility. Rollback does not revert PostgreSQL or Firebase writes. Never automatically downgrade or restore demo data to roll back code.

Free plans have quotas/cold starts. Render Free sleeps after 15 minutes idle and may take about a minute to wake; the frontend offers retry and allows a longer production health request. Neon scales to zero on its Free plan. Do not add a keepalive loop to defeat sleep. No paid database, worker, Redis, queue, upload provider, AI service or OpenAI API key is needed.
