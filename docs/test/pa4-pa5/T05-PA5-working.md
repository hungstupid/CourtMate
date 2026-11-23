# PA5 — Implementation, Testing & Deployment

**CourtMate | T05 Nexora | 23 November 2026 | Working draft**

## 1. Member contribution assessment

The team should verify this phase’s assignments and percentages totaling 100% before submission. Earlier PA3 evidence establishes the design handoff. It does not establish individual PA5 hours or percentages.

| Member | Evidence |
|---|---|
| Nguyễn Đức Hưng | PA3 object/data design PR #90 and repository release changes on chore/project-bootstrap. |
| Bùi Phạm Quang | PA3 UI handoff PR #86 and linked editable Figma screens. |
| Dương Trung Hiếu | PA3 architecture and ADR handoff PR #91. |
| Lê Thành Trung | PA3 overview, traceability and AI logs in PRs #93–94. |

## 2. Implementation

The backend and frontend share the PA2 behavior and current PA3 design. The PA3 schema implementation is d4df9a3, UI and initial regression alignment d551a36, and focus return correction 7bd1601. The repository release candidate includes these commits.

| PA3 decision or feature | Realization and status |
|---|---|
| ADR-001, layered client/server | React/Vite pages and API client → FastAPI routes → app/services → SQLAlchemy/PostgreSQL. Vercel serves Vite, Render runs the API, Neon hosts PostgreSQL. |
| ADR-002, transactional integrity | app/db/session.py, services/bookings.py and services/rooms.py. Court-first locks and atomic snapshots/claims/member mutation. 0007 derives slot playing day and uses one closure reason. |
| ADR-003, identity and scope | Firebase SDK/Admin in frontend and app/core/auth.py. Roles and resource ownership remain authoritative in PostgreSQL. The special authorized Join uses a read-only identity lookup. |
| F01–F03 / UC-01–04 | Done in scope. Authentication and role, filters, preview, address, available intervals. FR-013 map deferred as in PA3. |
| F04–F05 / UC-05–07 | Done. Review and complete reservation, stale quote/conflict recovery, history and whole cancellation. |
| F06–F07 / UC-08–10 | Done. Owner court, hours, batch/individual publication, maintenance and owned booking views. |
| F10 / UC-11–14, UC-17 | Done. Discovery, create/join/leave/organizer close and per-person estimate; public projections minimize identity. |
| F08 / UC-15 | Done. Safe basic profile editing and role/email protection. |
| F09 / UC-16 | Done. Manual/automatic fixed offers, explicit thresholds and regular-pricing fallback when disabled. |

Review uses the team’s PR and independent-review convention in CONTRIBUTING.md. Current code self-review verified the Room exception narrowing and readiness/rollback path. Historical PA3 design links provide provenance. Independent review of this release is pending until a teammate comments or approves. Ruff lint/format and ESLint passed, TypeScript typecheck and Vite build passed. The bundle warning is approximately 520 kB minified and does not prevent the build.

### Design and interaction differences

The core PA3 screens were compared against Figma S06, S127, S217, S34, S20, S21 and S241. The release preserves the design’s actions, state text and role ownership. S217 is a modal over the selected slots, and S21 uses live room and roster data rather than its sample labels. S06 excludes the optional map affordance visible in the older frame; PA3 defers it. S34 and the Player calendar show textual reasons for blocked slots.

## 3. Testing

| Layer | Executed evidence |
|---|---|
| Baseline b37fa6d | 239 pytest and 53 Playwright passed, including legacy map tests. |
| Current backend | 242 pytest passed under Firebase Auth Emulator and real PostgreSQL 17. Ruff and locked sync passed. Legacy, fresh, abort and downgrade/re-upgrade paths run; /ready passed from a restored local database. |
| Current browser | Full local 50 Playwright passed. The six business cases were rerun after the focus correction. Three map-only scenarios and the previous map AC test were replaced by the PA3 address/availability regression. |
| Accessibility | 28 real states × 375/768/1280 px passed Axe and geometry on stage. Five Lighthouse snapshots scored 100. Visible focus and dialog Escape/focus return checked at the three widths. Human screen-reader session remains pending. |
| NFR-01 | 30 VUs, 5 s warm-up, 60 s steady. Read P95 690.56 ms, write P95 675.17 ms, 0/1,858 unexpected errors. The overall 153 HTTP 409 responses are expected conflicts from the contended workload. |
| NFR-02/03 | PostgreSQL real-connection tests include ten overlapping confirms, one-slot shared pairs, last-seat/duplicate Join, capacity edit races, Join/Leave/Close, schedule and F09 hazards, start and six-hour receipt boundaries. Assertions inspect accepted aggregates, claims and roster. |
| NFR-04 | Invalid and expired identity, role/ownership denials, public projections and unchanged state on rejected writes verified. |

