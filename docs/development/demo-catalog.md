# CourtMate demo catalogue

The [venue CSV](../../src/backend/app/scripts/demo_data/venues.csv) contains public venue names, street addresses, sport and a source for each record. The area column uses familiar district names as search labels. The venue sources include [Thể Thao Phủi](https://thethaophui.vn/san-bong-da-tphcm/), [VinaPick](https://vinapickleball.vn/news/danh-ba-san-pickleball), [LOOL](https://lool.vn/san/cau-long-ho-chi-minh), and individual venue, municipal and sports sources listed in the CSV. Address references were assembled on 24 November 2026.

CourtMate adds a visible “· Demo” name suffix and explains the simulation on the discovery and court-detail screens. Prices, operating hours, availability, player identities and bookings are fictional. The 10 sport-specific [WebP illustrations](../../src/frontend/public/images/demo/) were generated with OpenAI ImageGen for this project. Each of the five sports has two variations. Venue photographs, third-party logos, venue telephone numbers and actual users’ data are excluded.

## Run or refresh locally

Start the existing PostgreSQL and Auth Emulator, as in the [setup guide](setup.md). Create an empty database such as `courtmate_demo_catalog` on that localhost PostgreSQL instance. In the terminal used for migration, seed and API startup, set `DATABASE_URL` and `MIGRATION_DATABASE_URL` to that database using the local operator credentials. Keep the URLs in an ignored local file or session environment. Set `APP_ENV=local`, `FIREBASE_PROJECT_ID=demo-courtmate` and `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`.

```sh
cd src/backend
uv run alembic upgrade head
uv run python -m app.scripts.demo_seed
uv run python -m app.scripts.demo_seed --apply
uv run python -m app.scripts.demo_seed --verify
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Before `--apply`, supply a shared local-only password of at least 12 characters in `COURTMATE_DEMO_PASSWORD` through your private environment. Keep the same value for refresh. Existing emulator accounts retain their passwords. The frontend normally listens on http://localhost:5173. Use `--web-origin` when the frontend serves the images at another origin. The default command prints a dry run with no database or auth access.

The seed uses stable venue/user IDs, a fixed price/illustration seed, Vietnam local days, genuine scheduling, booking, maintenance, room and offer services, plus database constraints. Refresh extends the rolling 16-day window and adds eligible new scenarios. Existing user changes and historical rows survive. Run it before the demo while the demonstration instance is idle. The guard requires a localhost `courtmate_demo_*` database, nonproduction app mode and a loopback Auth Emulator. The command reports row counts and checks overlap, accepted totals, slot claims, room membership/capacity and offer price. Archive or replace the demo instance through the team process when long-lived history is no longer needed.

## Demo accounts and walkthrough

| Account | Use |
|---|---|
| `demo-owner-01@courtmate.test` | Four demo courts. View Lịch sân, published slots, maintenance, booking overview and offers. |
| `demo-player-01@courtmate.test` | View current, past and cancelled bookings. Search a court, select two adjacent slots several days ahead, review and confirm. |
| `demo-player-02@courtmate.test` | Open tomorrow’s confirmed booking from Lịch đặt, create a room and return after reload. |
| `demo-player-03@courtmate.test` and `demo-player-04@courtmate.test` | Find and open a room, Join/Leave, then watch its organizer close it. |

Search **Chảo Lửa**, combine **Bóng đá** with **Tân Bình** and tomorrow’s time range, open the slot preview and use Back. Show the next playing date on the calendar, compare regular and deal prices and open a room with available places. Use a future booking more than six hours away to demonstrate cancellation and its released slots. Use a newly created fictional venue to demonstrate editing hours or deactivation without disturbing the reusable catalogue.

Only the five sign-in identities are provisioned in each Auth environment. Synthetic roster and booking actors are database fixtures with fictional nicknames. For the [hosted demo](https://courtmate-court-mate.vercel.app), the sign-in addresses use the `cloud-` prefix. Share passwords through the private local handoff.

## Publish the approved catalogue to the hosted demo

1. Seed and verify a dedicated localhost `courtmate_demo_*` source with `--web-origin https://courtmate-court-mate.vercel.app`. The source must contain at least 5,000 upcoming slots. Back up the existing Neon database and verify that `pg_restore --list` can read the archive.
2. Supply the source URL as `COURTMATE_DEMO_SOURCE_URL` and the approved direct Neon URL as `COURTMATE_DEMO_CLOUD_URL` through private environment variables. Clear `FIREBASE_AUTH_EMULATOR_HOST` for the cloud command. Run `uv run python -m app.scripts.demo_cloud` from `src/backend` to check schema, planned row counts and the exact target. This command uses a read-only destination transaction.
3. Use authorized Firebase Application Default Credentials for `courtmate-t05-nexora` and point `COURTMATE_DEMO_PASSWORD_FILE` to an ignored, mode-0600 JSON file with five distinct passwords keyed by `owner-01` and `player-01` through `player-04`. Run `uv run python -m app.scripts.demo_cloud --apply --confirm-target "$TARGET" --recovery-point "$RECOVERY_FILE"`, using the printed target and a fresh path in a private directory. The importer preserves existing identities, inserts only stable demo rows in one PostgreSQL transaction and checks invariants before commit. If interrupted between Firebase provisioning and PostgreSQL commit, retry with the same snapshot and passwords plus a fresh recovery path.
4. Check catalogue counts and states, the public Vercel pages, and all five Firebase sign-ins. Scope QA to demo fixtures. Use isolated PostgreSQL and Firebase Emulator for repeatable load and concurrency checks.
