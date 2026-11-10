# SRS implementation audit

Source: [current SRS](https://docs.google.com/document/d/1zL3Ra_0LceKOF_2pZa9iWpq7HIbRtALB/edit), modified **2026-11-10T11:58:03.963Z**, fetched directly through Drive on 10 November 2026. This is a DOCX-backed document, not the October implementation baseline. All 49 FRs, acceptance scenarios and BR-01–10 below are extracted from this source once. Submitted PA documents are unchanged.

Figma: [current design](https://www.figma.com/design/2EFad23oucNwIjREtvVUPE/SE_FE_Design_Court-Mate?node-id=23-561). Session creation succeeded; design-context request was rejected by the Figma Starter MCP call limit; direct web access returned HTTP 403. **Visual fidelity is BLOCKED/unverified.** SRS screen specifications can guide functional implementation but cannot establish Figma fidelity.

## Status interpretation

DONE requires implemented behavior and executed relevant evidence. PARTIAL means some layers/scenarios remain unverified. MISSING means no implementation. MISMATCH means existing behavior contradicts the latest source. This initial audit records the starting state at `a1cf7b9`; final evidence will be appended after execution. No historical check is relabeled as current PASS.

## Functional requirements — initial audit

| FR | Requirement | Initial status | Evidence / gap |
|---|---|---|---|
| FR-001 | Register by email and select an initial role. | MISMATCH | `app/core/auth.py` auto-provisions Player; no validated initial Owner registration. |
| FR-002 | Sign in by email and sign out. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-003 | Assign user roles. | MISMATCH | `app/core/auth.py` auto-provisions Player; no validated initial Owner registration. |
| FR-004 | Require authentication for protected actions. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-005 | Check role and resource ownership. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-006 | Display active court listings. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-007 | Search courts by name. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-008 | Filter courts by sport, address or area and optional time bounds. | MISMATCH | `app/api/courts.py`: exact area filter; no full-address substring/time bounds. |
| FR-009 | Handle empty search results. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-010 | Display court details. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-011 | Display published slot lists and slot details | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-012 | Select eligible consecutive court slots. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-013 | Show optional court map and directions. | MISSING | No current API/UI implementation; FR-013/F08/F09 are Should-have. |
| FR-014 | Review selected slots and total booking price. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-015 | Validate booking eligibility and time rules. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-016 | Prevent overlapping bookings. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-017 | Create one confirmed booking for selected slots. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-018 | Revalidate slots and prices at confirmation. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-019 | View recent booking history. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-020 | Cancel an eligible whole booking. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-021 | Display cancellation eligibility. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-022 | Release slots after booking cancellation. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-023 | Create and edit owned court listings. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-024 | Deactivate an owned court. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-025 | Manage operating hours and published slots. | MISMATCH | Single-slot publishing only; no atomic batch endpoint or draft UI. |
| FR-026 | Mark court maintenance intervals. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-027 | Protect confirmed bookings from schedule edits. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-028 | View bookings for owned courts. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-029 | Display owned-court booking details. | MISMATCH | Owner booking detail omits newly specified registration email/display name. |
| FR-030 | Restrict access to other owners’ bookings. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-031 | Create one room per eligible booking. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-032 | Validate Open Play Room capacity. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-033 | Browse and search public rooms by court address or area. | MISMATCH | `app/services/rooms.py`: no address filter or court display data. |
| FR-034 | Join an eligible Open Play Room. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-035 | Prevent room overcapacity and duplicate joins. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-036 | Leave an eligible Open Play Room. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-037 | Close rooms automatically or by organizer confirmation. | MISMATCH | Start/cancel closure exists; organizer manual-close endpoint absent. |
| FR-038 | Display per-person cost estimate. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-039 | Display editable basic profile. | MISSING | No current API/UI implementation; FR-013/F08/F09 are Should-have. |
| FR-040 | Validate and save profile changes. | MISSING | No current API/UI implementation; FR-013/F08/F09 are Should-have. |
| FR-041 | Create manual slot-specific discounts. | MISSING | No current API/UI implementation; FR-013/F08/F09 are Should-have. |
| FR-042 | Deactivate an active discount offer. | MISSING | No current API/UI implementation; FR-013/F08/F09 are Should-have. |
| FR-043 | Re-evaluate eligible offers after cancellation. | MISSING | No current API/UI implementation; FR-013/F08/F09 are Should-have. |
| FR-044 | Revalidate manual/automatic offers at confirmation. | MISSING | No current API/UI implementation; FR-013/F08/F09 are Should-have. |
| FR-045 | Save the accepted discounted booking total. | MISSING | No current API/UI implementation; FR-013/F08/F09 are Should-have. |
| FR-046 | Preview a result court’s matching or nearest slots. | PARTIAL | Frontend business screens absent (`src/frontend/src/app/App.tsx`); backend `app/services/{courts,bookings,rooms}.py` and existing core/concurrency tests cover portions. |
| FR-047 | Configure a slot-specific automatic offer. | MISSING | No current API/UI implementation; FR-013/F08/F09 are Should-have. |
| FR-048 | Apply automatic offers at the configured threshold. | MISSING | No current API/UI implementation; FR-013/F08/F09 are Should-have. |
| FR-049 | Cancel a pending automatic offer schedule. | MISSING | No current API/UI implementation; FR-013/F08/F09 are Should-have. |

## Acceptance criteria — initial audit

Every criterion is retained individually; initial status is PARTIAL unless its feature is absent or contradicted. Named test evidence will be updated after implementation.

| AC | Related FR | Initial status | Verification gap |
|---|---|---|---|
| AC-F01-01 | FR-001 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F01-02 | FR-001 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F01-03 | FR-002 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F01-04 | FR-002, FR-004 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F01-05 | FR-003 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F01-06 | FR-004, FR-005 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F01-07 | FR-005 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F01-08 | FR-005 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F01-09 | FR-002 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F01-10 | FR-003, FR-004 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F01-11 | FR-001, FR-003 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F01-12 | FR-001, FR-003 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F01-13 | FR-001, FR-003 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F02-01 | FR-006 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F02-02 | FR-007 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F02-03 | FR-008 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F02-04 | FR-009 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F02-05 | FR-007, FR-008 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F02-06 | FR-008 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F02-07 | FR-008 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F02-08 | FR-008 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F02-09 | FR-008 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F02-10 | FR-008, FR-009 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F02-11 | FR-046, FR-008 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F02-12 | FR-046, FR-014 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F03-01 | FR-010 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F03-02 | FR-011 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F03-03 | FR-012 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F03-04 | FR-013 (Should) | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F03-05 | FR-011, FR-012 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F04-01 | FR-014 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F04-02 | FR-015 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F04-03 | FR-016 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F04-04 | FR-017 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F04-05 | FR-018 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F04-06 | FR-014, FR-018 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F04-07 | FR-017, FR-018 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F04-08 | FR-014, FR-017, FR-018 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F04-09 | FR-015, FR-018 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F04-10 | FR-016, FR-018 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F05-01 | FR-019 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F05-02 | FR-020 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F05-03 | FR-020 / FR-021 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F05-04 | FR-021 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F05-05 | FR-022 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F05-06 | FR-020, FR-021 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F05-07 | FR-020, FR-022 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F06-01 | FR-023 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F06-02 | FR-023, FR-024 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F06-03 | FR-024 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F06-04 | FR-025 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F06-05 | FR-026 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F06-06 | FR-027 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F06-07 | FR-023 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F06-08 | FR-023 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F06-09 | FR-023, FR-032 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F06-10 | FR-025, FR-027 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F06-11 | FR-023, FR-025 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F06-12 | FR-025 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F06-13 | FR-025 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F06-14 | FR-025, FR-027 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F06-15 | FR-025, FR-027 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F07-01 | FR-028 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F07-02 | FR-029 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F07-03 | FR-030 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F08-01 | FR-039 (Should) | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F08-02 | FR-040 (Should) | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F08-03 | FR-040 (Should) | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-01 | FR-041 (Should) | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-02 | FR-041 (Should) | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-03 | FR-042 (Should) | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-04 | FR-043 (Should) | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-05 | FR-044 (Should) | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-06 | FR-045 (Should) | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-07 | FR-044, FR-045 | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-08 | FR-047 | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-09 | FR-047, FR-048 | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-10 | FR-048 | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-11 | FR-047, FR-048 | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-12 | FR-048 | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-13 | FR-049, FR-004, FR-005 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-14 | FR-042, FR-048 | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-15 | FR-041, FR-047, FR-048 | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-16 | FR-044, FR-045 | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F09-17 | FR-048, FR-043 | MISSING | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-01 | FR-031 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-02 | FR-031 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-03 | FR-032 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-04 | FR-033 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-05 | FR-034 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-06 | FR-034 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-07 | FR-035 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-08 | FR-036 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-09 | FR-037 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-10 | FR-038 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-11 | FR-031, FR-034, FR-037 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-12 | FR-038 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-13 | FR-033, FR-034, FR-036, FR-037 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-14 | FR-031, FR-032 | PARTIAL | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-15 | FR-033 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-16 | FR-033 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-17 | FR-037 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-18 | FR-037 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-19 | FR-004, FR-005, FR-037 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-20 | FR-031, FR-037 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |
| AC-F10-21 | FR-034, FR-036, FR-037 | MISMATCH | Current end-to-end UI/API evidence pending; compare exact source scenario. |

## Business rules — initial audit

| Rule | Initial status | Evidence / gap |
|---|---|---|
| BR-01 — Slot Scheduling Rules | PARTIAL | Existing services/tests cover booking/capacity subsets; current source regression and frontend verification pending. |
| BR-02 — 6-Hour Booking Cancellation | PARTIAL | Existing services/tests cover booking/capacity subsets; current source regression and frontend verification pending. |
| BR-03 — Protect Confirmed Bookings | PARTIAL | Existing services/tests cover booking/capacity subsets; current source regression and frontend verification pending. |
| BR-04 — One Room per Booking | MISMATCH | Existing services/tests cover booking/capacity subsets; current source regression and frontend verification pending. |
| BR-05 — Court and Room Capacity | PARTIAL | Existing services/tests cover booking/capacity subsets; current source regression and frontend verification pending. |
| BR-06 — Open Play Room Lifecycle | MISMATCH | Existing services/tests cover booking/capacity subsets; current source regression and frontend verification pending. |
| BR-07 — Manual and Scheduled Last-Minute Deals | MISSING | Existing services/tests cover booking/capacity subsets; current source regression and frontend verification pending. |
| BR-08 — Per-Person Cost Estimate | PARTIAL | Existing services/tests cover booking/capacity subsets; current source regression and frontend verification pending. |
| BR-09 — User Roles and Access | MISMATCH | Existing services/tests cover booking/capacity subsets; current source regression and frontend verification pending. |
| BR-10 — Consecutive Multi-Slot Booking | PARTIAL | Existing services/tests cover booking/capacity subsets; current source regression and frontend verification pending. |

## Quality targets

NFR-01: specified 30-user/60-second workload not yet run for this change. NFR-02/03: existing real PostgreSQL concurrency tests must be rerun and expanded for closure/offers. NFR-04: initial role registration and protected contact disclosure require regressions. NFR-05: 375/768/1280 responsive, keyboard/focus, contrast, Lighthouse >=80 and screen-reader checks pending. Axe alone cannot establish full compliance.

## Implementation / execution evidence

Pending; no current checks have been marked PASS.