The 17 Must functional test groups were executed in the isolated setup and passed. The PA4 functional exit criterion is met for the checked scope. The cross-cutting human screen-reader gate and authorization for a cloud write demo remain open. The [RTM](requirements-traceability.csv) and [extended map](release-traceability.csv) track 49 FR, five NFR, ten BR, 17 UC and 106 AC. The AC rows link to executed suites and do not imply an individually named test for every AC.

### Test case results

| Case | Actual result | Status |
|---|---|---|
| TC-01 | test_identity.py, test_srs_alignment.py and review.spec.ts duplicate-email. | Pass |
| TC-02 | test_auth_errors.py, bootstrap.spec.ts, review.spec.ts wrong-password and client.spec.ts. | Pass |
| TC-03 | test_courts.py, test_srs_alignment.py, business.spec.ts and usability.spec.ts UC-03. | Pass |
| TC-04 | test_courts.py, acceptance.spec.ts and screen-usability.spec.ts midnight. | Pass |
| TC-05 | test_bookings.py and business.spec.ts real Owner → discovery → multi-slot booking. | Pass |
| TC-06 | test_bookings.py, test_concurrency.py and usability.spec.ts real QUOTE_CHANGED/conflict. | Pass |
| TC-07 | test_bookings.py and business.spec.ts booking reload. | Pass |
| TC-08 | test_bookings.py, test_room_concurrency.py, business.spec.ts and usability.spec.ts UC-07. | Pass |
| TC-09 | test_courts.py, review.spec.ts AC-F06-07 and usability.spec.ts UC-08. | Pass |
| TC-10 | test_courts.py, test_business_migrations.py, test_srs_alignment.py, business/screen-usability/usability specs. | Pass |
| TC-11 | test_courts.py, business.spec.ts and usability/screen-usability maintenance. | Pass |
| TC-12 | test_bookings.py, test_srs_alignment.py and usability.spec.ts UC-07/10. | Pass |
| TC-13 | test_rooms.py, test_room_concurrency.py and screen-usability/usability room creation. | Pass |
| TC-14 | test_rooms.py, test_core_api.py and review/usability room discovery. | Pass |
| TC-15 | test_core_api.py, test_room_concurrency.py, business.spec.ts and usability.spec.ts UC-13. | Pass |
| TC-16 | test_rooms.py, test_room_concurrency.py and business.spec.ts. | Pass |
| TC-17 | test_room_concurrency.py and review.spec.ts AC-F10-16/20. | Pass |
| TC-18 | test_identity.py, test_srs_alignment.py, business and screen-usability specs. | Pass |
| TC-19 | test_offers.py, review.spec.ts F09 and business.spec.ts automatic offer. | Pass |
| TC-20 | Migration, load, Lighthouse and keyboard passed. Human assistive-tech session pending. | Partial |

### Defects and retest

| Defect | Severity | Actual observation and correction | Retest |
|---|---|---|---|
| D-01, stale derived fields | High | Slot day and room closure were physically duplicated. Revision 0007 removes duplication and guards unverifiable historical state. | Old populated/fresh schemas, ambiguous flag rejection, down/up and startup readiness |
| D-02, rejected Room save | High | Generic ROOM_CLOSED handler could commit identity email on Join and closure on Leave. Scoped new Join exception and read-only authorization prevent those writes. | Real HTTP 409/403 and independent PostgreSQL snapshots, including member email, claims, total and roster |
| D-03, public display | Medium | Ineligible published slot reported UNAVAILABLE; public room included internal UUIDs. Three published states with reason and reduced room projection implemented. | Court and release browser checks, room API and projection assertions |
| D-04, review keyboard focus | Medium | Pending quote disabled the dialog trigger and Escape lost focus. Explicit focus return added. | Business integration and three widths |
| D-05, harness mismatch | Test only | Two tests compared public and protected projections as identical and one clicked a duplicate link name. Corrected API comparison and scoped navigation. | 50/50 rerun |
| D-06, F09 test clock | Test only | Initial fixture reviewed before its configured window. Fixture now uses an eligible instant. | 242/242 rerun |
| D-07, focus-ref lint | Build gate | The focus effect read a React ref during cleanup. It now captures the trigger before opening the dialog. | Lint, typecheck, build and all six business browser cases passed after the change. |

