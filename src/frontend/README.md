# CourtMate frontend

React / TypeScript / Vite application for Player and Court Owner, based on the current [SRS audit](../../docs/development/srs-implementation-audit.md) and [Figma mapping](../../docs/development/figma-implementation.md).

Player: email/password registration and sign-in, court search with independent time/location filters, slot preview, consecutive-slot review/booking, recent history/cancellation, public Open Play discovery/create/join/leave/organizer closure. Owner: court forms/deactivation, full-day schedule, editable batch drafts, atomic publication, hours/maintenance, booking details and manual/automatic slot offers. Both roles can edit non-critical profiles. All business records come from the real API. `/development` retains diagnostic tools separately.

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Create local ignored configuration with `make setup`; see [setup](../../docs/development/setup.md). Firebase ID tokens are supplied by the existing session/client integration. Account role is validated once by `POST /api/register`; profile changes never change role.

Browser business tests require Firebase Auth Emulator and an API connected to the guarded local `TEST_DATABASE_URL`. CI sets this in `scripts/ci-integration.sh`. Use a free port and `VITE_API_BASE_URL` if localhost:8000 belongs to another project. Do not point business-write tests at cloud/demo. Every browser run has a generated marker and targeted teardown; no database reset is used. Run pytest, browser tests and k6 sequentially because their datasets share the local test database. Cloud mode requires explicit existing account credentials and skips isolated business writes.

No package/lockfile upgrade was made. Current npm audit has 10 moderate development-tool findings; see the release report. Runtime credentials and browser auth state must stay out of version control.
