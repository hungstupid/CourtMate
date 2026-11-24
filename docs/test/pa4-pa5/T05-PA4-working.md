# PA4 — Test Plan & Test Cases

**CourtMate | T05 Nexora | 24 November 2026 | Working draft**

[PA1](https://docs.google.com/document/d/1HvIxWBQigw2EOslvJC_QruAoHZRrhQgO/edit) · [PA2](https://docs.google.com/document/d/1zL3Ra_0LceKOF_2pZa9iWpq7HIbRtALB/edit) · [PA3](https://docs.google.com/document/d/1b8tVkH3fjPObuf5piq0AejaUdxBCBAa2/edit) · [Rubric](https://docs.google.com/document/d/1ztkQ3DTItC-ry2j3lFM4T76Lgo54sE1V/edit)

## 1. Member Contribution Assessment

| Member | Evidence available | PA4 contribution |
|---|---|---|
| Nguyễn Đức Hưng | PA3 PR #90. Current release branch holds the PA4 draft and test evidence for team review. | Await team verification |
| Bùi Phạm Quang | PA3 UI/UX handoff PR #86. | Await team verification |
| Dương Trung Hiếu | PA3 architecture PR #91. | Await team verification |
| Lê Thành Trung | PA3 overview and traceability PRs #93–94. | Await team verification |

The team must approve PA4 roles and percentages totaling 100% from current-phase work records before submission. Prior-phase percentages concern PA3 only.

## 2. Test Plan

### Objectives and Scope

Verify the complete Player and Court Owner journeys F01–F07 and F10 against 38 Must FR, with permission, recovery, persisted state and concurrent transaction assertions. Review F08 and F09 because this release includes them. PA3 defers FR-013 map and directions. Payment, chat, waiting lists and forced cancellation are outside scope.

### Test Levels

| Level | Target | Method | Responsibility |
|---|---|---|---|
| Unit/service | Validation, time boundaries, transitions and pricing | pytest, coverage.py, injected server clock | Backend developer |
| Integration | Auth Emulator, HTTP, PostgreSQL row locks and migrations | FastAPI TestClient, independent sessions, PostgreSQL 17 | Backend developer and tester |
| System | Player and Owner browse, reserve, manage and recover | Playwright Chromium plus built staging smoke | Frontend developer and tester |
| Acceptance | FR/AC traceability, visual design, assistive technology and deployment | PA2 role journeys, Figma frames, Axe, Lighthouse, manual tasks | Team reviewer and intended users |

### Test Types

Run functional, authorization (NFR-04), repeatable concurrency (NFR-02/03), local load (NFR-01), accessibility (NFR-05) and regression.

### Test Design Techniques

Use requirements-based and use-case tests for happy paths, partitions and boundaries for inputs, decision tables for combined rules, and coverage.py statement/branch measures for the service layer.

### Test Environment and Test Data

Local Apple Silicon macOS, Chrome/Chromium, Python 3.12, Node 24, local PostgreSQL 17 and Firebase Auth Emulator project demo-courtmate. CI uses Ubuntu, disposable PostgreSQL 17 and an independent emulator. Generate accounts from run markers and one or more synthetic venues and clean only that run’s data. The [seeded catalogue](../../development/demo-catalog.md) supports realistic scale tests. Use the [manual screen-reader checklist](screen-reader-checklist.md) for TC-20. The PA3 migration fixture preserves the schedule, snapshots, claim and member at the old revision. Copy backup files with restrictive permissions. Public deploy smoke covers HTTPS frontend, API and readiness without write fixtures.

### Entry and Exit Criteria

Entry requires release candidate build, readiness, migrated test DB, isolated emulator and prepared fixtures. Exit requires 100% of Must test cases executed, at least 90% pass, and zero open Critical or High defects. Track manual usability and staging availability as separate gates and preserve evidence for failures and blocked cases.

### Defect Management

File or update an authorized work item with run SHA, reproduction steps, expected and actual results, severity, owner, testcase and retest. Critical means system failure, data loss or security breach without workaround. High means a Must fails with a difficult workaround. Medium means incorrect behavior with a usable workaround. Low means cosmetic. Keep the record open until actual retest evidence is available.

### Schedule, Responsibilities and Tools

Prepare the PA4 matrix in W08, run integration and UI with each change, then repeat regression, deployment smoke and demo checks for W09–W10. The team lead assigns review, testing, deployment and presentation during the team checkpoint.

### Test Risks

| Risk | Mitigation |
|---|---|
| Retrying a timed-out write creates another reservation | Assert committed snapshots, claims and one room after readback and retries. |
| Race test passes without collision | Synchronize concurrent requests, inspect locks and DB state, retain ordered-pair test cases. |
| Legacy room lacks source of closure | Stop migration transaction, preserve row, reconcile only from traceable event evidence. |
| Benchmark skews regression data | Separate databases and captured workloads. Never benchmark the cloud production URL. |
| CI or a single browser misses user obstacles | Verify viewport matrix, keyboard task, human screen reader and device separately. |
| Provider deploy and database revisions drift | Check CI and runtime SHA and /ready, test an old-schema rollback against a local clone. |

## 3. Test Design

### Equivalence Partitions and Boundary Values

| Input or operation | Eligible partition | Rejected partition | Boundaries tested |
|---|---|---|---|
| Initial role | player, owner | missing, unknown, reassign | first registration, second attempt |
| Availability | future active/published slot in hours | old, unpublished, blocked, maintenance | local 00:00, exact start, 24:00 exclusive end |
| Bookings | 1–4 distinct contiguous slots, 60–240 minutes | empty, duplicate, gap, mixed court/date, overlap | 1/4/5 slots, 60/240/241 minutes, touching endpoints |
| Cancellation | owned CONFIRMED and receive time at least 6h before start | denied owner or too late or cancelled | 6h + 1 µs, exactly 6h, 6h − 1 µs |
| Room capacity | integer 2 through 2×venue maximum | lower, greater, noninteger or invalid source | 1/2/16/17 at maximum 8, count C−1/C |
| Discounts | positive integer below regular and 0 < h ≤ 24 | invalid price/lead, occupied, expired or terminal | 0/0.5/24/>24 hours, activation and start equality |

### Decision Tables

| Rule | Conditions | Expected operation | Case |
|---|---|---|---|
| B1 | Authorized, contiguous and eligible, quote current | Confirm one complete booking | TC-05 |
| B2 | Eligible but changed quote | Return 409 with fresh review | TC-06 |
| B3 | Slot conflict or invalid selection | Reject and store zero partial allocation | TC-06 |
| B4 | Missing or wrong actor | Deny without protected write | TC-02, TC-12 |
| C1 | Owner of booking, CONFIRMED, receipt ≥6h | Cancel whole booking and release all claims | TC-08 |
| C2 | Too late, wrong actor or already cancelled | Reject and retain history | TC-08 |
| R1 | Future, eligible, not a member and capacity available | Insert unique membership | TC-15 |
| R2 | Full or duplicate | 409 and rollback | TC-15 |
| R3 | Authorized Join newly detects closure | Commit reason only and return 409 | TC-15 |
| R4 | Already closed or wrong role | 409 or 403 with unchanged state | TC-15, TC-16 |
| R5 | Organizer closes OPEN/FULL | Close once and retain roster and booking | TC-17 |
| R6 | Non-organizer attempts to close | Deny and retain state | TC-17 |
| O1 | Eligible fixed offer within its window | Apply its fixed price to new booking | TC-19 |
| O2 | Before threshold, expired, terminal or disabled | Use regular price | TC-19 |

## 4. Test Cases

### List of Test Cases

| Case | Objective | UC | Priority | Automated evidence |
|---|---|---|---|---|
| TC-01 | Register both initial roles and reject duplicate or invalid identity | UC-01 | High | test_identity.py, test_srs_alignment.py and review.spec.ts duplicate-email |
| TC-02 | Sign in and sign out with valid or invalid credentials | UC-02 | High | test_auth_errors.py, bootstrap.spec.ts, review.spec.ts wrong-password and client.spec.ts |
| TC-03 | Find only active courts and recover from an empty search | UC-03 | High | test_courts.py, test_srs_alignment.py, business.spec.ts and usability.spec.ts UC-03 |
| TC-04 | Open court details and preview eligible published slots | UC-03/04 | High | test_courts.py, acceptance.spec.ts and screen-usability.spec.ts midnight |
| TC-05 | Review and confirm one consecutive multi-slot booking | UC-05 | High | test_bookings.py and business.spec.ts real Owner → discovery → multi-slot booking |
| TC-06 | Reject select/confirm when eligibility or quote changes | UC-05 | High | test_bookings.py, test_concurrency.py and usability.spec.ts real QUOTE_CHANGED/conflict |
| TC-07 | View recent owned booking history and immutable totals | UC-06 | High | test_bookings.py and business.spec.ts booking reload |
| TC-08 | Cancel a whole booking at the six-hour boundary | UC-07 | High | test_bookings.py, test_room_concurrency.py, business.spec.ts and usability.spec.ts UC-07 |
| TC-09 | Create, edit and deactivate an owned court | UC-08 | High | test_courts.py, review.spec.ts AC-F06-07 and usability.spec.ts UC-08 |
| TC-10 | Publish operating hours and atomic batch with the local-day boundary | UC-09 | High | test_courts.py, test_business_migrations.py, test_srs_alignment.py, business/screen-usability/usability specs |
| TC-11 | Create and remove maintenance without invalidating reservations | UC-09 | High | test_courts.py, business.spec.ts and usability/screen-usability maintenance |
| TC-12 | View only owned-court bookings with scoped contact | UC-10 | High | test_bookings.py, test_srs_alignment.py and usability.spec.ts UC-07/10 |
| TC-13 | Create exactly one room and validate capacity | UC-12 | High | test_rooms.py, test_room_concurrency.py and screen-usability/usability room creation |
| TC-14 | Discover public rooms by address without leaking identity | UC-11 | High | test_rooms.py, test_core_api.py and review/usability room discovery |
| TC-15 | Join the final seat or reject a duplicate or closed request | UC-13 | High | test_core_api.py, test_room_concurrency.py, business.spec.ts and usability.spec.ts UC-13 |
| TC-16 | Leave a room as a member and enforce immutable closure | UC-14 | High | test_rooms.py, test_room_concurrency.py and business.spec.ts |
| TC-17 | Close a room as organizer and preserve accepted booking | UC-17 | High | test_room_concurrency.py and review.spec.ts AC-F10-16/20 |
| TC-18 | Save basic profile without changing identity or role | UC-15 | Should | test_identity.py, test_srs_alignment.py, business and screen-usability specs |
| TC-19 | Apply or end fixed slot offers without rewriting accepted prices | UC-16 | Should | test_offers.py, review.spec.ts F09 and business.spec.ts automatic offer |
| TC-20 | Measure release usability, load and migration guards | Cross-cutting | High | test_business_migrations.py, screen-matrix.spec.ts, k6 and Lighthouse evidence |

### Test Case Specifications

#### TC-01 · Register both initial roles and reject duplicate or invalid identity

**Trace** UC-01, FR-001, FR-003, FR-004, FR-005. **Technique** Partition, decision table.

**Preconditions and data** Fresh Auth Emulator email; Player/Owner registration; duplicate email; unsupported role. Ready isolated test environment.

**Steps** Register once per valid role. Repeat the email and send an invalid role with a fresh identity. Read the stored role and try protected access.

**Expected** Exactly one application account per eligible Firebase identity. Invalid/duplicate attempts assign no second role or protected access.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-02 · Sign in and sign out with valid or invalid credentials

**Trace** UC-02, FR-002, FR-004, FR-005. **Technique** Partition, state transition.

**Preconditions and data** Registered Player; valid, invalid, missing and expired credentials. Ready isolated test environment.

**Steps** Try an invalid password, retry valid, visit protected history, reload, then sign out and revisit. Exercise provider outage and denied role.

**Expected** Invalid auth creates no usable session. Valid sign-in persists after reload. Sign-out and provider errors fail closed.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-03 · Find only active courts and recover from an empty search

**Trace** UC-03, FR-006, FR-007, FR-008, FR-009, FR-046. **Technique** Partition, pairwise control coverage.

**Preconditions and data** Multiple sports/areas, active and inactive courts, time bounds and zero matching records. Ready isolated test environment.

**Steps** Search trimmed mixed-case names, choose a sport by keyboard and combine an address and optional time bounds. Clear time, submit invalid bounds, search a nonmatch and retry.

**Expected** Only records matching all active filters appear. Invalid bounds and empty results are labelled. Clear time leaves other filters intact.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-04 · Open court details and preview eligible published slots

**Trace** UC-03/04, FR-010, FR-011, FR-012, FR-046. **Technique** Partition, boundary-value analysis.

**Preconditions and data** Future available, maintenance, blocked, booked and hidden unpublished intervals; GPS denied. Ready isolated test environment.

**Steps** Open a result preview without bounds and with bounds; dismiss and verify the search state. Open detail and availability, including the exact midnight end boundary.

**Expected** Address and photos or fallback display. All published rows use three states and explain blocks. Preview includes only future available slots. No GPS request.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-05 · Review and confirm one consecutive multi-slot booking

**Trace** UC-05, FR-012, FR-014, FR-015, FR-016, FR-017, FR-018. **Technique** Boundary-value analysis and decision table.

**Preconditions and data** Same court and local date; two touching available slots priced 120,000 each. Ready isolated test environment.

**Steps** Select both, review, check no claims yet, confirm the current quote and reload detail.

**Expected** One CONFIRMED booking with two snapshots and claims, combined interval and 240,000 VND accepted total.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-06 · Reject select/confirm when eligibility or quote changes

**Trace** UC-05, FR-012, FR-014, FR-015, FR-016, FR-017, FR-018. **Technique** Decision table, state transition, concurrency.

**Preconditions and data** Duplicate IDs, gaps, over 240 min, differently priced same slot, 10 overlapping independent contenders. Ready isolated test environment.

**Steps** Review invalid selections. Change quote twice, or let another Player reserve an overlapping slot. Confirm stale quote, review again and explicitly reconfirm valid selection.

**Expected** No partial claims or booking. Exactly one conflicting contender wins. New quote requires acceptance and only valid remaining slots stay selected.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-07 · View recent owned booking history and immutable totals

**Trace** UC-06, FR-019. **Technique** Boundary-value analysis and permissions.

**Preconditions and data** More than ten records including cancelled; a second Player. Ready isolated test environment.

**Steps** Open history and details with the owner account and then the other account. Compare accepted totals after a price edit.

**Expected** At most ten newest owned records, retained snapshots, denial for unrelated Player.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-08 · Cancel a whole booking at the six-hour boundary

**Trace** UC-07, FR-020, FR-021, FR-022. **Technique** Boundary-value analysis and state transition.

**Preconditions and data** At six hours, one microsecond under, cancelled record, other Player, linked Room. Ready isolated test environment.

**Steps** Read eligibility, Keep, confirm approved cancellation. Force lock wait across the receive-time boundary. Inspect claims, snapshots and Room.

**Expected** Exactly six hours permits whole cancellation. Too late or unauthorized attempts mutate nothing. Claims released, totals retained, Room closed.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-09 · Create, edit and deactivate an owned court

**Trace** UC-08, FR-023, FR-024. **Technique** Partition and permissions.

**Preconditions and data** Owner, other Owner, valid listing, invalid contact/photo inputs, owned booking already confirmed. Ready isolated test environment.

**Steps** Create listing, reload, edit with optional contact empty, test failed save/retry and Keep. Deactivate and search as guest.

**Expected** Ownership enforced; saved values survive reload and drafts survive recoverable errors. Deactivation removes public discoverability and preserves history.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-10 · Publish operating hours and atomic batch with the local-day boundary

**Trace** UC-09, FR-025, FR-027. **Technique** Boundary-value analysis and decision table.

**Preconditions and data** Half-hour alignments, 60/240 minutes, 23:00–24:00, next 00:00, overlapping draft and booked intervals. Ready isolated test environment.

**Steps** Set weekly hours, preview multiple rows, submit conflicting row then correct. Reload and use date filter; attempt edit against a confirmed booking.

**Expected** Only valid complete batch persists. Midnight-ending slot appears on its playing date. BOOKED state wins. No confirmed times or price change.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-11 · Create and remove maintenance without invalidating reservations

**Trace** UC-09, FR-026, FR-027. **Technique** Partition, state transition.

**Preconditions and data** Free interval, one touching edge, one overlapping confirmed booking, multi-day range. Ready isolated test environment.

**Steps** Preview affected slots. Confirm maintenance over a free interval; try a conflict, correct and retry. Reload and remove owned block.

**Expected** Maintenance blocks affected slots, touching boundaries remain nonoverlapping and conflicting change rolls back. Date/time is unambiguous.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-12 · View only owned-court bookings with scoped contact

**Trace** UC-10, FR-005, FR-028, FR-029, FR-030. **Technique** Decision table, permissions.

**Preconditions and data** Two Owners with separate courts; Player with booked court and email. Ready isolated test environment.

**Steps** Open list and filter by court/date/status. Open owned detail and Back. Request same ID from another Owner and Player.

**Expected** Owner sees only owned court data and authorized contact. Other users see no protected fields; filter survives Back.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-13 · Create exactly one room and validate capacity

**Trace** UC-12, FR-031, FR-032, FR-038. **Technique** Boundary-value analysis, decision table.

**Preconditions and data** Future owned confirmed booking, capacity 1/2/16/17 with court maximum 8, second creation attempt. Ready isolated test environment.

**Steps** Cancel first draft, submit invalid capacity, then create valid and reload. Retry after response loss and attempt duplicate on a closed room.

**Expected** One room per source booking with organizer as first member. Out-of-bounds requests and duplicates leave roster intact.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-14 · Discover public rooms by address without leaking identity

**Trace** UC-11, FR-033, FR-038. **Technique** Partition, privacy and state transition.

**Preconditions and data** Rooms OPEN/FULL/CLOSED, mixed case address/area, guest token absent. Ready isolated test environment.

**Steps** Search by location then no match, open detail and Back. Check public payload against stored membership and contact fields.

**Expected** Matched list and safe roster/estimate visible. Booking and organizer UUIDs, member IDs and private contacts are excluded from public Room endpoints.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-15 · Join the final seat or reject a duplicate or closed request

**Trace** UC-13, FR-034, FR-035, FR-038. **Technique** Decision table and concurrency.

**Preconditions and data** Last place; duplicate actor; authenticated Join exactly at booking start with stale synced email. Ready isolated test environment.

**Steps** Confirm Join and race two actors for last seat; retry same actor. With injected start time send denied Leave, unauthorized Join and authorized first/repeated Join. Inspect committed DB after each response.

**Expected** Capacity and unique member invariants hold. Only the first newly detected authorized closure commits its reason. No other data changes on rejection.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-16 · Leave a room as a member and enforce immutable closure

**Trace** UC-14, FR-036, FR-037, FR-038. **Technique** Decision table and concurrency.

**Preconditions and data** Organizer, nonmember and active member; OPEN/FULL/CLOSED Room. Ready isolated test environment.

**Steps** Choose Keep and then confirm member Leave. Retry for each denied actor and after closure. Race Leave with Join and close.

**Expected** Member removed once, organizer cannot leave. Final roster/estimate respect serialized state and never change after close.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-17 · Close a room as organizer and preserve accepted booking

**Trace** UC-17, FR-005, FR-037, FR-038. **Technique** Decision table and state transition.

**Preconditions and data** OPEN or FULL future room; valid organizer and other Player. Ready isolated test environment.

**Steps** Select Keep and Escape, compare DB/payload. Confirm Close then repeat; reload as organizer and member.

**Expected** CLOSED reason remains ORGANIZER_CLOSED, roster and CONFIRMED booking remain, original total and claims stay intact. Others denied.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-18 · Save basic profile without changing identity or role

**Trace** UC-15, FR-039, FR-040. **Technique** Partition and state transition.

**Preconditions and data** Player and Owner; optional profile data, attempted protected field update, delayed save. Ready isolated test environment.

**Steps** Edit profile, reload, try changing role and email via API, verify draft guard and pending-save UI.

**Expected** Allowed updates persist. Role/email protected and unsent edits cannot be mistaken for committed values.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-19 · Apply or end fixed slot offers without rewriting accepted prices

**Trace** UC-16, FR-041, FR-042, FR-043, FR-044, FR-045, FR-047, FR-048, FR-049. **Technique** Boundary-value analysis, decision table and concurrency.

**Preconditions and data** Manual within 24h; automatic at 0.5h and exact threshold; zero / above 24 invalid; disabled F09. Ready isolated test environment.

**Steps** Create offers, check exact activation/start boundaries, cancel pending or deactivate active, race price/schedule/confirm, cancel accepted booking and disable feature.

**Expected** Regular price when disabled or ineligible. At most one active/scheduled offer per slot. Booked snapshots never change and terminal offers never reapply.

**Postcondition** Read the documented state and remove only run-owned data after the test.

#### TC-20 · Measure release usability, load and migration guards

**Trace** Cross-cutting, NFR-01 and NFR-05, ADR-002 migration. **Technique** Threshold and fault injection.

**Preconditions and data** Local restored PostgreSQL 17 stage, 30 VUs, 1 court/8 slots, 375/768/1280 CSS px, legacy reason present/absent. Ready isolated test environment.

**Steps** Run migration from empty and from 0006 fixtures. Run 5-second warm-up and separate steady k6, Axe/Lighthouse, keyboard and manual assistive-tech journeys.

**Expected** Migration preserves history or atomically stops on ambiguous reason. Read P95 <800 ms, write P95 <1500 ms and unexpected errors <1%. Lighthouse ≥80 and usable labelled controls. Record missing manual cases distinctly.

**Postcondition** Read the documented state and remove only run-owned data after the test.

## 5. Requirements–Test Traceability

The 49-row RTM includes 38/38 Must FR with linked tests. Planning coverage is distinct from execution. FR-013 is tracked as Deferred in PA3. [Editable RTM](requirements-traceability.csv).

| Must FR | Summary | Cases |
|---|---|---|
| FR-001 | Register by email and select an initial role. | TC-01 |
| FR-002 | Sign in by email and sign out. | TC-02 |
| FR-003 | Assign user roles. | TC-01 |
| FR-004 | Require authentication for protected actions. | TC-01, TC-02 |
| FR-005 | Check role and resource ownership. | TC-01, TC-02, TC-12, TC-17 |
| FR-006 | Display active court listings. | TC-03 |
| FR-007 | Search courts by name. | TC-03 |
| FR-008 | Filter courts by sport, address or area and optional time bounds. | TC-03 |
| FR-009 | Handle empty search results. | TC-03 |
| FR-010 | Display court details. | TC-04 |
| FR-011 | Display published slot lists and slot details | TC-04 |
| FR-012 | Select eligible consecutive court slots. | TC-04, TC-05, TC-06 |
| FR-014 | Review selected slots and total booking price. | TC-05, TC-06 |
| FR-015 | Validate booking eligibility and time rules. | TC-05, TC-06 |
| FR-016 | Prevent overlapping bookings. | TC-05, TC-06 |
| FR-017 | Create one confirmed booking for selected slots. | TC-05, TC-06 |
| FR-018 | Revalidate slots and prices at confirmation. | TC-05, TC-06 |
| FR-019 | View recent booking history. | TC-07 |
| FR-020 | Cancel an eligible whole booking. | TC-08 |
| FR-021 | Display cancellation eligibility. | TC-08 |
| FR-022 | Release slots after booking cancellation. | TC-08 |
| FR-023 | Create and edit owned court listings. | TC-09 |
| FR-024 | Deactivate an owned court. | TC-09 |
| FR-025 | Manage operating hours and published slots. | TC-10 |
| FR-026 | Mark court maintenance intervals. | TC-11 |
| FR-027 | Protect confirmed bookings from schedule edits. | TC-10, TC-11 |
| FR-028 | View bookings for owned courts. | TC-12 |
| FR-029 | Display owned-court booking details. | TC-12 |
| FR-030 | Restrict access to other owners’ bookings. | TC-12 |
| FR-031 | Create one room per eligible booking. | TC-13 |
| FR-032 | Validate Open Play Room capacity. | TC-13 |
| FR-033 | Browse and search public rooms by court address or area. | TC-14 |
| FR-034 | Join an eligible Open Play Room. | TC-15 |
| FR-035 | Prevent room overcapacity and duplicate joins. | TC-15 |
| FR-036 | Leave an eligible Open Play Room. | TC-16 |
| FR-037 | Close rooms automatically or by organizer confirmation. | TC-16, TC-17 |
| FR-038 | Display per-person cost estimate. | TC-13, TC-14, TC-15, TC-16, TC-17 |
| FR-046 | Preview a result court’s matching or nearest slots. | TC-03, TC-04 |

## 6. AI Usage Log

| Tool | Task | Validation |
|---|---|---|
| Codex | Align draft to PA4 template, PA2 IDs, PA3 decision tables and existing regression. | Parsed 49 FR and checked all 38 Must have cases. Linked real tests and kept planning separate from results. Team validates contribution percentages before submission. |
