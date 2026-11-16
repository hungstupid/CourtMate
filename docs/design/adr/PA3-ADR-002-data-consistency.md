# ADR-002: PostgreSQL transactions and shared integrity controls

## Status

Proposed

## Context

Concurrent requests must not double-book overlapping intervals, partially confirm a selection, overfill a room, alter accepted prices or invalidate a confirmed booking through an Owner edit. A request may update several related tables and optional offer states.

## Decision

Use one PostgreSQL transaction per operation with a shared Session. Serialize court-affecting writes by locking Court first; lock selected Slots in stable order, and Room operations in Court → Booking → Room order. Revalidate interval overlap and current eligibility while locked. Persist one Booking, ordered BookingSlot snapshots and unique active SlotClaim rows atomically. Preserve snapshots on cancellation while releasing claims and closing the linked room.

## Alternatives considered

Client-side or preflight availability checks alone race with other users. Optimistic version checks can work with conditional writes and retries, but add multi-row coordination here; reviewed-quote/version comparison remains useful alongside locks. An additional distributed lock service duplicates coordination already provided by the chosen database. Slot-claim uniqueness alone does not protect different slot IDs with overlapping intervals.

## Consequences

Court-first locking plus interval checks prevents conflicting cooperating writers; database keys, foreign keys and checks provide additional integrity (Section 5.3). Unique room booking/membership keys and one nonterminal offer configuration per slot support their invariants. Room and offer eligibility still require locked service checks. Writes for the same court wait, so all writers must use the protocol and avoid external calls while holding locks where feasible. Unrelated courts can proceed independently.

## Traceability

NFR-02/03; FR-015–018/020–027/031–038/043–045/047–049; BR-01–08/10; Figures 4.4 and 5.1; Section 5.3.

## Evaluation

Run database-backed races for overlapping single/multi-slot confirmation, schedule edit versus confirmation, Join/Leave/Close and offer activation versus cancellation/deactivation. Assert atomic outcomes, unchanged accepted totals and no overcapacity.