### Service coverage and automated system tests

Coverage.py measured app/services across the full pytest suite, including PostgreSQL integration. Statement coverage **91.64% (658/718)** and branch coverage **81.79% (247/302)**. The [coverage report](../../development/evidence/pa3-business-coverage.json) records per-file missed lines and branches.

| UC | Main | Alternative / exception |
|---|---|---|
| UC-05 | business.spec.ts real Owner→Player two-slot confirmation and reload | usability.spec.ts repeated QUOTE_CHANGED, real competing booking and network recovery |
| UC-13 | business.spec.ts successful Join with persisted membership | usability.spec.ts Keep (no membership), test_room_concurrency.py duplicate and final place; test_core_api.py closed 409 |
| UC-17 | review.spec.ts organizer closes open/full, preserves roster and booking | Same suite Keep and Escape, non-organizer denial in backend |

GitHub Actions .github/workflows/quality.yml runs frontend locked install/lint/typecheck/build and integration Postgres 17, migrations, Ruff, pytest and Playwright on pull requests and branch pushes. A deployment check records the actual PR run and SHA separately.

## 4. Deployment, release and user guide

- Local setup and isolated staging are documented in docs/development/setup.md. Start PostgreSQL, Firebase Emulator and API, run migrations, then run Vite. Browser writes use demo-courtmate and a localhost test database. The protected test branch is a local PostgreSQL copy restored before release startup.
- Player: create one Player account, search by sport/area/time, open court and choose contiguous available slots. Review the final quote, confirm, then use Lịch đặt to view/cancel or create Open Play. Eligible Players can join or leave, and the organiser can close.
- Owner: create one Owner account, add a court, configure hours, create and review draft slots, publish, and inspect Lịch sân and Booking. Keep or discard drafts explicitly when leaving. Optional F09 never alters already accepted prices.
- Deployment targets are [Vercel frontend](https://courtmate-court-mate.vercel.app) and [Render readiness](https://courtmate-api-cs7b.onrender.com/ready). The release operator compares /version.json, X-CourtMate-Commit and migration head. Read-only production smoke and the verified SHA belong in the final deployment readback.
- Render automatic publishing waits for CI and runs schema upgrade first. Review src/backend/README.md for the 0007 rollback order. The staged downgrade reconstructs both old columns. Record a Neon recovery point before production release. Maintain operator access to the direct migration connection.
- For teaching staff, ask the team’s operator to share dedicated test logins over the approved private channel. Local demo scenarios use synthetic data and the Firebase emulator. Cloud authentication and business writes require a designated test environment and accounts. Keep credentials out of this report, Git and recordings.

The demonstration records Owner registration, court/hours/publication and maintenance, Player sign-in/search/review/booking, history, open-play creation/join/leave/close, Owner booking view, cancellation/release and deactivation. The MP4 comes from the live local browser and uses synthetic records. Distribution is pending an approved destination.

## 5. Retrospective against PA1

PA1 placed Must completion before the planned December demo gate and treated F09 as Should. The implementation now includes the fixed-price option and the PA2 multi-slot and organizer-closure refinements while deferring maps in PA3. Milestones and estimates are planning data. Actual team effort and individual contributions await team validation.

PostgreSQL tests with independent transactions established correct behavior under collisions. Earlier review retained concrete Figma and PA2 evidence. Design revisions arrived after the first deployed release, which caused rework on date/room persistence and test expectations. For a later project, explicitly budget schema compatibility and use small reviewable release slices against the current design. A Scrum cadence could expose design/code drift earlier through frequent increments and early acceptance. AI accelerated the traceability draft and reproduction scripts. Reviewers must still verify source revisions, test assumptions and emitted evidence.

## 6. Final presentation

See [18-slide outline](Final-outline.md) for 15 minutes with a minimum of two minutes per member and a separate Q&A. Demonstrate one complete journey on the tested build using local staging if cloud fixtures are unavailable.

## 7. AI usage log

| Tool | Significant use | Verification |
|---|---|---|
| Codex | Compare PA2/PA3, update schema and scoped transaction handling, add UI focus and denial regressions. | Reviewed generated diffs, reproduced failures and validated actual database state, Ruff/ESLint, full tests and staging startup. |
| Codex | Prepare PA4/PA5, evidence, demo captions and presentation outline. | Checked execution counts and artifacts against captured logs, linked requirements, kept manual/peer review and cloud write gates explicit. Team must confirm contribution and final wording. |
