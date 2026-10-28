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
| FR-038, BR-08, AC-F10-10/12 | Whole accepted price / current members; integer half-up; unavailable invalid snapshots | test_rooms: valid/partial/mismatched/noncontiguous snapshot cases, count updates; test_core_api 100001/2 rounds 50001 |
| NFR-02/03 integrity scenarios | PG row locks + unique claims/room/member constraints | Observed pg_blocking_pids for distinct backend PIDs before releasing blockers; final committed DB state checked. This does not claim NFR-01 performance |

API/error/response details and frontend call order: [backend-api.md](backend-api.md).
Schema/transaction order and design decisions: [backend-core-design.md](backend-core-design.md).

## Executed local checks before push

- `uv sync --locked`: PASS, dependencies/uv.lock unchanged.
- `uv run pytest -q`: **209 passed, 0 failed, 0 skipped**; real PostgreSQL17 and
  Firebase Auth Emulator, no SQLite replacement. A first complete Phase A run
  passed 153 before the subsequent extra readback/room regressions.
- `uv run ruff check .`, `uv run ruff format --check .`: PASS.
- `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`: PASS; install
  reported 0 vulnerabilities. No frontend dependency upgrade/change.
- `BROWSER_CHANNEL=chrome npm run test:e2e`: **6 passed** against actual local
  API/PostgreSQL/Auth Emulator. Three local API failure-injection regression
  tests are labelled separately in the existing suite; they are not evidence
  of cloud-provider success. No business-UI/NFR accessibility claim follows.
- Temporary, uniquely named local test schemas: upgrade from empty and from
  populated 0001, repeat upgrade; users preserved. Disposable schemas only were
  dropped. Concurrency fixtures commit unique test rows and delete only theirs.
- Existing local development DB: upgrade to 0003 twice; all 9 existing identity
  rows preserved at that check, no reset/downgrade/restore.
- All new tests are automatically collected by the existing quality workflow's
  `uv run pytest`; its Firebase Emulator/PG services need no personal credential.

One sandbox-denied test diagnostic exposed a generated local DB password in its
traceback. That local credential was invalidated/rotated, ignored backend/root
.env files synchronized at 0600, and existing data retained. Cloud credentials
were unchanged. Pytest now uses short tracebacks with frame locals disabled;
secret values are not copied into this report, Git or frontend artifacts.

## Deployment and review limits

The initial documentation snapshot recorded local success while remote CI and
deployment were still pending. The observed release evidence below supersedes
that pending status; the old bootstrap was not used as proof of new code.

Migrations add tables and leave old identity SQL compatible. The previous live
API's strict 0001 readiness can briefly fail during the revision transition;
this is not a zero-downtime guarantee. New code requires 0003. Serialized startup
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


## Observed remote release — verified 28 October

Backend code is implemented as a draft, locally/CI verified and deployed. This
is not a claim of formal PA3/PA4 approval or all product/NFR acceptance.

| Evidence | Actual observed result |
| --- | --- |
| First push HEAD | `05d79605c21d61d8b984fd806463032af52f0ce2`; [CI40637937716](https://github.com/hungstupid/CourtMate/actions/runs/40637937716) SUCCESS; logs209 pytest +6 Playwright |
| Deployment source | `1839e9cf38ce6ea035fd513bcb4dcbc4d724e16c`, backend README correction after Render did not deploy the docs-outside-root HEAD; no business source change from `4f53fb2` |
| Release CI | [40638330135](https://github.com/hungstupid/CourtMate/actions/runs/40638330135) SUCCESS; logs209 pytest, zero skip,6 Playwright; finished05:31:28 UTC |
| Render | `dep-dbgohcijnfac739hghn0`, trigger **new_commit**, source1839e9c, LIVE; started05:31:30 UTC, finished05:32:43 UTC |
| Vercel | `dpl_75fQv1mh8D2Q3UzGcFBv3bnkNKKY`, READY production, source1839e9c; public `/version.json` matches full SHA |
| API version/schema | `/health`200 with exact `X-CourtMate-Commit`1839e9c; `/ready`200 with code-required head0003; new routes present in deployed OpenAPI |
| Cloud real SQL/Auth | Anonymous courts/rooms queries200; existing Firebase Player/Owner sign-in → `/api/me` preserves UID/role; own-role booking reads200/opposite-role403; missing/invalid identity401; Owner booking review403; Player unknown-slot review404 against actual slots table |
| CORS | Exact public frontend Bearer/JSON PATCH preflight200; unlisted origin400/noallow-origin |
| Data scope | Cloud smoke made no new application court/slot/booking/room/user fixture and deleted no data; no demo reset/downgrade/restore. Full mutation/concurrency correctness evidence is local/CI PostgreSQL, not cloud write/load testing |
| Repository/credentials | Main and protected PA/SRS/Figma/contribution files unchanged; no dependency lockfile upgrade, provider gate/auth/CORS disable or new/paid service. Exact runtime credential scan145 source/build files passed without printing values |

Public frontend: https://courtmate-court-mate.vercel.app. API/docs:
https://courtmate-api-cs7b.onrender.com/docs. Existing Firebase/Neon/Render/Vercel
resource IDs and secure onboarding remain in [setup.md](setup.md). Final
subsequent documentation commits do not change this verified business source;
Render may retain its last backend SHA because of root-directory filtering.

Remaining unverified: real cloud business write/concurrency/load scenarios,
formal product performance and business-UI accessibility, and team PA3/PA4
review. No infrastructure/auth/tool blocker remains for the implemented backend
scope. Follow-up work is business frontend integration, explicit PA3 decisions
listed above, PA4 cases/measurements, and deferred F09/profile if approved.
