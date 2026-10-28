# Backend core implementation draft — verification report

Date: 28 October 2026, Asia/Ho_Chi_Minh. This is an implementation draft for
PA3–PA5, not a declaration that team design/review, all product ACs, performance
or business-UI accessibility are complete. SRS was fetched directly from the
provided Google Docs link; modified metadata was 27 October 2026. Figma/PA/SRS,
weekly reports and contribution evidence were not edited.

## Git and delivered scope

Started clean on `chore/project-bootstrap` at
`5ab1cdd48149c74d2a419f6232f628d1423c1dba`; fetch confirmed the same remote branch.
No main merge, merge from main, history rewrite, reset or force-push.

- `f5a0681`: Phase A court/schedule/availability and atomic booking core.
- `4f53fb2`: Phase B Open Play, capacity/cancellation links and Owner readback.
- Documentation commits record verification without changing business source.

Phase A backend is implemented: Owner court/hours/slot/maintenance management,
public detail/availability, Player review, atomic one/multi-slot confirmation,
ten newest bookings/details, whole cancellation and rebooking with history.
Phase B backend is implemented after A passed: unique booking-linked room,
Player-only membership, public effective status, capacity/duplicate protection,
atomic cancellation closure, start-time closure and valid-snapshot estimate.
The business frontend is not implemented; connect it using [backend-api.md](backend-api.md).

New additive migrations: `0002_booking_core` creates courts, operating_hours,
slots, maintenance_blocks, bookings, booking_slots and slot_claims;
`0003_open_play` creates rooms and room_members. Existing users remain intact.
No F09 discount, profile, promotion engine, payment, chat, waitlist, worker,
queue, cron or additional service is implemented/provisioned.

## Requirements → implementation → tests

| SRS mapping | Implementation | Concrete evidence |
| --- | --- | --- |
| FR-003..005, BR-09, AC-F01-06..08, AC-F04-06 | Existing Firebase verification; explicit role/ownership; one request transaction | test_identity, test_auth_errors; test_core_api real Emulator token → HTTP → committed PG; Owner/Player/foreign-resource denial |
| FR-010..012, FR-023..027, BR-01/03/05, AC-F06-01..11 | Owner courts/hours/slots/maintenance, active status, strict integer bounds | test_courts: 33 cases, including 60/240 individual slots, grid/local-day/midnight, overlap, protected booking preservation, rejected edit remains unchanged, inactive/unpublished Owner readback |
| FR-014..018, BR-10, AC-F04-01..10 | Ordered review/fingerprint; atomic booking + snapshots + active claims | test_bookings: single/four-slot 60/240, gaps/mixed dates/courts, unavailable states, stale price/quote/identity, one conflicting middle slot allocates nothing, integer overflow; test_concurrency ten overlapping independent connections |
| FR-019..022, BR-02, AC-F05-01..07 | Ten newest whole records, server clock after locks, whole cancellation/rebooking | test_bookings: exact6h, under6h, started/foreign/repeated cancel, all claims released, snapshots/history retained, old quote retry rejected; test_core_api verifies separate-request commits |
| FR-028..030, AC-F07-01..03 | Own-court booking projection without unapproved Player contact | test_bookings Owner scoping/privacy; test_core_api cross-owner403 |
| FR-031/032, BR-04/05, AC-F10-01..03 | One room/booking; Player owner; organizer counted; capacity2..2×max | test_rooms; test_room_concurrency duplicate creation and capacity-edit race; max_players8 with C16 valid/C17 invalid |
| FR-033..037, BR-06, AC-F10-04..09/11/13 | Public status; locked join/leave; sticky closure; atomic cancellation | test_rooms, test_room_links10; test_room_concurrency9: last place, duplicate retries, C16 mixed contenders, queued join after cancellation, exact start after lock wait; test_core_api committed sticky closure even clock correction |
| FR-038, BR-08, AC-F10-10/12 | Whole accepted price / current members; integer half-up; unavailable invalid snapshots | test_rooms: valid/partial/mismatched/noncontiguous snapshot cases, count updates; test_core_api 100001/2 rounds50001 |
| NFR-02/03 integrity scenarios | PG row locks + unique claims/room/member constraints | Observed pg_blocking_pids for distinct backend PIDs before releasing blockers; final committed DB state checked. This does not claim NFR-01 performance |

API/error/response details and frontend call order: [backend-api.md](backend-api.md).
Schema/transaction order and design decisions: [backend-core-design.md](backend-core-design.md).

## Executed local checks before push

- `uv sync --locked`: PASS, dependencies/uv.lock unchanged.
- `uv run pytest -q`: **209 passed, 0 failed, 0 skipped**; real PostgreSQL17 and
  Firebase Auth Emulator, no SQLite replacement. A first complete Phase A run
  passed153 before the subsequent extra readback/room regressions.
- `uv run ruff check .`, `uv run ruff format --check .`: PASS.
- `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`: PASS; install
  reported0 vulnerabilities. No frontend dependency upgrade/change.
- `BROWSER_CHANNEL=chrome npm run test:e2e`: **6 passed** against actual local
  API/PostgreSQL/Auth Emulator. Three local API failure-injection regression
  tests are labelled separately in the existing suite; they are not evidence
  of cloud-provider success. No business-UI/NFR accessibility claim follows.
- Temporary, uniquely named local test schemas: upgrade from empty and from
  populated0001, repeat upgrade; users preserved. Disposable schemas only were
  dropped. Concurrency fixtures commit unique test rows and delete only theirs.
- Existing local development DB: upgrade to0003 twice; all9 existing identity
  rows preserved at that check, no reset/downgrade/restore.
- All new tests are automatically collected by the existing quality workflow's
  `uv run pytest`; its Firebase Emulator/PG services need no personal credential.

One sandbox-denied test diagnostic exposed a generated local DB password in its
traceback. That local credential was invalidated/rotated, ignored backend/root
.env files synchronized at0600, and existing data retained. Cloud credentials
were unchanged. Pytest now uses short tracebacks with frame locals disabled;
secret values are not copied into this report, Git or frontend artifacts.

## Deployment and review limits

At this documentation snapshot, local verification has passed; remote CI and
auto-deployment for the new pushed HEAD still require observation. Record exact
run/deployment IDs below only after checking them. Do not treat the old live
bootstrap or a200 response as proof of new code.

Migrations add tables and leave old identity SQL compatible. The previous live
API's strict0001 readiness can briefly fail during the revision transition;
this is not a zero-downtime guarantee. New code requires0003. Serialized startup
migration, token verification, CORS allowlist and provider CI gates remain on.
Rollback requires migration-compatible code/forward fix, never demo downgrade
or restore. RootDir filtering can skip a later docs-only backend deploy.

PA3 review still needs approval of weekly one-window hours/overnight convention,
coarse court-lock throughput tradeoff, response/privacy projection (FR-029 does
not define approved Player contact fields), supplied image URLs and rounding tie
policy. PA4 still needs formal cases/traceability and measured performance/UI
accessibility plans. PA5 needs actual business UI and feature-level integration;
F09/profile remain outside this draft. There is no claim that every AC/NFR is
fully accepted or that this work represents verified team contribution shares.
